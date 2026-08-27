#!/usr/bin/env node
/**
 * Claude Code statusline: one line of knowledge-base state.
 *
 * Wire it up in ~/.claude/settings.json:
 *   { "statusLine": { "type": "command",
 *                     "command": "npx -y raffy-kb-statusline" } }
 *
 * Or point it straight at this file to avoid the network on every prompt:
 *   { "statusLine": { "type": "command",
 *                     "command": "node ~/.../packages/raffy-kb/statusline.mjs" } }
 *
 * Reads the store directly rather than shelling out to bun, so it stays fast
 * enough to run on every prompt. Prints nothing when there is no store — a
 * statusline that errors is worse than one that is absent.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DB = process.env.RAFFY_KB_DIR
  ? join(process.env.RAFFY_KB_DIR, "kb.sqlite")
  : join(homedir(), ".claude", "raffy", "kb.sqlite");
const LEGACY = join(homedir(), ".claude", "raffy", "kb", "kb.sqlite");
const path = existsSync(DB) ? DB : existsSync(LEGACY) ? LEGACY : null;

if (!path) process.exit(0);

/**
 * Count rows without a SQLite driver: read the sources.jsonl provenance log for
 * the learned tier, and fall back to file size for a coarse "indexed" signal.
 * Exact counts need `raffy-kb stats`; this line only has to answer
 * "is my knowledge base current".
 */
const dir = path.replace(/kb\.sqlite$/, "");
const log = join(dir, "sources.jsonl");
let learned = 0;
let stale = 0;
if (existsSync(log)) {
  const YEAR = 365 * 86_400_000;
  for (const line of readFileSync(log, "utf8").split("\n")) {
    if (!line.trim()) continue;
    learned++;
    try {
      const e = JSON.parse(line);
      if (e.fetched_at && Date.now() - Date.parse(e.fetched_at) > YEAR) stale++;
    } catch { /* a malformed line still counts as an entry */ }
  }
}

const age = Math.floor((Date.now() - statSync(path).mtimeMs) / 86_400_000);
const parts = ["kb"];
parts.push(`${learned} learned`);
if (stale) parts.push(`${stale} stale`);
parts.push(age === 0 ? "indexed today" : `indexed ${age}d ago`);
process.stdout.write(parts.join(" · "));
