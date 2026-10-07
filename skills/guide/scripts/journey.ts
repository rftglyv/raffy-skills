#!/usr/bin/env bun
/**
 * Where a project is on the idea → production path, and the record of how it
 * got there.
 *
 *   bun journey.ts where [project]              signals + inferred phase (--json)
 *   bun journey.ts log   [project] --skill <id> --phase <p> --status <s> [--note "..."] [--session <id>]
 *                        --status started also requires --why "…" and --not "<skill — reason>"; it prints
 *                        the explain block the guide shows the user before running anything
 *   bun journey.ts show  [project] [-n 10]      last steps, newest last (--json)
 *   bun journey.ts all                          every project the guide has touched (--json)
 *
 * Files:
 *   <project>/.raffy/journey.jsonl     one line per step — follows the repo
 *   ~/.claude/raffy/projects.json      one row per project — follows the person,
 *                                      and is what a dashboard reads to show all of them
 *
 * `where` reports what it can SEE. A phase is an inference from files, not a
 * fact: a SPEC.md that nobody agreed to is still a spec on disk. The skill says
 * so when the evidence is thin, and the last logged step outranks the files.
 */
import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

export const PHASES = ["idea", "shape", "stack", "plan", "build", "ui", "debug", "review", "secure", "qa", "ship", "grow", "learn"] as const;
type Phase = (typeof PHASES)[number];
type Status = "started" | "done" | "skipped" | "failed";
type Step = { at: string; skill: string; phase: Phase; status: Status; note?: string; why?: string; not?: string; session?: string };

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined; };
const positional = argv.slice(1).find((a, i, all) => !a.startsWith("-") && !(all[i - 1]?.startsWith("-")));
const PROJECT = resolve(positional ?? ".");
const AS_JSON = argv.includes("--json");

const USER_DIR = process.env.RAFFY_HOME ?? join(homedir(), ".claude", "raffy");
const INDEX = join(USER_DIR, "projects.json");
const journal = (p: string) => join(p, ".raffy", "journey.jsonl");

function readSteps(p: string): Step[] {
  if (!existsSync(journal(p))) return [];
  return readFileSync(journal(p), "utf8").split("\n").filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l) as Step]; } catch { return []; }
  });
}

type Row = { path: string; name: string; phase?: Phase; skill?: string; status?: Status; updatedAt: string; steps: number };
function readIndex(): Record<string, Row> {
  try { return JSON.parse(readFileSync(INDEX, "utf8")); } catch { return {}; }
}

