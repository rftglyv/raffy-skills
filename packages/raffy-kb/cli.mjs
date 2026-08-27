#!/usr/bin/env node
/**
 * raffy-kb — thin launcher.
 *
 * The real work is kb.ts, which needs bun for `bun:sqlite`. This wrapper exists
 * so the package installs under npm/npx and still fails with a useful message
 * rather than a module-not-found trace.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const kb = join(here, "kb.ts");
const args = process.argv.slice(2);
const quiet = args.includes("--quiet");

if (!existsSync(kb)) {
  if (!quiet) console.error("raffy-kb: kb.ts missing from the package");
  process.exit(quiet ? 0 : 1);
}

const probe = spawnSync("bun", ["--version"], { stdio: "ignore" });
if (probe.status !== 0) {
  if (quiet) process.exit(0);
  console.error(
    "raffy-kb needs bun (for bun:sqlite, which has no native dependencies).\n" +
    "  curl -fsSL https://bun.sh/install | bash\n" +
    "Then re-run: bunx raffy-kb build",
  );
  process.exit(1);
}

// Default the knowledge dir to the copy bundled in this package.
const bundled = join(here, "knowledge");
const passthrough = [...args.filter((a) => a !== "--quiet")];
// `update` is the user-facing name; kb.ts calls it `build`. Rename before the
// knowledge-dir default is applied, or update never gets the bundled cards.
if (passthrough[0] === "update") passthrough[0] = "build";
if (passthrough[0] === "build" && !passthrough.includes("--knowledge") && existsSync(bundled)) {
  passthrough.push("--knowledge", bundled);
}

const run = spawnSync("bun", [kb, ...passthrough], {
  stdio: quiet ? "ignore" : "inherit",
});
process.exit(quiet ? 0 : (run.status ?? 1));
