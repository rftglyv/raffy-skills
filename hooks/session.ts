#!/usr/bin/env bun
/**
 * SessionStart hook. If this project has a raffy trail (.raffy/), print the
 * brief: where it is, the last step, what was decided and why — at most 10
 * lines. Projects raffy has never touched get nothing.
 *
 * This is the one piece of ruflo worth keeping: a new session should not have
 * to re-discover last week's decisions. Never fails the session.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { brief } from "../skills/guide/scripts/memory.ts";

try {
  const input = JSON.parse(await Bun.stdin.text() || "{}");
  const cwd: string = input.cwd ?? process.cwd();
  if (existsSync(join(cwd, ".raffy"))) {
    // After a compaction the model has lost the thread; the brief says so and leads with the open step.
    const lines = brief(cwd, input.source === "compact");
    if (lines.length) console.log(lines.join("\n"));
  }
} catch {}
process.exit(0);
