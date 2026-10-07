#!/usr/bin/env bun
/**
 * Repo self-check. Validates the invariants the skills depend on and that
 * nothing verifies at runtime — a broken reference inside a SKILL.md fails
 * silently as "the agent couldn't find the file" mid-task.
 *
 *   bun scripts/check.ts
 *
 * Exits non-zero on any error. Warnings do not fail the run.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

const read = (f: string) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const rel = (p: string) => p.replace(ROOT + "/", "");
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".git" || n.startsWith(".")) continue;
    const f = join(dir, n);
    statSync(f).isDirectory() ? walk(f, out) : out.push(f);
  }
  return out;
}

const skillsDir = join(ROOT, "skills");
const skills = readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory());
const docs = walk(skillsDir).filter((f) => f.endsWith(".md"));

// ── 1 · frontmatter ─────────────────────────────────────────────────────────
for (const s of skills) {
  const p = join(skillsDir, s, "SKILL.md");
  if (!existsSync(p)) { err(`${s}: no SKILL.md`); continue; }
  const src = readFileSync(p, "utf8");
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { err(`${s}/SKILL.md: no frontmatter`); continue; }
  const name = fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (name !== s) err(`${s}/SKILL.md: frontmatter name "${name}" != directory "${s}"`);
  if (!desc) err(`${s}/SKILL.md: no description`);
  else if (/: /.test(desc)) err(`${s}/SKILL.md: description contains ": " — invalid in a plain YAML scalar; use a dash`);
  else if (desc.length > 300) warn(`${s}/SKILL.md: description is ${desc.length} chars — it loads into every session; keep it ≤300`);
  else if (desc.length < 120) warn(`${s}/SKILL.md: description is short (${desc.length} chars) — it is the only thing the model sees when deciding to invoke`);
}

// ── 2 · ${CLAUDE_PLUGIN_ROOT} paths resolve ─────────────────────────────────
for (const f of docs) {
  for (const m of readFileSync(f, "utf8").matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}(\/[A-Za-z0-9_./-]+)/g)) {
    if (!existsSync(join(ROOT, m[1]))) err(`${rel(f)}: \${CLAUDE_PLUGIN_ROOT}${m[1]} does not exist`);
  }
}

// ── 3 · relative refs resolve from the file that names them ─────────────────
const REF = /`(\.\.?\/)?((?:references|knowledge|scripts)\/[A-Za-z0-9_.-]+\.(?:md|ts|py|sh))`/g;
for (const f of docs) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(REF)) {
    const raw = m[0].slice(1, -1);
    if (src.slice(Math.max(0, m.index! - 30), m.index!).includes("CLAUDE_PLUGIN_ROOT")) continue;
    if (!existsSync(resolve(dirname(f), raw))) {
      err(`${rel(f)}: relative ref \`${raw}\` does not resolve from its own directory`);
    }
  }
}

// ── 4 · knowledge layers named in scaffold/SKILL.md exist ───────────────────
const scaffold = join(skillsDir, "scaffold");
if (existsSync(scaffold)) {
  const src = readFileSync(join(scaffold, "SKILL.md"), "utf8");
  const named = new Set([...src.matchAll(/`knowledge\/([a-z-]+)\.md`/g)].map((m) => m[1]));
  const onDisk = new Set(readdirSync(join(scaffold, "knowledge")).filter((f) => f.endsWith(".md")).map((f) => f.replace(".md", "")));
  for (const n of named) if (!onDisk.has(n)) err(`scaffold/SKILL.md: names knowledge/${n}.md which does not exist`);
  for (const d of onDisk) if (!named.has(d)) warn(`scaffold: knowledge/${d}.md exists but SKILL.md never tells the agent to read it`);
}

// ── 5 · card shape ──────────────────────────────────────────────────────────
const taught = new Set<string>();
let cards = 0;
for (const f of docs.filter((f) => f.includes("/knowledge/"))) {
  const src = readFileSync(f, "utf8");
  // Split on card headings; the preamble before the first one is not a card.
  const blocks = src.split(/^### /m).slice(1);
  for (const b of blocks) {
    cards++;
    const title = b.slice(0, b.indexOf("\n")).trim();
    const where = `${rel(f)} › ${title}`;
    // Teaches: may lead the line or sit inline after a · separator.
    const t = b.match(/\*\*Teaches:\*\*\s*([^\n*]+)/);
    if (t) for (const c of t[1].split(",").map((x) => x.trim()).filter(Boolean)) taught.add(c);
    if (!/\*\*Docs:\*\*\s*(n\/a|http)/.test(b) && !/\*\*Guidance — not an option/.test(b) && !/how to choose/.test(title)) warn(`${where}: no Docs: link — the agent has nothing to fetch before implementing`);
    const isGuidance = /\*\*Guidance — not an option/.test(b) || /how to choose/.test(title);
    if (!/\*\*Don't use when\*\*/.test(b) && !isGuidance) {
      warn(`${where}: no "Don't use when" — that field is the judgment`);
    }
  }
}

