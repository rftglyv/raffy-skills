#!/usr/bin/env bun
/**
 * raffy dashboard — every project, every Claude Code session, one screen.
 *
 *   bun tui/dash.ts            interactive: ↑↓ select · enter details · r refresh · q quit
 *   bun tui/dash.ts --once     print one snapshot and exit (scripts, CI, non-TTY)
 *   bun tui/dash.ts --once --project <name>   the detail view for one project
 *   bun tui/dash.ts --json     the same data as JSON — what a web or native app would read
 *
 * Reads, never writes:
 *   ~/.claude/raffy/projects.json        projects raffy has logged steps in
 *   <project>/.raffy/journey.jsonl        each project's steps
 *   <project>/.raffy/memory.jsonl         each project's decisions
 *   ~/.claude/projects/*\/*.jsonl          Claude Code sessions: title, folder, last activity
 *
 * Session files can be many MB; only the first 64 KB of each is read (title and
 * folder are near the top) and last activity comes from the file's mtime.
 */
import { existsSync, readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

const RAFFY_HOME = process.env.RAFFY_HOME ?? join(homedir(), ".claude", "raffy");
const CLAUDE_PROJECTS = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects");
const DAY = 86_400_000;

type Session = { id: string; title: string; cwd: string; at: number };
type Step = { at: string; skill: string; phase: string; status: string; note?: string; why?: string };
type Project = {
  path: string; name: string; phase?: string; steps: Step[]; decisions: { text: string; why?: string }[];
  sessions: Session[]; lastActive: number;
};

function head(file: string, bytes = 65536): string {
  const fd = openSync(file, "r");
  try { const buf = Buffer.alloc(bytes); const n = readSync(fd, buf, 0, bytes, 0); return buf.subarray(0, n).toString("utf8"); }
  finally { closeSync(fd); }
}

function sessions(): Session[] {
  if (!existsSync(CLAUDE_PROJECTS)) return [];
  const out: Session[] = [];
  for (const dir of readdirSync(CLAUDE_PROJECTS)) {
    const d = join(CLAUDE_PROJECTS, dir);
    let files: string[] = [];
    try { files = readdirSync(d).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
    for (const f of files) {
      const p = join(d, f);
      let title = "", cwd = "", firstAsk = "";
      for (const line of head(p).split("\n")) {
        if (!line) continue;
        if (!title) title = line.match(/"aiTitle":"([^"]*)"/)?.[1] ?? "";
        if (!cwd) cwd = line.match(/"cwd":"([^"]*)"/)?.[1] ?? "";
        // No generated title yet: fall back to the first thing the user typed,
        // skipping harness-injected blocks (<system-reminder>, <command-…>).
        if (!firstAsk && line.includes('"type":"user"')) {
          try {
            const m = JSON.parse(line).message?.content;
            const text = typeof m === "string" ? m : Array.isArray(m) ? m.find((x: any) => x.type === "text")?.text ?? "" : "";
            if (text && !text.trimStart().startsWith("<")) firstAsk = text.replace(/\s+/g, " ").trim().slice(0, 80);
          } catch {}
        }
        if (title && cwd) break;
      }
      if (cwd) out.push({ id: f.replace(".jsonl", ""), title: title || firstAsk || "(untitled)", cwd, at: statSync(p).mtimeMs });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

function jsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l) as T]; } catch { return []; } });
}

