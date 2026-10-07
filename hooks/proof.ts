#!/usr/bin/env bun
/**
 * Stop hook. When Claude is about to end its turn saying the tests pass,
 * check that it is true before the user reads it:
 *
 *   - a test command actually ran this turn
 *   - it ran after the last edit, not before
 *   - its output shows no failures
 *   - no test file was weakened: assertions removed, .skip/.only added, tests deleted
 *
 * Any miss → {"decision":"block"} with the reason, so Claude keeps working (or
 * tells the user plainly) instead of stopping on a claim nobody verified.
 * Blocks at most once per stop: stop_hook_active short-circuits the retry.
 *
 * Silent on any turn that makes no test claim. RAFFY_PROOF=off turns it off.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// ── pure checks (exported for tests) ─────────────────────────────────────────

const CLAIM = /\b(all\s+)?(\d+\s+)?(tests?|specs?|suites?|checks?)\s+(now\s+|are\s+|all\s+)*(pass(es|ed|ing)?|green|succeed(ed)?)\b|\b\d+\s+pass(ed|ing)?\b|\btests?\s+are\s+green\b|\bgreen\s+(test\s+)?(run|suite)\b|✅\s*(all\s+)?tests?/i;
const NEGATED = /\b(not|n't|never|no longer|fail(s|ed|ing)?|broken)\b[^.\n]{0,30}\b(pass|green)|\b(pass|green)[^.\n]{0,15}\b(not|n't)\b/i;
// Intent is not a claim: "I'll make the tests pass", "should pass once…", "until they pass".
const FUTURE = /\b(will|'ll|make|making|should|to|until|once|so that|expect(ed)? to)\b[^.\n]{0,25}\b(pass|green)/i;

export function claimsPass(text: string): boolean {
  if (!CLAIM.test(text)) return false;
  // "3 tests still fail" or "tests don't pass yet" is not a pass claim.
  const sentence = text.split(/(?<=[.!?\n])/).find((s) => CLAIM.test(s)) ?? "";
  return !NEGATED.test(sentence) && !FUTURE.test(sentence);
}

export const TEST_CMD = /\b(bun\s+(run\s+)?test|bun\s+run\s+check|(npm|pnpm|yarn)\s+(run\s+)?test|npx\s+(vitest|jest|playwright)|vitest|jest|playwright\s+test|pytest|python\s+-m\s+(pytest|unittest)|go\s+test|cargo\s+test|mix\s+test|rspec|phpunit|dotnet\s+test|make\s+test|deno\s+test)\b/;
const FAIL_OUT = /(^|\s)(\d+\s+fail(ed|ing|ures?)?\b(?!.*\b0\s+fail)|FAIL\s|✗|×\s|Tests?:\s+\d+\s+failed|failures?:\s*[1-9]|AssertionError|panicked at)/m;
const ZERO_FAIL = /\b0\s+fail/;

type Entry = { type?: string; message?: { content?: unknown } };
export type TurnFacts = { testRuns: { cmd: string; ok: boolean; at: number }[]; lastEditAt: number };

/** Facts about the current turn: everything after the last message the user typed. */
export function turnFacts(entries: Entry[]): TurnFacts {
  let start = 0;
  entries.forEach((e, i) => {
    const c = e.message?.content;
    if (e.type === "user" && (typeof c === "string" || (Array.isArray(c) && c.some((x: any) => x?.type === "text")))) start = i;
  });
  const pending = new Map<string, { cmd: string; at: number }>();
  const testRuns: TurnFacts["testRuns"] = [];
  let lastEditAt = -1;
  entries.slice(start).forEach((e, k) => {
    const at = start + k;
    const c = e.message?.content;
    if (!Array.isArray(c)) return;
    for (const x of c as any[]) {
      if (x?.type === "tool_use") {
        if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(x.name)) lastEditAt = at;
        if (x.name === "Bash" && TEST_CMD.test(x.input?.command ?? "")) pending.set(x.id, { cmd: x.input.command, at });
      }
      if (x?.type === "tool_result" && pending.has(x.tool_use_id)) {
        const out = typeof x.content === "string" ? x.content : JSON.stringify(x.content ?? "");
        const failed = x.is_error === true || (FAIL_OUT.test(out) && !ZERO_FAIL.test(out));
        testRuns.push({ ...pending.get(x.tool_use_id)!, ok: !failed });
        pending.delete(x.tool_use_id);
      }
    }
  });
  return { testRuns, lastEditAt };
}

const TEST_FILE = /(^|\/)(__tests__|tests?|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$/;

/** Signs a test file was made easier to pass, from `git diff` output. */
export function weakening(diff: string): string[] {
  const found: string[] = [];
  let file = "";
  let removedAsserts = 0, addedAsserts = 0;
  const flush = () => {
    if (file && removedAsserts > addedAsserts) found.push(`${file}: ${removedAsserts - addedAsserts} assertion(s) removed`);
    removedAsserts = addedAsserts = 0;
  };
  for (const line of diff.split("\n")) {
    const m = line.match(/^diff --git a\/(\S+) b\/(\S+)/);
    if (m) { flush(); file = TEST_FILE.test(m[2]) ? m[2] : ""; continue; }
    if (!file) continue;
    if (/^deleted file mode/.test(line)) { found.push(`${file}: test file deleted`); file = ""; continue; }
    const ASSERT = /\b(expect\(|assert\w*[\s(]|\.should\b|t\.(Error|Fatal)|require\.\w+\()/;
    if (line.startsWith("-") && !line.startsWith("---") && ASSERT.test(line)) removedAsserts++;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (ASSERT.test(line)) addedAsserts++;
      if (/\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe|test)\(|@pytest\.mark\.skip|\bt\.Skip\(|#\[ignore\]/.test(line)) found.push(`${file}: added skip/only — ${line.slice(1).trim().slice(0, 60)}`);
    }
  }
  flush();
  return found;
}

export function verdict(lastMessage: string, facts: TurnFacts, weak: string[]): string | null {
  if (!claimsPass(lastMessage)) return null;
  const problems: string[] = [];
  const last = facts.testRuns.at(-1);
  if (!last) problems.push("no test command ran in this turn");
  else {
    if (!last.ok) problems.push(`the last test run (\`${last.cmd.slice(0, 60)}\`) shows failures`);
    if (facts.lastEditAt > last.at) problems.push("files were edited after the last test run, so that result is stale");
  }
  problems.push(...weak.map((w) => `test weakened — ${w}`));
  if (!problems.length) return null;
  return `raffy proof check: your reply says the tests pass, but ${problems.join("; ")}. Run the tests now and report the real result. If a test was weakened on purpose, say so to the user plainly, with the reason.`;
}

// ── hook ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  try {
    if (process.env.RAFFY_PROOF === "off") process.exit(0);
    const input = JSON.parse(await Bun.stdin.text() || "{}");
    if (input.stop_hook_active) process.exit(0);
    const message: string = input.last_assistant_message ?? "";
    if (!claimsPass(message)) process.exit(0);

    const entries: Entry[] = existsSync(input.transcript_path ?? "")
      ? readFileSync(input.transcript_path, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } })
      : [];
    const diff = spawnSync("git", ["-C", input.cwd ?? ".", "diff", "HEAD"], { encoding: "utf8" }).stdout ?? "";
    const reason = verdict(message, turnFacts(entries), weakening(diff));
    if (reason) console.log(JSON.stringify({ decision: "block", reason }));
  } catch {}
  process.exit(0);
}
