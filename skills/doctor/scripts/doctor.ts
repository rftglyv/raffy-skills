#!/usr/bin/env bun
/**
 * What your Claude Code setup costs before you type, and whether your skills
 * can actually be found.
 *
 *   bun doctor.ts budget [project] [--run-hooks] [--json]   startup context, per source, in estimated tokens
 *   bun doctor.ts skills [project] [--json]                 weak descriptions and overlapping skills
 *   bun doctor.ts fire "<sentence>" [-n 5]                  which skills a sentence most resembles
 *   bun doctor.ts unlink <skill>                            reverse of catalog.ts enable (symlinks only)
 *
 * Tokens are ESTIMATES (characters ÷ 4). They rank sources reliably; they are
 * not the exact count Claude Code sends. `fire` is a similarity ranking, not a
 * replay of the model's choice — say so whenever you show it.
 *
 * Reads everything, writes nothing except `unlink`, which only ever removes a
 * symlink in ~/.claude/skills that points into ~/.agents/skills.
 */
import { existsSync, readFileSync, readdirSync, lstatSync, readlinkSync, unlinkSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { scan, pluginRoot, type Skill } from "../../guide/scripts/inventory.ts";
import { load as loadCatalog } from "../../guide/scripts/catalog.ts";
import { embedder, dot } from "../../guide/scripts/embed.ts";

const HOME = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
const tok = (s: string) => Math.ceil(s.length / 4);
const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined; };
const positional = argv.slice(1).filter((a, i, all) => !a.startsWith("-") && !all[i - 1]?.startsWith("-"));
const AS_JSON = argv.includes("--json");
const read = (f: string) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };

type Source = { kind: string; name: string; tokens: number; note?: string };

/** CLAUDE.md files Claude Code loads for a project: user, then each folder from home down, then local. */
function claudeMds(project: string): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const add = (f: string) => {
    const text = read(f);
    if (!text) return;
    // One level of @imports, the common case.
    const imports = [...text.matchAll(/^@(\S+)/gm)].map((m) => resolve(dirname(f), m[1].replace(/^~/, homedir())));
    out.push({ file: f, text: text + imports.map(read).join("\n") });
  };
  add(join(HOME, "CLAUDE.md"));
  const dirs: string[] = [];
  for (let d = resolve(project); d !== dirname(d) && d.startsWith(homedir()) && d !== homedir(); d = dirname(d)) dirs.unshift(d);
  for (const d of dirs) { add(join(d, "CLAUDE.md")); add(join(d, ".claude", "CLAUDE.md")); }
  add(join(resolve(project), "CLAUDE.local.md"));
  return out;
}

function hooksOf(settingsFile: string): { event: string; command: string }[] {
  try {
    const h = JSON.parse(read(settingsFile)).hooks ?? {};
    return Object.entries<any[]>(h).flatMap(([event, groups]) => groups.flatMap((g) => (g.hooks ?? []).map((x: any) => ({ event, command: String(x.command ?? "") }))));
  } catch { return []; }
}

function pluginHooks(): { event: string; command: string; plugin: string; root: string }[] {
  const manifest = join(HOME, "plugins", "installed_plugins.json");
  if (!existsSync(manifest)) return [];
  const out: { event: string; command: string; plugin: string; root: string }[] = [];
  for (const [key, installs] of Object.entries<any[]>(JSON.parse(read(manifest)).plugins ?? {})) {
    const picked = installs.find((i) => i.scope === "user")?.installPath ?? installs[0]?.installPath;
    const root = picked && pluginRoot(key, picked);
    if (!root) continue;
    for (const h of hooksOf(join(root, "hooks", "hooks.json"))) out.push({ ...h, plugin: key.split("@")[0], root });
  }
  return out;
}

