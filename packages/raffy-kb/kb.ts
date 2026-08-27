#!/usr/bin/env bun
/**
 * raffy knowledge base — local, file-based, no server.
 *
 * Tier 1 (curated)  the knowledge/ cards shipped with this plugin
 * Tier 2 (learned)  entries written back after research, with provenance
 *
 * Storage is one SQLite file opened with bun:sqlite. Lexical search uses FTS5,
 * which is built in. Embeddings are optional: when a chunk has one, semantic
 * scores are fused with lexical by reciprocal rank fusion. Without them
 * everything still works on FTS5 alone.
 *
 *   bun kb.ts build [--knowledge <dir>]   index the curated cards
 *   bun kb.ts search "<query>" [-n 8]     hybrid search
 *   bun kb.ts add --title T --body B --source URL [--confidence high]
 *   bun kb.ts stats                       counts by tier, staleness
 */
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { homedir } from "node:os";

const KB_DIR = process.env.RAFFY_KB_DIR ?? join(homedir(), ".claude", "raffy", "kb");
const DB_PATH = join(KB_DIR, "kb.sqlite");
const LOG_PATH = join(KB_DIR, "sources.jsonl");
const STALE_DAYS = { fresh: 90, aging: 365 };

function open(): Database {
  mkdirSync(KB_DIR, { recursive: true });
  const db = new Database(DB_PATH, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run(`CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tier TEXT NOT NULL CHECK (tier IN ('curated','learned')),
    layer TEXT, title TEXT NOT NULL, body TEXT NOT NULL,
    source_url TEXT, fetched_at TEXT, confidence TEXT, question TEXT,
    embedding BLOB, embed_model TEXT,
    UNIQUE (tier, layer, title)
  )`);
  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
          USING fts5(chunk_id UNINDEXED, title, body)`);
  db.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
  return db;
}

/** FTS5 treats bare punctuation as syntax. Quote every token, OR them for recall. */
function ftsQuery(raw: string): string {
  const tokens = raw.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? [];
  if (!tokens.length) return '""';
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

/** Split a layer file into cards on `### ` headings. The preamble becomes its own chunk. */
function parseCards(md: string, layer: string): { title: string; body: string }[] {
  const parts = md.split(/^### /m);
  const out: { title: string; body: string }[] = [];
  const preamble = parts.shift()?.trim();
  if (preamble && preamble.length > 120) {
    out.push({ title: `${layer} — how to choose`, body: preamble });
  }
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const title = part.slice(0, nl).trim();
    const body = part.slice(nl + 1).trim();
    if (title && body) out.push({ title, body });
  }
  return out;
}

function insert(db: Database, row: {
  tier: string; layer: string | null; title: string; body: string;
  source_url?: string | null; fetched_at?: string | null;
  confidence?: string | null; question?: string | null;
}) {
  const stmt = db.prepare(`INSERT INTO chunks
    (tier, layer, title, body, source_url, fetched_at, confidence, question)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (tier, layer, title) DO UPDATE SET
      body = excluded.body, source_url = excluded.source_url,
      fetched_at = excluded.fetched_at, confidence = excluded.confidence
    RETURNING id`);
  const { id } = stmt.get(
    row.tier, row.layer, row.title, row.body,
    row.source_url ?? null, row.fetched_at ?? null,
    row.confidence ?? null, row.question ?? null,
  ) as { id: number };
  db.run("DELETE FROM chunks_fts WHERE chunk_id = ?", [id]);
  db.run("INSERT INTO chunks_fts (chunk_id, title, body) VALUES (?, ?, ?)",
    [id, row.title, row.body]);
  return id;
}

function cmdBuild(knowledgeDir: string) {
  const db = open();
  if (!existsSync(knowledgeDir)) {
    console.error(`no knowledge dir at ${knowledgeDir}`);
    process.exit(1);
  }
  // Curated content is replaced wholesale. Learned entries are never touched.
  const stale = db.query("SELECT id FROM chunks WHERE tier = 'curated'").all() as { id: number }[];
  for (const { id } of stale) db.run("DELETE FROM chunks_fts WHERE chunk_id = ?", [id]);
  db.run("DELETE FROM chunks WHERE tier = 'curated'");

  let n = 0;
  const files = readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const layer = basename(file, ".md");
    for (const card of parseCards(readFileSync(join(knowledgeDir, file), "utf8"), layer)) {
      insert(db, { tier: "curated", layer, title: card.title, body: card.body });
      n++;
    }
  }
  db.run(`INSERT INTO meta (key, value) VALUES ('built_at', ?)
          ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [new Date().toISOString()]);
  const learned = (db.query("SELECT count(*) c FROM chunks WHERE tier='learned'").get() as any).c;
  console.log(`indexed ${n} curated cards from ${files.length} layers · ${learned} learned kept`);
  console.log(DB_PATH);
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function ageLabel(fetched: string | null): string {
  if (!fetched) return "";
  const days = (Date.now() - Date.parse(fetched)) / 86_400_000;
  if (Number.isNaN(days)) return "";
  if (days <= STALE_DAYS.fresh) return "fresh";
  if (days <= STALE_DAYS.aging) return `aging (${Math.round(days)}d — re-verify if version-specific)`;
  return `STALE (${Math.round(days)}d — treat as a lead, re-research)`;
}

function cmdSearch(query: string, limit: number, queryVec?: Float32Array) {
  const db = open();
  const lexical = db.query(
    `SELECT chunk_id AS id, bm25(chunks_fts) AS score FROM chunks_fts
     WHERE chunks_fts MATCH ? ORDER BY score LIMIT ?`,
  ).all(ftsQuery(query), limit * 4) as { id: number; score: number }[];

  // Reciprocal rank fusion: stable across scales, no tuning, and correct when
  // only one of the two rankings exists.
  const RRF_K = 60;
  const fused = new Map<number, number>();
  lexical.forEach((r, i) => fused.set(r.id, (fused.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)));

  if (queryVec) {
    const rows = db.query(
      "SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL",
    ).all() as { id: number; embedding: Uint8Array }[];
    rows
      .map((r) => ({ id: r.id, s: cosine(queryVec, new Float32Array(r.embedding.buffer)) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit * 4)
      .forEach((r, i) => fused.set(r.id, (fused.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)));
  }

  const ids = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (!ids.length) {
    console.log("no match in tiers 1–2 — research the web and write the answer back with `add`");
    return;
  }
  const rows = db.query(
    `SELECT id, tier, layer, title, body, source_url, fetched_at, confidence
     FROM chunks WHERE id IN (${ids.join(",")})`,
  ).all() as any[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    const age = ageLabel(r.fetched_at);
    console.log(`\n─── [${r.tier}] ${r.title}${r.layer ? `  (${r.layer})` : ""}`);
    if (r.source_url) console.log(`    source: ${r.source_url}${age ? `  · ${age}` : ""}`);
    if (r.confidence) console.log(`    confidence: ${r.confidence}`);
    console.log(r.body.length > 1200 ? r.body.slice(0, 1200) + "\n    …" : r.body);
  }
}

function cmdAdd(args: Record<string, string>) {
  if (!args.title || !args.body) { console.error("--title and --body required"); process.exit(1); }
  if (!args.source) {
    console.error("--source required: an entry without a source is a hallucination cache");
    process.exit(1);
  }
  const db = open();
  const fetched_at = new Date().toISOString();
  const id = insert(db, {
    tier: "learned", layer: args.layer ?? null, title: args.title, body: args.body,
    source_url: args.source, fetched_at,
    confidence: args.confidence ?? "medium", question: args.question ?? null,
  });
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, JSON.stringify({
    id, title: args.title, source: args.source, fetched_at,
    confidence: args.confidence ?? "medium", question: args.question ?? null,
  }) + "\n");
  console.log(`learned #${id} · ${args.title}`);
}

function cmdStats() {
  const db = open();
  const byTier = db.query("SELECT tier, count(*) c FROM chunks GROUP BY tier").all() as any[];
  const byLayer = db.query(
    "SELECT layer, count(*) c FROM chunks WHERE tier='curated' GROUP BY layer ORDER BY c DESC",
  ).all() as any[];
  const built = db.query("SELECT value FROM meta WHERE key='built_at'").get() as any;
  console.log(`db: ${DB_PATH}`);
  if (built) console.log(`built: ${built.value}`);
  for (const t of byTier) console.log(`  ${t.tier.padEnd(9)} ${t.c}`);
  const learned = db.query(
    "SELECT fetched_at FROM chunks WHERE tier='learned' AND fetched_at IS NOT NULL",
  ).all() as any[];
  if (learned.length) {
    const buckets = { fresh: 0, aging: 0, stale: 0 };
    for (const l of learned) {
      const d = (Date.now() - Date.parse(l.fetched_at)) / 86_400_000;
      if (d <= STALE_DAYS.fresh) buckets.fresh++;
      else if (d <= STALE_DAYS.aging) buckets.aging++;
      else buckets.stale++;
    }
    console.log(`  learned freshness: ${buckets.fresh} fresh · ${buckets.aging} aging · ${buckets.stale} stale`);
  }
  console.log("\ncurated by layer:");
  for (const l of byLayer) console.log(`  ${String(l.layer).padEnd(16)} ${l.c}`);
}

// ---- arg parsing -----------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);
const flags: Record<string, string> = {};
const positional: string[] = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith("--")) flags[a.slice(2)] = rest[++i] ?? "";
  else if (a === "-n") flags.n = rest[++i] ?? "";
  else positional.push(a);
}

switch (cmd) {
  case "build":
    cmdBuild(flags.knowledge ?? join(import.meta.dir, "..", "knowledge"));
    break;
  case "search":
    if (!positional.length) { console.error('usage: kb.ts search "<query>"'); process.exit(1); }
    cmdSearch(positional.join(" "), Number(flags.n ?? 8));
    break;
  case "add":
    cmdAdd(flags);
    break;
  case "stats":
    cmdStats();
    break;
  default:
    console.log(`raffy kb — local knowledge base

  bun kb.ts build [--knowledge <dir>]     index curated cards (learned entries kept)
  bun kb.ts search "<query>" [-n 8]       hybrid search across tiers 1–2
  bun kb.ts add --title T --body B --source URL [--layer L] [--confidence high]
  bun kb.ts stats                         counts by tier, staleness

db: ${DB_PATH}`);
}
