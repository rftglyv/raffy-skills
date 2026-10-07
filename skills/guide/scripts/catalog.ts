#!/usr/bin/env bun
/**
 * Every skill this machine has, ranked for a job — without loading them all
 * into context.
 *
 *   bun catalog.ts find <words…> [--phase p] [--domain d] [-n 5] [--all]
 *   bun catalog.ts stats [project]       tiers × availability, plus skills the catalog does not know
 *   bun catalog.ts enable <id> [--yes]   link a dormant skill from ~/.agents/skills into Claude
 *
 * Rows come from two files: knowledge/catalog.tsv (curated, ships with raffy)
 * and ~/.claude/raffy/catalog.local.tsv (learned by /raffy:setup from this
 * machine's own skills). A curated row wins over a learned one with the same id.
 *
 * Availability, worked out now rather than stored:
 *   active   Claude can invoke it in this project
 *   bundled  shipped in raffy's library/ — read its SKILL.md and follow it, no install
 *   dormant  on disk in ~/.agents/skills, not linked — `enable` fixes that
 *   project  lives inside another repo only
 *   missing  named in the catalog, not on this machine
 *
 * Ranking is keywords, plus local embeddings when setup has installed them.
 * Output is one line per hit by design: the guide reads three of these, not
 * eighty descriptions.
 */
import { readFileSync, existsSync, symlinkSync, lstatSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";
import { scan } from "./inventory.ts";
import { embedder, vectorDb, dot, fromBlob, RAFFY_HOME } from "./embed.ts";

const CATALOG = join(import.meta.dir, "..", "knowledge", "catalog.tsv");
export const LOCAL_CATALOG = join(RAFFY_HOME, "catalog.local.tsv");
export const LIBRARY = resolve(import.meta.dir, "..", "..", "..", "library");
const AGENTS = join(homedir(), ".agents", "skills");
const CLAUDE_SKILLS = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "skills");

export type Row = { id: string; tier: string; phase: string; domain: string; src: string; when: string; learned?: boolean };
export type Hit = { r: Row; st: string; kw: number; sim: number; s: number; hint: string };
const TIER_WEIGHT: Record<string, number> = { core: 3, often: 2, rare: 1, skip: 0 };

const parse = (file: string, learned: boolean): Row[] =>
  !existsSync(file) ? [] : readFileSync(file, "utf8").split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => { const [id, tier, phase, domain, src, when] = l.split("\t"); return { id, tier, phase, domain, src, when, learned }; })
    .filter((r) => r.id && r.when);

export function load(): Row[] {
  const curated = parse(CATALOG, false);
  const ids = new Set(curated.map((r) => r.id));
  return [...curated, ...parse(LOCAL_CATALOG, true).filter((r) => !ids.has(r.id))];
}

