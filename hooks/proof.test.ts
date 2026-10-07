import { test, expect } from "bun:test";
import { claimsPass, turnFacts, weakening, verdict } from "./proof.ts";

test("claims", () => {
  for (const s of ["All tests pass.", "23 tests pass, typecheck clean", "Tests are green now", "✅ all tests", "the suite passes", "12 passed"])
    expect(claimsPass(s)).toBe(true);
  for (const s of ["3 tests still fail", "Tests don't pass yet.", "I'll make the tests pass next", "No tests ran.", "Renamed the variable."])
    expect(claimsPass(s)).toBe(false);
});

const user = (t: string) => ({ type: "user", message: { content: t } });
const call = (id: string, name: string, input: object) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
const result = (id: string, content: string, is_error = false) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content, is_error }] } });

test("a passing run after the last edit is proof", () => {
  const f = turnFacts([user("fix it"), call("1", "Edit", {}), call("2", "Bash", { command: "bun test" }), result("2", " 23 pass\n 0 fail")]);
  expect(verdict("All tests pass.", f, [])).toBeNull();
});

test("no test run this turn", () => {
  const f = turnFacts([user("old"), call("1", "Bash", { command: "bun test" }), result("1", "5 pass"), user("now fix the bug"), call("2", "Edit", {})]);
  expect(verdict("Fixed, all tests pass.", f, [])).toContain("no test command ran");
});

test("edit after the run makes it stale", () => {
  const f = turnFacts([user("go"), call("1", "Bash", { command: "npm test" }), result("1", "Tests: 8 passed"), call("2", "Edit", {})]);
  expect(verdict("All 8 tests pass.", f, [])).toContain("stale");
});

test("failing output is caught even with exit 0", () => {
  const f = turnFacts([user("go"), call("1", "Bash", { command: "bun test" }), result("1", " 21 pass\n 2 fail")]);
  expect(verdict("Tests pass.", f, [])).toContain("shows failures");
});

test("is_error counts as a failure", () => {
  const f = turnFacts([user("go"), call("1", "Bash", { command: "pytest" }), result("1", "exit 1", true)]);
  expect(verdict("all tests passing", f, [])).toContain("shows failures");
});

test("weakened tests", () => {
  const diff = [
    "diff --git a/src/total.test.ts b/src/total.test.ts",
    "--- a/src/total.test.ts", "+++ b/src/total.test.ts",
    "-  expect(total(100, 0.1)).toBe(110)",
    "-  expect(total(0, 0)).toBe(0)",
    "+  it.skip('rounds to cents', () => {})",
    "diff --git a/src/total.ts b/src/total.ts",
    "-  expect(x)",
    "diff --git a/tests/old.spec.ts b/tests/old.spec.ts",
    "deleted file mode 100644",
  ].join("\n");
  const w = weakening(diff);
  expect(w.some((x) => x.includes("2 assertion(s) removed"))).toBe(true);
  expect(w.some((x) => x.includes("skip/only"))).toBe(true);
  expect(w.some((x) => x.includes("test file deleted"))).toBe(true);
  expect(w.some((x) => x.startsWith("src/total.ts"))).toBe(false);   // not a test file
});

test("rewriting an assertion is not weakening", () => {
  const diff = "diff --git a/a.test.ts b/a.test.ts\n-  expect(f()).toBe(1)\n+  expect(f()).toBe(2)";
  expect(weakening(diff)).toEqual([]);
});

test("no claim, no check", () => {
  expect(verdict("Renamed the helper.", { testRuns: [], lastEditAt: 3 }, ["x"])).toBeNull();
});