function budget(project: string) {
  const sources: Source[] = [];
  const inv = scan(project);

  // Every listed skill puts its name and description into every session.
  const byOwner = new Map<string, Skill[]>();
  for (const s of inv.skills) {
    const owner = s.source === "plugin" ? `plugin ${s.plugin}` : s.source === "command" ? (s.plugin ? `plugin ${s.plugin} commands` : "commands") : `${s.source} skills`;
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), s]);
  }
  for (const [owner, list] of byOwner) {
    sources.push({ kind: "skills", name: `${owner} (${list.length})`, tokens: list.reduce((n, s) => n + tok(`- ${s.id}: ${s.description}\n`), 0) });
  }

  for (const { file, text } of claudeMds(project)) sources.push({ kind: "CLAUDE.md", name: file.replace(homedir(), "~"), tokens: tok(text) });

  const memory = join(HOME, "projects", resolve(project).replace(/[/.]/g, "-"), "memory", "MEMORY.md");
  if (existsSync(memory)) sources.push({ kind: "memory", name: memory.replace(homedir(), "~"), tokens: tok(read(memory)) });

  // Hook output is only knowable by running the hook. Off by default: running
  // someone else's hook is their code, on your machine.
  const hooks = [
    ...hooksOf(join(HOME, "settings.json")).map((h) => ({ ...h, owner: "user settings", root: "" })),
    ...hooksOf(join(project, ".claude", "settings.json")).map((h) => ({ ...h, owner: "project settings", root: "" })),
    ...pluginHooks().map((h) => ({ ...h, owner: `plugin ${h.plugin}` })),
  ].filter((h) => h.event === "SessionStart" || h.event === "UserPromptSubmit");
  for (const h of hooks) {
    let tokens = 0, note = h.event === "UserPromptSubmit" ? "runs on every prompt" : "runs at session start";
    if (argv.includes("--run-hooks") && h.event === "SessionStart") {
      const cmdText = h.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, h.root);
      const r = spawnSync("sh", ["-c", cmdText], { input: JSON.stringify({ cwd: resolve(project), source: "startup", hook_event_name: "SessionStart" }), encoding: "utf8", timeout: 5000, env: { ...process.env, CLAUDE_PLUGIN_ROOT: h.root } });
      tokens = tok(r.stdout ?? "");
      note += " · measured";
    } else note += " · not measured (--run-hooks)";
    sources.push({ kind: "hook", name: `${h.owner}: ${h.event}`, tokens, note });
  }

  // MCP tools load as names only until used (deferred), so servers cost little up front.
  let servers: string[] = [];
  try { servers = Object.keys(JSON.parse(read(join(homedir(), ".claude.json"))).mcpServers ?? {}); } catch {}
  try { servers.push(...Object.keys(JSON.parse(read(join(project, ".mcp.json"))).mcpServers ?? {})); } catch {}
  if (servers.length) sources.push({ kind: "mcp", name: `${servers.length} servers (${servers.join(", ")})`, tokens: 0, note: "tool names only until a tool is loaded" });

  // What to cut: active skills the catalog ranks rare or skip. Unlinking keeps them findable as dormant.
  const catalog = new Map(loadCatalog().map((r) => [r.id, r]));
  const cut = inv.skills
    .map((s) => ({ s, row: catalog.get(s.id) ?? catalog.get(s.name) }))
    .filter(({ s, row }) => row && (row.tier === "rare" || row.tier === "skip") && s.source !== "command")
    .map(({ s, row }) => {
      let how = s.source === "plugin" ? `disable plugin ${s.plugin} if you never use it` : "keep";
      try { if (s.source === "user" && lstatSync(join(HOME, "skills", s.name)).isSymbolicLink()) how = `doctor.ts unlink ${s.name}`; } catch {}
      return { id: s.id, tier: row!.tier, tokens: tok(`- ${s.id}: ${s.description}\n`), how };
    })
    .sort((a, b) => b.tokens - a.tokens);
  const long = inv.skills.filter((s) => s.description.length > 400).map((s) => ({ id: s.id, chars: s.description.length })).sort((a, b) => b.chars - a.chars);

  sources.sort((a, b) => b.tokens - a.tokens);
  const total = sources.reduce((n, s) => n + s.tokens, 0);
  return { project: resolve(project), total, sources, cut, long };
}