const bundledIndex = (): Map<string, string> =>
  new Map(existsSync(join(LIBRARY, "INDEX.tsv"))
    ? readFileSync(join(LIBRARY, "INDEX.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => { const [id, dir] = l.split("\t"); return [id, dir] as [string, string]; })
    : []);

const bare = (id: string) => id.split(":").pop()!;

export function availability(rows: Row[], project: string) {
  const inv = scan(project);
  const active = new Set(inv.skills.flatMap((s) => [s.id, s.name]));
  const bundled = bundledIndex();
  const here = basename(resolve(project));
  const status = (r: Row): string => {
    if (r.src === "builtin" || r.src === "raffy") return "active";  // the catalog runs from inside raffy
    if (active.has(r.id)) return "active";
    // A user skill linked from ~/.agents shows up under its bare name.
    if (!r.id.includes(":") && active.has(bare(r.id))) return "active";
    if (r.src.startsWith("project:") && r.src.slice(8) === here) return "active";
    if (bundled.has(r.id)) return "bundled";
    if (r.src.startsWith("project:")) return "project";
    if (existsSync(join(AGENTS, bare(r.id), "SKILL.md"))) return "dormant";
    return "missing";
  };
  const hint = (r: Row, st: string) =>
    st === "bundled" ? `read library/${bundled.get(r.id)}/SKILL.md`
    : st === "dormant" ? "enable to use"
    : st === "project" ? `in ${r.src.slice(8)}`
    : st === "missing" ? "not installed" : "";
  const known = new Set(rows.flatMap((r) => [r.id, bare(r.id)]));
  const unknown = inv.skills.filter((s) => !known.has(s.id) && !known.has(s.name));
  return { status, hint, unknown };
}

// Plain-English requests use words the one-line `when` never says. A short map
// covers the common ones; embeddings, when installed, cover the rest.
const STOP = new Set("the and for with how want need help make my our this that from into first please can should get".split(" "));
const SYN: Record<string, string[]> = {
  google: ["seo"], rank: ["seo"], ranking: ["seo"], search: ["seo", "search"], traffic: ["seo"],
  tests: ["test"], testing: ["test"], tdd: ["test"], unit: ["test"],
  slow: ["slow", "performance"], crash: ["bug"], broken: ["bug", "broke"], error: ["bug", "broke"], fix: ["bug"],
  design: ["design", "ui"], looks: ["ui", "design"], ugly: ["ui", "design", "polish"], screen: ["ui"],
  deploy: ["deploy", "production"], launch: ["launch", "production"], live: ["production"],
  leak: ["keys", "security"], hack: ["security"], secure: ["security"], safe: ["security"],
  idea: ["idea", "ideation"], plan: ["plan", "tasks"], tasks: ["tasks"], stack: ["stack"],
  marketing: ["marketing", "copy"], website: ["web", "page"], app: ["app"], mobile: ["mobile"],
  llm: ["llm"], ai: ["llm", "ai-app"], embeddings: ["embeddings", "vector"], rag: ["rag"],
};
// One group per word the user typed: the word and its synonyms count as one hit.
const expand = (q: string[]) => q.filter((w) => !STOP.has(w)).map((w) => [w, ...(SYN[w] ?? [])]);

// Whole words, with a light prefix match so "test" finds "tests" and "testing" —
// but "rag" must not find "fragments".
function keywordHits(r: Row, q: string[][]): number {
  // `any` is a domain value, not a word — "did I leak any keys" must not match it.
  const hay = `${r.id} ${r.when} ${r.domain === "any" ? "" : r.domain} ${r.phase}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const match = (w: string) => hay.some((h) => h === w || (w.length >= 4 && h.startsWith(w)));
  return q.filter((group) => group.some(match)).length;
}

/** The text a skill is embedded as. Setup and search must agree on it. */
export const embedText = (r: Row) => `${r.id.replace(/[:-]/g, " ")}: ${r.when} (${r.phase}, ${r.domain})`;

export const SIM_FLOOR = 0.3;   // below this, a vector match is noise for MiniLM

export async function findSkills(text: string, opts: { project?: string; phase?: string; domain?: string; n?: number; all?: boolean } = {}): Promise<Hit[]> {
  const rows = load();
  const { status, hint } = availability(rows, opts.project ?? ".");
  const q = expand(text.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 2));

  // Vectors are optional: present only after setup, and only for rows it indexed.
  const sims = new Map<string, number>();
  const db = vectorDb();
  const embed = db ? await embedder() : null;
  if (db && embed && text.trim()) {
    const [qv] = await embed([text]);
    for (const row of db.query("SELECT id, vec FROM skills").all() as { id: string; vec: Uint8Array }[]) sims.set(row.id, dot(qv, fromBlob(row.vec)));
  }

  return rows
    .filter((r) => opts.all || r.tier !== "skip")
    .filter((r) => !opts.phase || r.phase === opts.phase)
    .filter((r) => !opts.domain || r.domain === opts.domain || r.domain === "any")
    .map((r) => {
      const st = status(r), kw = keywordHits(r, q), sim = sims.get(r.id) ?? 0;
      const matched = kw > 0 || sim >= SIM_FLOOR || q.length === 0;
      const s = !matched ? -1 : kw * 10 + Math.max(0, sim - SIM_FLOOR) * 40 + TIER_WEIGHT[r.tier] + (st === "active" || st === "bundled" ? 1 : 0);
      return { r, st, kw, sim, s, hint: hint(r, st) };
    })
    .filter((h) => h.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, opts.n ?? 5);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flag = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined; };
  const words = argv.slice(1).filter((a, i, all) => !a.startsWith("-") && !all[i - 1]?.startsWith("-"));

  switch (cmd) {
    case "find": {
      const hits = await findSkills(words.join(" "), { phase: flag("--phase"), domain: flag("--domain"), n: Number(flag("-n") ?? 5), all: argv.includes("--all") });
      if (!hits.length) { console.log("no match — try other words, or drop --phase"); break; }
      for (const h of hits) console.log(`${h.r.id} · ${h.r.tier} · ${h.st} · ${h.r.when}${h.hint ? `  → ${h.hint}` : ""}`);
      break;
    }
    case "stats": {
      const rows = load();
      const { status, unknown } = availability(rows, words[0] ?? ".");
      const t: Record<string, Record<string, number>> = {};
      for (const r of rows) { const st = status(r); (t[r.tier] ??= {})[st] = (t[r.tier][st] ?? 0) + 1; }
      const learned = rows.filter((r) => r.learned).length;
      console.log(`${rows.length} cataloged${learned ? ` (${learned} learned on this machine)` : ""} · vectors ${vectorDb() ? "on" : "off"}`);
      for (const tier of ["core", "often", "rare", "skip"]) {
        const c = t[tier] ?? {};
        console.log(`  ${tier.padEnd(6)} ${Object.entries(c).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
      }
      if (unknown.length) console.log(`not in catalog (installed, unranked): ${unknown.map((s) => s.id).join(", ")}`);
      break;
    }
    case "enable": {
      const rows = load();
      const { status } = availability(rows, ".");
      const id = words[0];
      const r = rows.find((x) => x.id === id || bare(x.id) === id);
      if (!r) { console.error(`"${id}" is not in the catalog`); process.exit(2); }
      const st = status(r);
      if (st !== "dormant") { console.log(`${r.id} is ${st} — nothing to link`); break; }
      const from = join(AGENTS, bare(r.id)), to = join(CLAUDE_SKILLS, bare(r.id));
      // Never replace whatever is already at the destination.
      let taken = false; try { lstatSync(to); taken = true; } catch {}
      if (taken) { console.error(`${to} already exists — not touching it`); process.exit(1); }
      if (!argv.includes("--yes")) { console.log(`would link ${from} → ${to} (rerun with --yes; takes effect next session)`); break; }
      symlinkSync(from, to);
      console.log(`linked ${bare(r.id)} — available from the next session`);
      break;
    }
    default:
      console.error("usage: catalog.ts find <words…> | stats [project] | enable <id> [--yes]");
      process.exit(2);
  }
}
