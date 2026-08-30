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

// ── report ──────────────────────────────────────────────────────────────────
console.log(`checked ${skills.length} skills · ${docs.length} docs · ${cards} cards · ${taught.size} concepts\n`);
for (const w of warnings) console.log(`  warn  ${w}`);
if (warnings.length) console.log();
for (const e of errors) console.log(`  FAIL  ${e}`);
console.log(errors.length ? `\n${errors.length} error(s)` : "\nall invariants hold");
process.exit(errors.length ? 1 : 0);
