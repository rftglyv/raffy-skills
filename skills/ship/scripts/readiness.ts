#!/usr/bin/env bun
/**
 * Mechanical pass over the twelve readiness items in references/readiness.md.
 *
 * Reports what it can SEE. It cannot report what it cannot RUN — a migration
 * directory proves migrations exist, not that the deploy applies them, and no
 * script can tell you a restore works. Those come back as MANUAL, and the
 * skill's Phase 3 is where they get executed.
 *
 *   bun readiness.ts [repo-path] [--json]
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : ".";
const AS_JSON = process.argv.includes("--json");

type Status = "present" | "partial" | "missing" | "manual";
type Item = { n: number; group: string; name: string; status: Status; note: string };
const items: Item[] = [];
const add = (n: number, group: string, name: string, status: Status, note: string) =>
  items.push({ n, group, name, status, note });

const p = (f: string) => join(ROOT, f);
const has = (f: string) => existsSync(p(f));
const read = (f: string) => { try { return readFileSync(p(f), "utf8"); } catch { return ""; } };
const git = (...a: string[]) =>
  spawnSync("git", ["-C", ROOT, ...a], { encoding: "utf8" }).stdout?.trim() ?? "";

/** Search source files for a pattern. Cheap recursive walk, skips the usual noise. */
function grep(re: RegExp, exts = [".ts", ".tsx", ".js", ".mjs", ".py"]): string[] {
  const out: string[] = [];
  const skip = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv", "coverage"]);
  (function walk(dir: string, depth = 0) {
    if (depth > 6 || out.length > 5) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (skip.has(name)) continue;
      const full = join(dir, name);
      let st; try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { walk(full, depth + 1); continue; }
      if (!exts.some((e) => name.endsWith(e)) || st.size > 500_000) continue;
      try { if (re.test(readFileSync(full, "utf8"))) out.push(full.replace(ROOT + "/", "")); }
      catch { /* unreadable file is not a signal */ }
    }
  })(ROOT);
  return out;
}

const pkg = (() => { try { return JSON.parse(read("package.json")); } catch { return {}; } })();
const scripts: Record<string, string> = pkg.scripts ?? {};
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const isGit = existsSync(p(".git")) || git("rev-parse", "--is-inside-work-tree") === "true";

// ── Config ──────────────────────────────────────────────────────────────────
const example = [".env.example", ".env.sample", ".env.template"].find(has);
add(1, "config", "environment separation", example ? "present" : "missing",
  example ? `${example} present` : "no .env.example — nobody can reproduce your environment");

if (!isGit) {
  add(2, "config", "secrets in a real store", "manual", "not a git repo — cannot check history");
} else {
  const tracked = git("ls-files").split("\n").filter((f) => /^\.env($|\.)/.test(f) && !/example|sample|template/.test(f));
  const history = git("log", "--all", "--oneline", "--", ".env", ".env.local", ".env.production");
  add(2, "config", "secrets in a real store",
    tracked.length ? "missing" : history ? "partial" : "present",
    tracked.length ? `TRACKED IN GIT: ${tracked.join(", ")} — rotate every key`
      : history ? "a .env appears in git history — those keys must be rotated"
      : "no .env tracked or in history");
}