export function collect(): Project[] {
  let index: Record<string, { path: string; name: string; phase?: string }> = {};
  try { index = JSON.parse(readFileSync(join(RAFFY_HOME, "projects.json"), "utf8")); } catch {}
  const all = sessions();
  const byPath = new Map<string, Project>();
  const ensure = (path: string) => {
    if (!byPath.has(path)) byPath.set(path, { path, name: basename(path), steps: [], decisions: [], sessions: [], lastActive: 0 });
    return byPath.get(path)!;
  };
  for (const row of Object.values(index)) {
    const p = ensure(row.path);
    p.phase = row.phase;
    p.steps = jsonl<Step>(join(row.path, ".raffy", "journey.jsonl"));
    // Latest state per id; superseded entries drop out, as in memory.ts.
    const mem = new Map<string, any>();
    for (const e of jsonl<any>(join(row.path, ".raffy", "memory.jsonl"))) mem.set(e.id, { ...mem.get(e.id), ...e });
    p.decisions = [...mem.values()].filter((e) => e.status !== "superseded" && e.kind !== "pref").map((e) => ({ text: e.text, why: e.why }));
  }
  for (const s of all) {
    // Scratch and temp folders are noise on a dashboard of real work.
    if (/^\/(private\/)?tmp\//.test(s.cwd) || s.cwd.includes("/scratchpad/")) continue;
    const p = ensure(s.cwd);
    p.sessions.push(s);
  }
  for (const p of byPath.values()) {
    const lastStep = p.steps.at(-1) ? Date.parse(p.steps.at(-1)!.at) : 0;
    p.lastActive = Math.max(lastStep, p.sessions[0]?.at ?? 0);
  }
  return [...byPath.values()].filter((p) => p.lastActive > 0).sort((a, b) => b.lastActive - a.lastActive);
}

// ── rendering ────────────────────────────────────────────────────────────────
const tty = process.stdout.isTTY;
const c = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = c("2"), bold = c("1"), blue = c("34"), green = c("32"), yellow = c("33"), inv = c("7");
const ago = (t: number) => { const d = Date.now() - t; return d < 3600e3 ? `${Math.max(1, Math.round(d / 60e3))}m` : d < DAY ? `${Math.round(d / 3600e3)}h` : `${Math.round(d / DAY)}d`; };
const fit = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
const PATH = ["idea", "shape", "stack", "plan", "build", "ui", "debug", "review", "secure", "qa", "ship", "grow", "learn"];

function row(p: Project, selected: boolean, width: number): string {
  const week = p.sessions.filter((s) => Date.now() - s.at < 7 * DAY).length;
  const last = p.steps.at(-1);
  const phase = p.phase ? blue(fit(p.phase, 7)) : dim(fit("—", 7));
  const what = last ? `${last.skill} ${last.status === "done" ? green("✓") : yellow(last.status)}` : dim(p.sessions[0]?.title ?? "");
  const line = `${fit(p.name, 24)} ${phase} ${fit(ago(p.lastActive), 4)} ${fit(String(week), 3)} ${what}`;
  return selected ? inv(fit(line.replace(/\x1b\[[0-9;]*m/g, ""), width)) : line;
}

function detail(p: Project): string[] {
  const out = [bold(p.name) + dim(`  ${p.path}`), ""];
  if (p.phase) {
    const i = PATH.indexOf(p.phase);
    // ✓ only where a step was actually logged done — position on the path proves nothing.
    const done = new Set(p.steps.filter((s) => s.status === "done").map((s) => s.phase));
    out.push(PATH.map((s, j) => (j === i ? inv(` ${s} `) : done.has(s) ? green(s + " ✓") : dim(s))).join(dim(" · ")), "");
  }
  if (p.steps.length) {
    out.push(bold("Steps"));
    for (const s of p.steps.slice(-6)) out.push(`  ${dim(s.at.slice(0, 10))} ${fit(s.phase, 7)} ${s.skill} ${s.status === "done" ? green("✓") : yellow(s.status)}${s.note ? dim(" — " + s.note) : ""}`);
    out.push("");
  }
  if (p.decisions.length) {
    out.push(bold("Decided"));
    for (const d of p.decisions.slice(-5)) out.push(`  ${d.text}${d.why ? dim(" — " + d.why) : ""}`);
    out.push("");
  }
  out.push(bold(`Sessions (${p.sessions.length})`));
  for (const s of p.sessions.slice(0, 6)) out.push(`  ${dim(fit(ago(s.at), 4))} ${s.title}`);
  return out;
}

function screen(projects: Project[], sel: number, open: boolean) {
  const width = Math.min(process.stdout.columns ?? 100, 140);
  const lines = [bold("raffy") + dim(`  ${projects.length} projects · ${projects.reduce((n, p) => n + p.sessions.length, 0)} sessions`), ""];
  if (open && projects[sel]) lines.push(...detail(projects[sel]), "", dim("esc back · q quit"));
  else {
    lines.push(dim(`${fit("project", 24)} ${fit("phase", 7)} ${fit("last", 4)} ${fit("7d", 3)} latest`));
    const rows = (process.stdout.rows ?? 30) - 6;
    const start = Math.max(0, sel - rows + 1);
    projects.slice(start, start + rows).forEach((p, i) => lines.push(row(p, tty && i + start === sel, width)));
    lines.push("", dim("↑↓ select · enter details · r refresh · q quit"));
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const projects = collect();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(projects, null, 2));
  } else if (process.argv.includes("--once") || !process.stdin.isTTY || !tty) {
    const name = process.argv[process.argv.indexOf("--project") + 1];
    const i = process.argv.includes("--project") ? projects.findIndex((p) => p.name === name) : -1;
    if (process.argv.includes("--project") && i < 0) { console.error(`no project named ${name}`); process.exit(1); }
    console.log(screen(projects, i, i >= 0));
  } else {
    let list = projects, sel = 0, open = false;
    const draw = () => process.stdout.write("\x1b[2J\x1b[H" + screen(list, sel, open));
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write("\x1b[?25l");
    const quit = () => { process.stdout.write("\x1b[?25h\x1b[2J\x1b[H"); process.exit(0); };
    process.stdin.on("data", (k: Buffer) => {
      const key = k.toString();
      if (key === "q" || key === "\x03") return quit();
      if (key === "\x1b[A") sel = Math.max(0, sel - 1);
      else if (key === "\x1b[B") sel = Math.min(list.length - 1, sel + 1);
      else if (key === "\r") open = true;
      else if (key === "\x1b" || key === "\x7f") open = false;
      else if (key === "r") list = collect();
      draw();
    });
    process.stdout.on("resize", draw);
    draw();
  }
}