// ── where ────────────────────────────────────────────────────────────────────
function where(p: string) {
  const has = (f: string) => existsSync(join(p, f));
  const anyOf = (...fs: string[]) => fs.find(has);
  const git = (...a: string[]) => spawnSync("git", ["-C", p, ...a], { encoding: "utf8" }).stdout?.trim() ?? "";
  const ls = (d: string) => { try { return readdirSync(join(p, d)); } catch { return []; } };

  const commits = Number(git("rev-list", "--count", "HEAD") || 0);
  const MANIFESTS = ["package.json", "pyproject.toml", "go.mod", "Cargo.toml", "pubspec.yaml", "Gemfile", "composer.json"];
  // Monorepos and plugin repos keep their manifests one level down.
  const nested = ["apps", "packages", "services"].flatMap((d) => ls(d).map((s) => `${d}/${s}`))
    .flatMap((d) => MANIFESTS.map((m) => `${d}/${m}`)).find(has);
  const manifest = anyOf(...MANIFESTS, ".claude-plugin/plugin.json") ?? nested;
  const docSpec = ls("docs").find((f) => /spec|prd|requirements/i.test(f));
  const spec = anyOf("SPEC.md", "spec.md", "docs/SPEC.md", "docs/spec.md", "PRD.md", "docs/prd.md", ".raffy/spec.md")
    ?? (docSpec ? `docs/${docSpec}` : undefined);
  const tasks = anyOf("TASKS.md", "tasks.md", "PLAN.md", "plan.md", "docs/plan.md", ".raffy/tasks.md", "todo.md");
  const tests = (() => {
    const pkg = has("package.json") ? readFileSync(join(p, "package.json"), "utf8") : "";
    if (/"test"\s*:\s*"(?!echo)/.test(pkg)) return "package.json test script";
    return anyOf("tests", "test", "__tests__", "spec", "vitest.config.ts", "jest.config.js", "playwright.config.ts", "pytest.ini");
  })();
  const ui = anyOf("components.json", "app", "src/app", "src/components", "components", "pages", "src/pages", "lib/main.dart", "ios");
  const ci = ls(".github/workflows").length ? ".github/workflows" : anyOf(".gitlab-ci.yml", ".circleci");
  const deploy = anyOf("vercel.json", "fly.toml", "render.yaml", "railway.json", "Dockerfile", "netlify.toml", "wrangler.toml", "app.yaml");
  const raffy = ls(".raffy");
  const dirty = git("status", "--porcelain").split("\n").filter(Boolean).length;
  const steps = readSteps(p);
  const last = steps.at(-1);

  const signals = { commits, manifest, spec, tasks, tests, ui, ci, deploy, raffy, dirty };

  // Files give a floor; the journal gives the truth when it exists.
  let inferred: Phase =
    !manifest && commits === 0 ? (spec ? "stack" : "idea")
    : !manifest ? "stack"
    : !tasks && !tests && commits < 5 ? (spec ? "plan" : "build")
    : !ci && !deploy ? "build"
    : "secure";
  let basis = "files";
  if (last) {
    const i = PHASES.indexOf(last.phase);
    inferred = last.status === "done" && i < PHASES.length - 1 ? PHASES[i + 1] : last.phase;
    basis = `last step: ${last.skill} ${last.status}`;
  }
  const confidence = last ? "high" : manifest || spec ? "medium" : "low";
  return { project: p, name: basename(p), phase: inferred, basis, confidence, signals, last };
}

// ── log ──────────────────────────────────────────────────────────────────────
function log(p: string) {
  const skill = flag("--skill"), phase = flag("--phase") as Phase, status = (flag("--status") ?? "done") as Status;
  if (!skill || !phase) { console.error("log needs --skill <id> --phase <phase>"); process.exit(2); }
  if (!PHASES.includes(phase)) { console.error(`unknown phase "${phase}" — one of: ${PHASES.join(", ")}`); process.exit(2); }
  if (!["started", "done", "skipped", "failed"].includes(status)) { console.error(`unknown status "${status}"`); process.exit(2); }

  const step: Step = { at: new Date().toISOString(), skill, phase, status };
  const note = flag("--note"); if (note) step.note = note;
  // The explanation is not optional. In live runs the guide skipped it whenever
  // the pick looked obvious, so starting a step now requires the reasons.
  const why = flag("--why"), not = flag("--not");
  if (status === "started" && (!why || !not)) {
    console.error('explain before running: add --why "<why this skill, for this request>" and --not "<the skill you did not pick — why>"');
    process.exit(2);
  }
  if (why) step.why = why;
  if (not) step.not = not;
  const session = flag("--session") ?? process.env.CLAUDE_SESSION_ID; if (session) step.session = session;

  mkdirSync(join(p, ".raffy"), { recursive: true });
  appendFileSync(journal(p), JSON.stringify(step) + "\n");

  mkdirSync(USER_DIR, { recursive: true });
  const index = readIndex();
  index[p] = { path: p, name: basename(p), phase, skill, status, updatedAt: step.at, steps: readSteps(p).length };
  writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
  if (status === "started") {
    console.log(`Start the next message the user reads with these two lines, verbatim:\n\nRoute   ${skill} — ${why}\nNot     ${not}`);
  } else console.log(`logged · ${basename(p)} · ${phase} · ${skill} ${status}`);
}

// ── dispatch ─────────────────────────────────────────────────────────────────
const out = (v: unknown, text: () => void) => (AS_JSON ? console.log(JSON.stringify(v, null, 2)) : text());

switch (cmd) {
  case "where": {
    const w = where(PROJECT);
    out(w, () => {
      const s = w.signals;
      const row = (k: string, v: unknown) => console.log(`  ${k.padEnd(9)} ${v === undefined || v === 0 || (Array.isArray(v) && !v.length) ? "—" : Array.isArray(v) ? v.join(", ") : v}`);
      console.log(`${w.name} · phase: ${w.phase} (${w.confidence}, from ${w.basis})\n`);
      row("commits", s.commits); row("manifest", s.manifest); row("spec", s.spec); row("tasks", s.tasks);
      row("tests", s.tests); row("ui", s.ui); row("ci", s.ci); row("deploy", s.deploy);
      row(".raffy", s.raffy); row("dirty", s.dirty ? `${s.dirty} uncommitted` : 0);
    });
    break;
  }
  case "log": log(PROJECT); break;
  case "show": {
    const steps = readSteps(PROJECT).slice(-Number(flag("-n") ?? 10));
    out(steps, () => {
      if (!steps.length) return console.log("no steps logged yet");
      for (const s of steps) console.log(`  ${s.at.slice(0, 16).replace("T", " ")}  ${s.phase.padEnd(7)} ${s.status.padEnd(8)} ${s.skill}${s.note ? ` — ${s.note}` : ""}`);
    });
    break;
  }
  case "all": {
    const rows = Object.values(readIndex()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    out(rows, () => {
      if (!rows.length) return console.log("no projects yet");
      for (const r of rows) console.log(`  ${r.updatedAt.slice(0, 10)}  ${r.name.padEnd(24)} ${String(r.phase).padEnd(7)} ${r.skill} ${r.status}`);
    });
    break;
  }
  default:
    console.error("usage: journey.ts where|log|show|all [project] …");
    process.exit(2);
}