// ── 6 · every drill concept has a source ────────────────────────────────────
const conceptsPath = join(skillsDir, "drill", "references", "concepts.md");
if (existsSync(conceptsPath)) {
  const src = readFileSync(conceptsPath, "utf8");
  for (const b of src.split(/^### /m).slice(1)) {
    const slug = b.slice(0, b.indexOf("\n")).trim().replace(/`/g, "");
    const processTaught = /\*\*Source: process/.test(b);
    if (!taught.has(slug) && !processTaught) {
      err(`drill/concepts.md: "${slug}" is drillable but no card teaches it and it is not marked "Source: process"`);
    }
  }
}

// ── 7 · guide skill cards ───────────────────────────────────────────────────
// The guide routes by these cards. A card with no phase is never offered, and a
// collision-table entry with no card sends the agent looking for judgment that
// does not exist.
const guideCards = join(skillsDir, "guide", "knowledge", "skills.md");
if (existsSync(guideCards)) {
  const src = readFileSync(guideCards, "utf8");
  const journey = readFileSync(join(skillsDir, "guide", "scripts", "journey.ts"), "utf8");
  const phases = new Set([...(journey.match(/PHASES = \[([^\]]+)\]/)?.[1] ?? "").matchAll(/"([a-z]+)"/g)].map((m) => m[1]));
  phases.add("orient"); phases.add("handoff");
  const ids = new Set<string>();
  for (const b of src.split(/^### /m).slice(1)) {
    const id = b.slice(0, b.indexOf("\n")).trim();
    ids.add(id);
    const ph = b.match(/\*\*Phase:\*\*\s*([a-z]+)/)?.[1];
    if (!ph) err(`guide/skills.md › ${id}: no **Phase:** — the guide can never offer it`);
    else if (!phases.has(ph)) err(`guide/skills.md › ${id}: phase "${ph}" is not one journey.ts knows`);
  }
  // Commands and built-ins without their own card are named in the table on purpose.
  const uncarded = new Set(["spec", "plan", "test", "build", "security-review", "simplify", "run"]);
  const table = src.slice(src.indexOf("| Job |"), src.indexOf("\n---"));
  for (const m of table.matchAll(/`([a-z0-9:-]+)`/g)) {
    if (!ids.has(m[1]) && !uncarded.has(m[1])) err(`guide/skills.md: collision table names \`${m[1]}\` but there is no card for it`);
  }
}

// ── 8 · the skill catalog ───────────────────────────────────────────────────
// The guide asks the catalog for candidates instead of reading every skill. A
// malformed row is silently unrankable, and a card with no catalog row is
// judgment the guide can never reach.
const catalogPath = join(skillsDir, "guide", "knowledge", "catalog.tsv");
if (existsSync(catalogPath)) {
  const journey = readFileSync(join(skillsDir, "guide", "scripts", "journey.ts"), "utf8");
  const phases = new Set([...(journey.match(/PHASES = \[([^\]]+)\]/)?.[1] ?? "").matchAll(/"([a-z]+)"/g)].map((m) => m[1]));
  phases.add("orient"); phases.add("handoff");
  const seen = new Set<string>();
  readFileSync(catalogPath, "utf8").split("\n").forEach((line, i) => {
    if (!line.trim() || line.startsWith("#")) return;
    const f = line.split("\t");
    const at = `guide/catalog.tsv:${i + 1}`;
    if (f.length !== 6) return err(`${at}: ${f.length} columns, expected 6 (id tier phase domain src when)`);
    const [id, tier, phase, , src, when] = f;
    if (seen.has(id)) err(`${at}: duplicate id ${id}`);
    seen.add(id);
    if (!["core", "often", "rare", "skip"].includes(tier)) err(`${at}: tier "${tier}"`);
    if (!phases.has(phase)) err(`${at}: phase "${phase}" is not one journey.ts knows`);
    if (!/^(raffy|builtin|tool|user|command|agents|plugin:[\w-]+|project:[\w.-]+)$/.test(src)) err(`${at}: src "${src}"`);
    if (when.length > 90) warn(`${at}: "when" is ${when.length} chars — keep catalog lines short, they are read into context`);
  });
  if (existsSync(guideCards)) {
    for (const b of readFileSync(guideCards, "utf8").split(/^### /m).slice(1)) {
      const id = b.slice(0, b.indexOf("\n")).trim();
      if (!seen.has(id)) err(`guide/skills.md › ${id}: has a card but no catalog row — the guide cannot find it`);
    }
  }
}

// ── 9 · bundled library ─────────────────────────────────────────────────────
// Redistributing someone's skill without its license is the one mistake here
// that cannot be fixed by a follow-up commit. Every bundled dir needs
// provenance, an allowed license, and the license text on disk.
const lib = join(ROOT, "library");
if (existsSync(join(lib, "INDEX.tsv"))) {
  const cfg = JSON.parse(readFileSync(join(lib, "sources.json"), "utf8"));
  const indexed = new Set<string>();
  for (const line of readFileSync(join(lib, "INDEX.tsv"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [id, dir, repo, license] = line.split("\t");
    indexed.add(dir);
    const where = `library/${dir}`;
    if (!existsSync(join(lib, dir, "SKILL.md"))) { err(`${where}: in INDEX.tsv but has no SKILL.md`); continue; }
    if (!existsSync(join(lib, dir, "SOURCE.json"))) err(`${where}: no SOURCE.json — provenance unknown`);
    if (!cfg.allow.includes(license)) err(`${where}: license "${license}" is not in sources.json allow`);
    if (cfg.repos[repo] !== license) err(`${where}: INDEX says ${license} but sources.json says ${repo} is ${cfg.repos[repo]}`);
    if (!existsSync(join(lib, "licenses", repo.replace("/", "__") + ".txt"))) err(`${where}: no license text for ${repo} in library/licenses/`);
    if (readFileSync(join(lib, dir, "SOURCE.json"), "utf8").includes("/Users/")) err(`${where}/SOURCE.json: contains an absolute home path`);
  }
  for (const d of readdirSync(lib)) {
    if (statSync(join(lib, d)).isDirectory() && d !== "licenses" && !indexed.has(d)) err(`library/${d}: not in INDEX.tsv — run scripts/vendor.ts`);
  }
}

// ── 10 · plugin hooks ───────────────────────────────────────────────────────
const hooksJson = join(ROOT, "hooks", "hooks.json");
if (existsSync(hooksJson)) {
  let h: any;
  try { h = JSON.parse(readFileSync(hooksJson, "utf8")); } catch { err("hooks/hooks.json: not valid JSON"); }
  for (const groups of Object.values<any[]>(h?.hooks ?? {})) for (const g of groups) for (const c of g.hooks ?? []) {
    for (const m of String(c.command).matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"' ]+)/g)) if (!existsSync(join(ROOT, m[1]))) err(`hooks/hooks.json: ${m[1]} does not exist`);
    if (!c.timeout || c.timeout > 10) warn(`hooks/hooks.json: a hook without a short timeout can stall every prompt`);
  }
}

// ── 11 · eval cases ─────────────────────────────────────────────────────────
// A malformed case is skipped silently by a live run that only happens on
// release tags — so check its shape on every push instead.
const evalsDir = join(ROOT, "evals");
if (existsSync(evalsDir)) {
  const GRADERS = ["regex", "tool_used", "tool_order", "file_exists", "llm", "baseline"];
  for (const c of readdirSync(evalsDir).filter((d) => d !== "results" && statSync(join(evalsDir, d)).isDirectory())) {
    const prompt = read(join(evalsDir, c, "prompt.md"));
    const fm = prompt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fm) { err(`evals/${c}: prompt.md has no frontmatter + body`); continue; }
    if (fm[1].match(/^name:\s*(.+)$/m)?.[1].trim() !== c) err(`evals/${c}: frontmatter name must equal the directory`);
    if (!fm[2].trim()) err(`evals/${c}: prompt.md has an empty prompt`);
    const gdir = join(evalsDir, c, "graders");
    const graders = existsSync(gdir) ? readdirSync(gdir).filter((f) => f.endsWith(".md")) : [];
    if (!graders.length) err(`evals/${c}: no graders — the case can never fail`);
    for (const g of graders) {
      const type = read(join(gdir, g)).match(/^type:\s*(\S+)/m)?.[1];
      if (!type || !GRADERS.includes(type)) err(`evals/${c}/graders/${g}: type "${type}" is not one of ${GRADERS.join(", ")}`);
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(`checked ${skills.length} skills · ${docs.length} docs · ${cards} cards · ${taught.size} concepts\n`);
for (const w of warnings) console.log(`  warn  ${w}`);
if (warnings.length) console.log();
for (const e of errors) console.log(`  FAIL  ${e}`);
console.log(errors.length ? `\n${errors.length} error(s)` : "\nall invariants hold");
process.exit(errors.length ? 1 : 0);
