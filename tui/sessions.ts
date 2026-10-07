#!/usr/bin/env bun
/**
 * Claude Code sessions on this machine: which are running now, and what each
 * one has used — read from the session transcripts, nothing estimated.
 *
 *   bun tui/sessions.ts [--days 14] [--json]
 *
 * Per session: title, folder, model, started/last activity, assistant turns,
 * and tokens (input, output, cache read, cache write). Plus totals per day.
 * "Active" means the transcript was written in the last 2 minutes.
 *
 * Transcripts reach tens of MB, so results are cached per file by size and
 * mtime in ~/.claude/raffy/sessions-cache.json; an unchanged file is never
 * re-read. A reply streamed over several lines carries the same usage on each,
 * so usage is counted once per message id.
 *
 * No prices: they change and differ by plan. Tokens are the honest number.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";

const RAFFY_HOME = process.env.RAFFY_HOME ?? join(homedir(), ".claude", "raffy");
const PROJECTS = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects");
const CACHE = join(RAFFY_HOME, "sessions-cache.json");
const ACTIVE_MS = 120_000;

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type SessionStats = {
  id: string; title: string; cwd: string; model: string;
  startedAt: string; lastAt: number; active: boolean; turns: number; tokens: Tokens;
  byDay: Record<string, Tokens>;
};
type Cached = Omit<SessionStats, "active" | "lastAt"> & { size: number; mtime: number };

const zero = (): Tokens => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
const add = (a: Tokens, b: Tokens) => { a.input += b.input; a.output += b.output; a.cacheRead += b.cacheRead; a.cacheWrite += b.cacheWrite; };
export const total = (t: Tokens) => t.input + t.output + t.cacheRead + t.cacheWrite;

function parse(file: string, id: string): Omit<Cached, "size" | "mtime"> {
  let title = "", cwd = "", model = "", startedAt = "", firstAsk = "", turns = 0;
  const tokens = zero(), byDay: Record<string, Tokens> = {}, seen = new Set<string>();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    let e: any;
    try { e = JSON.parse(line); } catch { continue; }
    if (!cwd && e.cwd) cwd = e.cwd;
    if (!startedAt && e.timestamp) startedAt = e.timestamp;
    if (!title && e.type === "ai-title") title = e.aiTitle ?? "";
    if (!firstAsk && e.type === "user") {
      const c = e.message?.content;
      const t = typeof c === "string" ? c : Array.isArray(c) ? c.find((x: any) => x?.type === "text")?.text ?? "" : "";
      if (t && !t.trimStart().startsWith("<")) firstAsk = t.replace(/\s+/g, " ").trim().slice(0, 80);
    }
    if (e.type !== "assistant") continue;
    const m = e.message ?? {};
    const key = m.id ?? e.requestId ?? e.uuid;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    turns++;
    if (m.model && m.model !== "<synthetic>") model = m.model;
    const u = m.usage;
    if (!u) continue;
    const t: Tokens = { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 };
    add(tokens, t);
    const day = String(e.timestamp ?? "").slice(0, 10);
    if (day) add((byDay[day] ??= zero()), t);
  }
  return { id, title: title || firstAsk || "(untitled)", cwd, model, startedAt, turns, tokens, byDay };
}

export function sessions(days = 14): SessionStats[] {
  let cache: Record<string, Cached> = {};
  try { cache = JSON.parse(readFileSync(CACHE, "utf8")); } catch {}
  const cutoff = Date.now() - days * 86_400_000;
  const out: SessionStats[] = [];
  const fresh: Record<string, Cached> = {};
  if (existsSync(PROJECTS)) for (const dir of readdirSync(PROJECTS)) {
    let files: string[] = [];
    try { files = readdirSync(join(PROJECTS, dir)).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
    for (const f of files) {
      const p = join(PROJECTS, dir, f);
      const st = statSync(p);
      if (st.mtimeMs < cutoff) continue;
      const hit = cache[p];
      const c: Cached = hit && hit.size === st.size && hit.mtime === st.mtimeMs ? hit : { ...parse(p, f.replace(".jsonl", "")), size: st.size, mtime: st.mtimeMs };
      fresh[p] = c;
      // Test runs and scratch folders are not real work.
      if (!c.cwd || /^\/(private\/)?(tmp|var\/folders)\//.test(c.cwd) || c.cwd.startsWith(tmpdir()) || c.cwd.includes("/scratchpad/")) continue;
      const { size, mtime, ...rest } = c;
      out.push({ ...rest, lastAt: st.mtimeMs, active: Date.now() - st.mtimeMs < ACTIVE_MS });
    }
  }
  try { mkdirSync(RAFFY_HOME, { recursive: true }); writeFileSync(CACHE, JSON.stringify(fresh)); } catch {}
  return out.sort((a, b) => b.lastAt - a.lastAt);
}

// Only days inside the window: a long session active today also carries its older days.
export function byDay(list: SessionStats[], days = 14): { day: string; tokens: Tokens }[] {
  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const m: Record<string, Tokens> = {};
  for (const s of list) for (const [d, t] of Object.entries(s.byDay)) if (d >= from) add((m[d] ??= zero()), t);
  return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([day, tokens]) => ({ day, tokens }));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const days = Number(argv[argv.indexOf("--days") + 1]) || 14;
  const list = sessions(days);
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ sessions: list, days: byDay(list, days), window: days }));
  } else {
    const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
    console.log(`${list.length} sessions in ${days} days · ${list.filter((s) => s.active).length} active now`);
    for (const s of list.slice(0, 12)) console.log(`  ${s.active ? "●" : " "} ${fmt(total(s.tokens)).padStart(6)} tok · ${String(s.turns).padStart(4)} turns · ${s.cwd.split("/").pop()?.padEnd(22)} ${s.title.slice(0, 50)}`);
  }
}
