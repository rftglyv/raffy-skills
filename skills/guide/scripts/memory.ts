#!/usr/bin/env bun
/**
 * What this project decided, and why — kept across sessions.
 *
 *   bun memory.ts remember [project] --kind decision|fact|pref --text "…" --why "…" [--user] [--tags a,b]
 *   bun memory.ts recall   [project] [query…] [-n 5]     ranked by keywords, plus meaning when vectors are on
 *   bun memory.ts forget   [project] <id> [--why "…"]    marks an entry superseded; nothing is deleted
 *   bun memory.ts brief    [project]                     ≤10 lines for session start: phase, last steps, decisions
 *
 * Files (append-only JSONL, one entry per line):
 *   <project>/.raffy/memory.jsonl     decisions and facts — follows the repo, reviewable in a diff
 *   ~/.claude/raffy/memory.jsonl      preferences — follow the person (--user)
 *
 * Memory holds WHY. It never holds a map of the code — that goes stale the day
 * the code changes; graphify rebuilds it from source instead.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { RAFFY_HOME, embedder, vectorDb, dot, fromBlob, toBlob } from "./embed.ts";

export type Entry = { id: string; at: string; kind: "decision" | "fact" | "pref"; text: string; why?: string; tags?: string[]; status?: "superseded"; supersedes?: string };
const KINDS = ["decision", "fact", "pref"];

const projectFile = (p: string) => join(p, ".raffy", "memory.jsonl");
const userFile = () => join(RAFFY_HOME, "memory.jsonl");

function read(file: string): Entry[] {
  if (!existsSync(file)) return [];
  const all = readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l) as Entry]; } catch { return []; } });
  // Later lines win: a tombstone line with the same id marks the entry superseded.
  const byId = new Map<string, Entry>();
  for (const e of all) byId.set(e.id, { ...byId.get(e.id), ...e });
  return [...byId.values()];
}

/** Active entries for a project, project scope first, then the user's preferences. */
export function active(project: string): (Entry & { scope: "project" | "user" })[] {
  return [
    ...read(projectFile(project)).map((e) => ({ ...e, scope: "project" as const })),
    ...read(userFile()).map((e) => ({ ...e, scope: "user" as const })),
  ].filter((e) => e.status !== "superseded");
}

const line = (e: Entry & { scope?: string }) =>
  `${e.at.slice(0, 10)} ${e.kind}${e.scope === "user" ? " (you)" : ""} · ${e.text}${e.why ? ` — why: ${e.why}` : ""}  [${e.id}]`;

async function rank(project: string, query: string, n: number) {
  const entries = active(project);
  const q = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const kw = (e: Entry) => { const hay = `${e.text} ${e.why ?? ""} ${(e.tags ?? []).join(" ")}`.toLowerCase(); return q.filter((w) => hay.includes(w)).length; };

  const sims = new Map<string, number>();
  const embed = q.length ? await embedder() : null;
  if (embed) {
    const db = vectorDb(true)!;
    db.run("CREATE TABLE IF NOT EXISTS memory (key TEXT PRIMARY KEY, vec BLOB)");
    const key = (e: Entry) => `${resolve(project)}#${e.id}`;
    const have = new Map((db.query("SELECT key, vec FROM memory").all() as { key: string; vec: Uint8Array }[]).map((r) => [r.key, fromBlob(r.vec)]));
    const missing = entries.filter((e) => !have.has(key(e)));
    if (missing.length) {
      const vecs = await embed(missing.map((e) => `${e.text}. ${e.why ?? ""}`));
      const ins = db.prepare("INSERT OR REPLACE INTO memory (key, vec) VALUES (?, ?)");
      missing.forEach((e, i) => { ins.run(key(e), toBlob(vecs[i])); have.set(key(e), vecs[i]); });
    }
    const [qv] = await embed([query]);
    for (const e of entries) sims.set(e.id, dot(qv, have.get(key(e))!));
  }

  return entries
    .map((e) => ({ e, s: q.length ? kw(e) * 10 + Math.max(0, (sims.get(e.id) ?? 0) - 0.25) * 40 : Date.parse(e.at) }))
    .filter((x) => !q.length || x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.e);
}

