#!/usr/bin/env bun
/**
 * The drill ledger: which concepts a user has earned, across projects.
 *
 * Plain markdown so a human can read and edit it, with a machine-readable
 * table. Lives at ~/.claude/raffy/progress.md (user scope, follows the person)
 * and optionally .raffy/progress.md (project scope, follows the repo).
 *
 *   bun ledger.ts show                       current levels
 *   bun ledger.ts record <concept> <hit|miss> [--project X]
 *   bun ledger.ts weakest [-n 5]             what to drill next
 *   bun ledger.ts due [--count]              concepts due for review today, oldest first
 *   bun ledger.ts json                       every row, plus which are due (for the dashboards)
 *
 * Spaced repetition: every record sets the next review date from the level —
 * L0 1 day, L1 3, L2 7, L3 21. A miss brings it back tomorrow. Earned skill
 * fades without use; the schedule is what keeps L3 meaning L3.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const LEDGER = process.env.RAFFY_LEDGER ??
  join(process.env.RAFFY_HOME ?? join(homedir(), ".claude", "raffy"), "progress.md");

const LEVELS = ["L0", "L1", "L2", "L3"] as const;
type Row = { concept: string; level: string; hits: number; misses: number; project: string; seen: string; due: string };
export const INTERVAL_DAYS: Record<string, number> = { L0: 1, L1: 3, L2: 7, L3: 21 };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

const HEADER = `# raffy — learning ledger

Levels: **L1 approve** (can say whether a diff did what was asked) ·
**L2 choose** (picks correctly between two approaches and can say why) ·
**L3 spot** (finds the defect before the audit does).

Promotion needs two consecutive hits. Two consecutive misses demotes.
Review again after: L0 1 day · L1 3 · L2 7 · L3 21. A miss brings it back tomorrow.

| concept | level | hits | misses | last project | last seen | due |
|---|---|---|---|---|---|---|
`;

export function load(): Row[] {
  if (!existsSync(LEDGER)) return [];
  const rows: Row[] = [];
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    // The due column is newer than the ledger format; old rows get one from their last-seen date.
    const m = line.match(/^\|\s*([a-z0-9-]+)\s*\|\s*(L[0-3])\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]*)\|\s*([^|]*)\|(?:\s*([^|]*)\|)?/);
    if (m) {
      const seen = m[6].trim();
      rows.push({
        concept: m[1], level: m[2], hits: +m[3], misses: +m[4], project: m[5].trim(), seen,
        due: m[7]?.trim() || (seen ? addDays(seen, INTERVAL_DAYS[m[2]]) : today()),
      });
    }
  }
  return rows;
}

function save(rows: Row[]) {
  mkdirSync(dirname(LEDGER), { recursive: true });
  rows.sort((a, b) => LEVELS.indexOf(a.level as any) - LEVELS.indexOf(b.level as any) ||
    a.concept.localeCompare(b.concept));
  const body = rows.map((r) =>
    `| ${r.concept} | ${r.level} | ${r.hits} | ${r.misses} | ${r.project} | ${r.seen} | ${r.due} |`).join("\n");
  writeFileSync(LEDGER, HEADER + body + "\n");
}

export const due = (rows = load(), on = today()) => rows.filter((r) => r.due <= on).sort((a, b) => a.due.localeCompare(b.due));

const [cmd, ...rest] = import.meta.main ? process.argv.slice(2) : [];
const flag = (n: string) => { const i = rest.indexOf(`--${n}`); return i === -1 ? undefined : rest[i + 1]; };

if (cmd === "record") {
  const [concept, result] = rest;
  if (!concept || !["hit", "miss"].includes(result ?? "")) {
    console.error("usage: ledger.ts record <concept> <hit|miss> [--project X]");
    process.exit(1);
  }
  const rows = load();
  let row = rows.find((r) => r.concept === concept);
  if (!row) { row = { concept, level: "L0", hits: 0, misses: 0, project: "", seen: "", due: "" }; rows.push(row); }

  const before = row.level;
  if (result === "hit") {
    row.hits++; row.misses = 0;
    // Two consecutive hits promote. Streak resets on promotion so the next
    // level has to be earned on its own terms.
    if (row.hits >= 2 && row.level !== "L3") {
      row.level = LEVELS[LEVELS.indexOf(row.level as any) + 1]; row.hits = 0;
    }
  } else {
    row.misses++; row.hits = 0;
    if (row.misses >= 2 && row.level !== "L0") {
      row.level = LEVELS[LEVELS.indexOf(row.level as any) - 1]; row.misses = 0;
    }
  }
  row.project = flag("project") ?? row.project;
  row.seen = today();
  row.due = addDays(row.seen, result === "miss" ? 1 : INTERVAL_DAYS[row.level]);
  save(rows);
  console.log(before === row.level
    ? `${concept}: ${result} · holds at ${row.level} (${row.hits} hit / ${row.misses} miss streak) · review ${row.due}`
    : `${concept}: ${result} · ${before} → ${row.level} · review ${row.due}`);
} else if (cmd === "weakest") {
  const n = Number(flag("n") ?? rest[rest.indexOf("-n") + 1] ?? 5);
  const rows = load();
  if (!rows.length) { console.log("empty ledger — first session; every concept starts at L0"); process.exit(0); }
  for (const r of rows.filter((r) => r.level !== "L3").slice(0, n)) {
    console.log(`${r.level}  ${r.concept.padEnd(30)} ${r.misses ? `${r.misses} miss streak` : ""}`);
  }
} else if (cmd === "json") {
  const rows = load();
  const dueNow = new Set(due(rows).map((r) => r.concept));
  console.log(JSON.stringify(rows.map((r) => ({ ...r, isDue: dueNow.has(r.concept) }))));
} else if (cmd === "due") {
  const d = due();
  if (rest.includes("--count")) console.log(String(d.length));
  else if (!d.length) console.log("nothing due today");
  else for (const r of d) console.log(`${r.level}  ${r.concept.padEnd(30)} due ${r.due}`);
} else if (cmd === "show") {
  const rows = load();
  if (!rows.length) { console.log(`no ledger at ${LEDGER} — first session`); process.exit(0); }
  const by = (l: string) => rows.filter((r) => r.level === l).map((r) => r.concept);
  for (const l of [...LEVELS].reverse()) {
    const c = by(l);
    if (c.length) console.log(`${l} (${c.length})  ${c.join(", ")}`);
  }
  console.log(`\n${LEDGER}`);
} else if (cmd) {
  console.log(`drill ledger

  bun ledger.ts show
  bun ledger.ts record <concept> <hit|miss> [--project X]
  bun ledger.ts weakest [-n 5]
  bun ledger.ts due [--count]

${LEDGER}`);
}
