#!/usr/bin/env bun
/**
 * Mechanical candidate scan for the eight checks in references/checks.md.
 *
 * Deliberately noisy: recall over precision, because a missed secret costs far
 * more than a false positive. Everything it emits is a CANDIDATE and must be
 * verified against source before it appears in a report.
 *
 *   bun scan.ts [repo-path] [--json]
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : ".";
const AS_JSON = process.argv.includes("--json");

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", ".turbo",
  "coverage", ".venv", "__pycache__", "vendor", ".cache", "target",
]);
const SCAN_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yml", ".yaml",
  ".env", ".sql", ".py", ".vue", ".svelte", ".tf", ".sh",
]);

type Check = {
  id: number; name: string; severity: "P0" | "P1" | "P2";
  re: RegExp; why: string;
  /** narrow the noise: only flag when the file path matches */
  path?: RegExp;
  /** suppress when the same line also matches this */
  unless?: RegExp;
};

const CHECKS: Check[] = [
  { id: 1, name: "live secret literal", severity: "P0",
    re: /\b(sk_live_|rk_live_|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|xoxb-[0-9]{10,}|AIza[0-9A-Za-z_-]{30,})/,
    why: "a committed key is a leaked key — rotate, do not just delete" },
  { id: 1, name: "service-role key", severity: "P0",
    re: /service_role|SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i,
    why: "full database access; must never reach a client bundle" },
  { id: 1, name: "public-prefixed secret", severity: "P0",
    re: /\b(NEXT_PUBLIC_|VITE_|EXPO_PUBLIC_|PUBLIC_)\w*(SECRET|PRIVATE|SERVICE|TOKEN|API_KEY|PASSWORD)\w*/i,
    why: "this prefix ships the value to the browser",
    unless: /PUBLISHABLE|ANON_KEY|_URL\b/i },
  { id: 1, name: "hardcoded password/secret assignment", severity: "P1",
    re: /(password|secret|passwd|api_?key)\s*[:=]\s*["'][^"'{}$\s]{8,}["']/i,
    why: "credential in source",
    unless: /process\.env|import\.meta\.env|example|placeholder|changeme|xxx|your-|<.*>/i },

  { id: 2, name: "query keyed on request id", severity: "P1",
    re: /(findFirst|findUnique|findMany|delete|update)\s*\(\s*\{[^}]*\b(params|searchParams|body|query)\b/,
    why: "verify a session-user condition exists alongside the request id" },
  { id: 2, name: "RLS disabled", severity: "P0",
    re: /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    why: "table is readable by any authenticated client" },

  { id: 3, name: "mutating route handler", severity: "P1",
    re: /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/,
    why: "confirm an auth check precedes the mutation" },
  { id: 3, name: "server action", severity: "P1",
    re: /^\s*["']use server["']/m,
    why: "public HTTP endpoint despite looking local — needs its own auth check" },

  { id: 4, name: "client-side role check", severity: "P2",
    re: /\b(isAdmin|user\.role|session\.user\.role|hasPermission|role\s*===)/,
    path: /\.(tsx|jsx|vue|svelte)$/,
    why: "UI affordance only — confirm the same check exists server-side" },

  { id: 5, name: "webhook handler", severity: "P1",
    re: /webhook/i, path: /route\.(ts|js)$|webhook/i,
    why: "verify signature against the raw body, and store the event id for idempotency" },

  { id: 6, name: "unvalidated request body", severity: "P1",
    re: /(await\s+)?(req|request)\.(json|body)\s*\(?\)?/,
    why: "parse into a schema before it reaches a query",
    unless: /\.parse\(|\.safeParse\(|Value\.(Check|Decode)/ },
  { id: 6, name: "interpolated SQL", severity: "P0",
    re: /(sql`|\.(query|execute|raw|unsafe)\()[^;]*\$\{|(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^;`]*\b(FROM|WHERE|SET|VALUES|INTO)\b[^;`]*\$\{/i,
    why: "SQL injection — parameterize" },
  { id: 6, name: "spread of request body", severity: "P1",
    re: /\.\.\.(body|req\.body|data|input)\b[^)]*\}\s*\)/,
    why: "mass assignment — a user can set fields you did not intend, including role" },

  { id: 7, name: "wildcard CORS", severity: "P1",
    re: /Access-Control-Allow-Origin["'\s:=]+\*|origin:\s*["']\*["']|cors\(\s*\)/,
    why: "wildcard origin, especially with credentials" },
  { id: 7, name: "TLS verification disabled", severity: "P0",
    re: /rejectUnauthorized:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/,
    why: "disables certificate validation" },

  { id: 8, name: "public bucket / ACL", severity: "P1",
    re: /public:\s*true|ACL:\s*["']public-read|allUsers/,
    why: "user uploads readable without a signed URL" },
  { id: 8, name: "user-supplied upload path", severity: "P1",
    re: /(Key|key|path|filename)\s*:\s*[^,}]*\b(file\.name|originalname|params\.|body\.)/,
    why: "directory traversal — generate the filename server-side" },

  { id: 9, name: "unsafe HTML injection", severity: "P1",
    re: /dangerouslySetInnerHTML|v-html=|\.innerHTML\s*=/,
    why: "XSS if the value is user-controlled" },
  { id: 9, name: "unverified JWT", severity: "P0",
    re: /jwt\.decode\(|algorithms:\s*\[\s*["']none|verify:\s*false/,
    why: "decode is not verify — signature unchecked" },
];

type Hit = { file: string; line: number; check: Check; text: string };
const hits: Hit[] = [];
let scanned = 0;

function walk(dir: string) {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { walk(full); continue; }
    if (st.size > 1_500_000) continue;
    const ext = extname(name);
    if (!SCAN_EXT.has(ext) && !name.startsWith(".env")) continue;
    scan(full);
  }
}

function scan(file: string) {
  let src: string;
  try { src = readFileSync(file, "utf8"); } catch { return; }
  scanned++;
  const rel = relative(ROOT, file) || file;
  const lines = src.split("\n");
  for (const check of CHECKS) {
    if (check.path && !check.path.test(rel)) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 600) continue;
      if (!check.re.test(line)) continue;
      if (check.unless && check.unless.test(line)) continue;
      hits.push({ file: rel, line: i + 1, check, text: line.trim().slice(0, 160) });
    }
  }
}

/** Never print a discovered secret in full. */
function redact(s: string): string {
  return s.replace(
    /\b(sk_live_|sk_test_|rk_live_|ghp_|gho_|xoxb-|AIza|AKIA)([A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g,
    (_m, p, q) => `${p}${q}…[redacted]`,
  );
}

if (!existsSync(ROOT)) { console.error(`no such path: ${ROOT}`); process.exit(1); }
walk(ROOT);

// Committed .env is checked separately — its presence, not its contents.
const envTracked = ["\.env", ".env.local", ".env.production"]
  .map((f) => join(ROOT, f.replace("\\", "")))
  .filter((p) => existsSync(p));

if (AS_JSON) {
  console.log(JSON.stringify({
    scanned, hits: hits.map((h) => ({
      check: h.check.id, name: h.check.name, severity: h.check.severity,
      file: h.file, line: h.line, why: h.check.why, text: redact(h.text),
    })), envFiles: envTracked,
  }, null, 2));
} else {
  const order = { P0: 0, P1: 1, P2: 2 } as const;
  hits.sort((a, b) =>
    order[a.check.severity] - order[b.check.severity] ||
    a.check.id - b.check.id || a.file.localeCompare(b.file));
  const byCheck = new Map<string, Hit[]>();
  for (const h of hits) {
    const k = `${h.check.severity} · check ${h.check.id} · ${h.check.name}`;
    (byCheck.get(k) ?? byCheck.set(k, []).get(k)!).push(h);
  }
  console.log(`scanned ${scanned} files · ${hits.length} candidates\n`);
  if (envTracked.length) {
    console.log(`!! env files present on disk — confirm they are git-ignored:`);
    for (const e of envTracked) console.log(`   ${relative(ROOT, e)}`);
    console.log();
  }
  for (const [key, group] of byCheck) {
    console.log(`── ${key}  (${group.length})`);
    console.log(`   ${group[0].check.why}`);
    for (const h of group.slice(0, 12)) {
      console.log(`   ${h.file}:${h.line}  ${redact(h.text)}`);
    }
    if (group.length > 12) console.log(`   … ${group.length - 12} more`);
    console.log();
  }
  if (!hits.length) console.log("no candidates — still run the read-with-your-eyes checks in references/checks.md");
  console.log("CANDIDATES ONLY. Verify each against source before reporting.");
}