export function brief(project: string, afterCompact = false): string[] {
  const out: string[] = [];
  const j = spawnSync("bun", [join(import.meta.dir, "journey.ts"), "where", project, "--json"], { encoding: "utf8" });
  try {
    const w = JSON.parse(j.stdout);
    const last = w.last ? ` · last: ${w.last.skill} ${w.last.status}${w.last.note ? ` — ${w.last.note}` : ""}` : "";
    out.push(`raffy · ${basename(resolve(project))} · phase ${w.phase} (${w.confidence})${w.open ? "" : last}`);
    if (w.open) {
      const mins = Math.round((Date.now() - Date.parse(w.open.at)) / 60000);
      out.push(`${afterCompact ? "context was compacted — resume this: " : "in progress: "}${w.open.skill} (started ${mins < 90 ? `${mins}m` : `${Math.round(mins / 60)}h`} ago) — ${w.open.why ?? w.open.note ?? ""}`);
      if (w.open.checkpoint) out.push(`  last checkpoint: ${w.open.checkpoint}`);
    }
  } catch {}
  const decisions = active(project).filter((e) => e.kind !== "pref").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  const prefs = active(project).filter((e) => e.kind === "pref").slice(0, 3);
  if (decisions.length) { out.push("decided:"); for (const e of decisions) out.push(`  ${e.text}${e.why ? ` — ${e.why}` : ""}`); }
  if (prefs.length) out.push(`you prefer: ${prefs.map((e) => e.text).join("; ")}`);
  return out.slice(0, 10);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flag = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined; };
  const rest = argv.slice(1).filter((a, i, all) => !a.startsWith("-") && !all[i - 1]?.startsWith("-"));
  // First positional is a project path only if it is a directory.
  const isDir = (p?: string) => !!p && existsSync(p) && (() => { try { return require("node:fs").statSync(p).isDirectory(); } catch { return false; } })();
  const project = resolve(isDir(rest[0]) ? rest.shift()! : ".");

  switch (cmd) {
    case "remember": {
      const kind = flag("--kind") ?? "decision", text = flag("--text");
      if (!text) { console.error("remember needs --text"); process.exit(2); }
      if (!KINDS.includes(kind)) { console.error(`--kind is one of ${KINDS.join(", ")}`); process.exit(2); }
      const user = argv.includes("--user") || kind === "pref";
      const e: Entry = { id: Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), kind: kind as Entry["kind"], text };
      const why = flag("--why"); if (why) e.why = why;
      const tags = flag("--tags"); if (tags) e.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const file = user ? userFile() : projectFile(project);
      mkdirSync(join(file, ".."), { recursive: true });
      appendFileSync(file, JSON.stringify(e) + "\n");
      console.log(`remembered ${e.kind} [${e.id}]${user ? " for you, across projects" : ` in ${basename(project)}`}`);
      break;
    }
    case "recall": {
      const hits = await rank(project, rest.join(" "), Number(flag("-n") ?? 5));
      if (!hits.length) { console.log(rest.length ? "nothing remembered about that" : "nothing remembered yet"); break; }
      for (const e of hits) console.log(line(e));
      break;
    }
    case "forget": {
      const id = rest[0];
      const hit = active(project).find((e) => e.id === id);
      if (!hit) { console.error(`no active entry ${id}`); process.exit(1); }
      const file = hit.scope === "user" ? userFile() : projectFile(project);
      appendFileSync(file, JSON.stringify({ id, status: "superseded", why: flag("--why") ?? hit.why }) + "\n");
      console.log(`superseded [${id}] — still in the file, no longer recalled`);
      break;
    }
    case "brief": {
      const b = brief(project);
      if (b.length) console.log(b.join("\n"));
      break;
    }
    default:
      console.error("usage: memory.ts remember|recall|forget|brief [project] …");
      process.exit(2);
  }
}