const envCheck = grep(/(z\.object|Type\.Object|envsafe|createEnv)[\s\S]{0,400}process\.env|process\.env[\s\S]{0,200}\.parse\(/);
add(3, "config", "env validated at boot", envCheck.length ? "present" : "missing",
  envCheck.length ? envCheck[0] : "no schema over process.env — a missing var fails at 3am, not at boot");

// ── Data ────────────────────────────────────────────────────────────────────
const migDirs = ["migrations", "drizzle", "prisma/migrations", "alembic/versions", "db/migrate"]
  .filter((d) => has(d) && (() => { try { return readdirSync(p(d)).length > 0; } catch { return false; } })());
add(4, "data", "migrations versioned", migDirs.length ? "present" : "missing",
  migDirs.length ? `${migDirs.join(", ")} — VERIFY the deploy applies them` : "no migration files — the most expensive item to retrofit");

const seed = Object.keys(scripts).find((k) => /seed/.test(k));
add(5, "data", "seed + rollback path", seed ? "present" : "missing",
  seed ? `script: ${seed}` : "no seed script — a fresh clone cannot reach a working state");

add(6, "data", "backups with a TESTED restore", "manual",
  "no script can verify this. Take a backup, restore into a scratch db, count rows, note the time");

// ── Runtime ─────────────────────────────────────────────────────────────────
const timeouts = grep(/AbortSignal\.timeout|signal:\s*controller|timeout:\s*\d+|AbortController/);
add(7, "runtime", "error handling at boundaries", timeouts.length ? "partial" : "missing",
  timeouts.length ? `timeouts found in ${timeouts.length} file(s) — verify every external call has one`
    : "no timeouts found on external calls — one slow dependency takes the app down");

const logger = ["pino", "winston", "consola", "@logtail/node"].find((d) => d in deps);
const reqId = grep(/requestId|request_id|x-request-id|correlationId/i);
add(8, "runtime", "structured logs + request ids",
  logger && reqId.length ? "present" : logger || reqId.length ? "partial" : "missing",
  [logger ? `logger: ${logger}` : "no structured logger",
   reqId.length ? "request id present" : "no request id"].join(" · "));

const health = grep(/\/health|\/healthz|\/api\/health|readiness/);
add(9, "runtime", "health check", health.length ? "partial" : "missing",
  health.length ? `${health[0]} — VERIFY it fails when the database is down` : "no health endpoint");

// ── Delivery ────────────────────────────────────────────────────────────────
let ci: Status = "missing", ciNote = "no CI workflows";
if (has(".github/workflows")) {
  const files = readdirSync(p(".github/workflows"));
  const body = files.map((f) => read(join(".github/workflows", f))).join("\n");
  const gates = [/test/i.test(body) && "test", /tsc|typecheck|type-check/i.test(body) && "typecheck",
                 /build/i.test(body) && "build"].filter(Boolean);
  ci = gates.length >= 2 ? "present" : "partial";
  ciNote = `${files.length} workflow(s) · gates: ${gates.join(", ") || "none"}`;
}
add(10, "delivery", "CI gates the merge", ci, ciNote);

const deployDoc = ["DEPLOY.md", "docs/DEPLOY.md", "DEPLOYMENT.md", "RUNBOOK.md"].find(has);
const rollback = deployDoc && /roll ?back|revert/i.test(read(deployDoc));
add(11, "delivery", "one-command rollback", rollback ? "partial" : "missing",
  rollback ? `${deployDoc} documents it — RUN IT ONCE before you need it`
    : deployDoc ? `${deployDoc} exists but never mentions rollback` : "no deploy doc");

const staging = /staging|preview/i.test(
  read(".github/workflows/deploy.yml") + Object.keys(scripts).join(" ") +
  (has(".github/workflows") ? readdirSync(p(".github/workflows")).join(" ") : ""));
add(12, "delivery", "staging environment", staging ? "partial" : "missing",
  staging ? "referenced in CI — verify it has its own database" : "no staging referenced");

// ── report ──────────────────────────────────────────────────────────────────
if (AS_JSON) {
  console.log(JSON.stringify({ root: ROOT, items }, null, 2));
} else {
  const mark: Record<Status, string> = {
    present: "  ok  ", partial: " ~~~  ", missing: " !!   ", manual: "  ?   ",
  };
  let group = "";
  console.log(`readiness · ${ROOT}\n`);
  for (const it of items) {
    if (it.group !== group) { group = it.group; console.log(`${group.toUpperCase()}`); }
    console.log(`${mark[it.status]}${String(it.n).padStart(2)} ${it.name.padEnd(32)} ${it.note}`);
  }
  const c = (s: Status) => items.filter((i) => i.status === s).length;
  console.log(`\n${c("present")} present · ${c("partial")} partial · ${c("missing")} missing · ${c("manual")} manual`);
  console.log("\nPARTIAL means the artifact exists but was not executed. An item is done when you have run it.");
}
