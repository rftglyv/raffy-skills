#!/usr/bin/env bun
/**
 * UserPromptSubmit hook. Before Claude reads the user's message, add at most
 * one line naming the skills that fit it — or nothing.
 *
 * Silence is the default. Every line printed here is paid for in context on
 * every prompt, so it speaks only when:
 *   - setup has never run       → once per session, a pointer to /raffy:setup
 *   - a match is strong         → keyword hits on 2+ words, or a vector match ≥ 0.35
 *   - and it has not already said the same thing this session
 *
 * Never blocks, never fails the prompt: any error exits 0 with no output.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { findSkills } from "../skills/guide/scripts/catalog.ts";
import { RAFFY_HOME } from "../skills/guide/scripts/embed.ts";

const SEEN_DIR = join(RAFFY_HOME, "hook");
const STRONG_SIM = 0.35;

async function main() {
  const input = JSON.parse(await Bun.stdin.text() || "{}");
  const prompt: string = (input.prompt ?? "").trim();
  const session: string = String(input.session_id ?? "nosession").replace(/[^\w-]/g, "");
  const cwd: string = input.cwd ?? process.cwd();

  mkdirSync(SEEN_DIR, { recursive: true });
  const seenFile = join(SEEN_DIR, `${session}.json`);
  const seen: string[] = existsSync(seenFile) ? JSON.parse(readFileSync(seenFile, "utf8")) : [];
  const say = (key: string, line: string) => {
    if (seen.includes(key)) return;
    seen.push(key);
    writeFileSync(seenFile, JSON.stringify(seen));
    console.log(line);
  };

  if (!existsSync(join(RAFFY_HOME, "setup.json"))) {
    say("setup", "raffy: not set up on this machine yet — /raffy:setup takes ~3 min (code map, skill search, catalog of your skills).");
  }

  // The user already chose a skill or command, or it is a one-word reply.
  if (!prompt || prompt.startsWith("/") || prompt.split(/\s+/).length < 4) return;

  const hits = await findSkills(prompt, { project: cwd, n: 3 });
  const strong = hits.filter((h) => h.kw >= 2 || h.sim >= STRONG_SIM);
  if (!strong.length) return;

  const names = strong.slice(0, 2).map((h) => `${h.r.id}${h.st === "active" ? "" : ` (${h.st})`}`);
  say(`fit:${names.join(",")}`, `raffy: likely fits — ${names.join(", ")}. If unsure which, /raffy:guide explains the options.`);
}

// Session files are tiny; drop ones older than a week so the folder never grows.
function prune() {
  try {
    const cutoff = Date.now() - 7 * 86_400_000;
    for (const f of readdirSync(SEEN_DIR)) if (statSync(join(SEEN_DIR, f)).mtimeMs < cutoff) rmSync(join(SEEN_DIR, f));
  } catch {}
}

try { await main(); prune(); } catch {}
process.exit(0);