// Descriptions are the only thing Claude sees when deciding to load a skill.
const TRIGGER = /\b(use (it |this )?(when|for|whenever|if|before|after)|when (the )?user|triggers?:|use proactively|must use|always use|invoke (when|for))\b/i;
const DIRECTIVE = /^(always|must|use|invoke|run|mandatory)\b|\b(must|always) (use|invoke|load)\b/i;

function lint(s: Skill): string[] {
  const d = s.description, out: string[] = [];
  if (!d) return ["no description — it can never be chosen"];
  if (d.length < 80) out.push(`short (${d.length} chars) — too little to match on`);
  if (d.length > 600) out.push(`long (${d.length} chars) — paid for in every session`);
  if (!TRIGGER.test(d)) out.push("no trigger phrase (\"Use when…\") — the model has to guess when it applies");
  return out;
}

function words(s: string) { return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)); }
function jaccard(a: Set<string>, b: Set<string>) { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); }

async function skills(project: string) {
  const inv = scan(project).skills.filter((s) => s.source !== "command");
  const weak = inv.map((s) => ({ id: s.id, problems: lint(s), directive: DIRECTIVE.test(s.description) })).filter((x) => x.problems.length);
  // Overlap has two sources. The guide's collision table is judgment someone
  // checked; similarity only suggests. Measured on known overlapping pairs,
  // MiniLM scores 0.42–0.65 — the same band as the top 5% of unrelated pairs —
  // so similarity alone cannot be trusted to call an overlap.
  const active = new Set(inv.flatMap((s) => [s.id, s.name]));
  const table = read(join(import.meta.dir, "..", "..", "guide", "knowledge", "skills.md"));
  const confirmed = table.slice(table.indexOf("| Job |"), table.indexOf("\n---")).split("\n").slice(2)
    .map((row) => ({ job: row.split("|")[1]?.trim() ?? "", ids: [...new Set([...row.matchAll(/`([a-z0-9:-]+)`/g)].map((m) => m[1]))].filter((id) => active.has(id)) }))
    .filter((g) => g.job && g.ids.length > 1);
  const embed = await embedder();
  const vecs = embed ? await embed(inv.map((s) => s.description || s.id)) : null;
  const inTable = (a: string, b: string) => confirmed.some((g) => g.ids.includes(a) && g.ids.includes(b));
  const pairs: { a: string; b: string; score: number; by: string }[] = [];
  for (let i = 0; i < inv.length; i++) for (let j = i + 1; j < inv.length; j++) {
    const score = vecs ? dot(vecs[i], vecs[j]) : jaccard(words(inv[i].description), words(inv[j].description));
    if (score >= (vecs ? 0.55 : 0.45) && !inTable(inv[i].id, inv[j].id)) pairs.push({ a: inv[i].id, b: inv[j].id, score: +score.toFixed(2), by: vecs ? "meaning" : "words" });
  }
  pairs.sort((a, b) => b.score - a.score);
  return { total: inv.length, weak, confirmed, overlaps: pairs.slice(0, 20), directive: inv.filter((s) => DIRECTIVE.test(s.description)).length };
}

async function fire(sentence: string, n: number) {
  const inv = scan(".").skills;
  const embed = await embedder();
  if (embed) {
    const [q, ...vs] = await embed([sentence, ...inv.map((s) => `${s.id}: ${s.description}`)]);
    return { by: "meaning", hits: inv.map((s, i) => ({ id: s.id, score: +dot(q, vs[i]).toFixed(2) })).sort((a, b) => b.score - a.score).slice(0, n) };
  }
  const q = words(sentence);
  return { by: "words", hits: inv.map((s) => ({ id: s.id, score: +jaccard(q, words(`${s.id} ${s.description}`)).toFixed(2) })).sort((a, b) => b.score - a.score).slice(0, n) };
}

if (import.meta.main) {
  const project = positional[0] && existsSync(positional[0]) && statSync(positional[0]).isDirectory() ? positional[0] : ".";
  switch (cmd) {
    case "budget": {
      const b = budget(project);
      if (AS_JSON) { console.log(JSON.stringify(b, null, 2)); break; }
      console.log(`~${b.total.toLocaleString()} tokens load before your first prompt in ${basename(b.project)} (estimate: chars ÷ 4)\n`);
      for (const s of b.sources.slice(0, 12)) console.log(`  ${String(s.tokens).padStart(6)}  ${s.kind.padEnd(9)} ${s.name}${s.note ? `  — ${s.note}` : ""}`);
      if (b.cut.length) {
        const saved = b.cut.reduce((n, c) => n + c.tokens, 0);
        console.log(`\nrarely needed but loaded every session: ${b.cut.length} skills, ~${saved} tokens`);
        for (const c of b.cut.slice(0, 8)) console.log(`  ${String(c.tokens).padStart(5)}  ${c.id.padEnd(36)} ${c.tier} · ${c.how}`);
      }
      if (b.long.length) console.log(`\nlongest descriptions: ${b.long.slice(0, 5).map((l) => `${l.id} (${l.chars})`).join(", ")}`);
      break;
    }
    case "skills": {
      const r = await skills(project);
      if (AS_JSON) { console.log(JSON.stringify(r, null, 2)); break; }
      console.log(`${r.total} skills · ${r.weak.length} with weak descriptions · ${r.confirmed.length} jobs with competing skills · ${r.directive} use directive wording`);
      for (const w of r.weak.slice(0, 10)) console.log(`  ${w.id.padEnd(40)} ${w.problems.join("; ")}`);
      if (r.confirmed.length) { console.log("\ncompeting for the same job (from the guide's collision table — /raffy:guide picks between them):"); for (const g of r.confirmed) console.log(`  ${g.job.padEnd(22)} ${g.ids.join(" · ")}`); }
      if (r.overlaps.length) { console.log("\npossibly overlapping (similar descriptions — unconfirmed):"); for (const p of r.overlaps.slice(0, 8)) console.log(`  ${p.score.toFixed(2)}  ${p.a}  ↔  ${p.b}`); }
      break;
    }
    case "fire": {
      const r = await fire(positional.join(" "), Number(flag("-n") ?? 5));
      console.log(`closest by ${r.by} — an estimate, not the model's actual choice:`);
      for (const h of r.hits) console.log(`  ${h.score.toFixed(2)}  ${h.id}`);
      if (r.by === "meaning" && (r.hits[0]?.score ?? 0) < 0.3) console.log("no skill clearly matches (all below 0.30): the descriptions don't use this request's words. /raffy:guide can still route it — it rewrites the request first.");
      break;
    }
    case "unlink": {
      const name = positional[0];
      const link = join(HOME, "skills", name ?? "");
      let target = "";
      try { if (lstatSync(link).isSymbolicLink()) target = readlinkSync(link); } catch {}
      if (!name || !target) { console.error(`${link} is not a symlink — doctor only unlinks skills linked from ~/.agents/skills`); process.exit(1); }
      if (!resolve(dirname(link), target).startsWith(join(homedir(), ".agents", "skills"))) { console.error(`${name} points to ${target}, not ~/.agents/skills — not touching it`); process.exit(1); }
      if (!argv.includes("--yes")) { console.log(`would remove the link ${link} → ${target}. The skill stays on disk; catalog.ts enable ${name} brings it back. Rerun with --yes.`); break; }
      unlinkSync(link);
      console.log(`unlinked ${name} — gone from the next session's skill list; still findable as dormant`);
      break;
    }
    default:
      console.error("usage: doctor.ts budget|skills|fire|unlink …");
      process.exit(2);
  }
}
