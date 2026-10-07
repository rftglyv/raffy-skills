#!/usr/bin/env bun
/**
 * Open the raffy dashboard: the desktop app if it can run here, the browser
 * page otherwise. One line of output, then it gets out of the way.
 *
 *   bun tui/app.ts            desktop app (builds it first if missing or out of date)
 *   bun tui/app.ts --web      browser dashboard on http://localhost:4747
 *   bun tui/app.ts --rebuild  force a fresh desktop build, then open it
 *
 * The page (tui/web/index.html) is compiled into the desktop binary, so a
 * change to the page also counts as "out of date".
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const TAURI = join(ROOT, "native", "raffy-desktop", "src-tauri");
const BIN = join(TAURI, "target", "release", process.platform === "win32" ? "raffy-desktop.exe" : "raffy-desktop");
const SOURCES = [join(TAURI, "src", "main.rs"), join(TAURI, "tauri.conf.json"), join(TAURI, "Cargo.toml"), join(ROOT, "tui", "web", "index.html")];
const argv = process.argv.slice(2);

const has = (bin: string) => spawnSync(process.platform === "win32" ? "where" : "which", [bin], { stdio: "ignore" }).status === 0;
const mtime = (p: string) => { try { return statSync(p).mtimeMs; } catch { return 0; } };

// Detached, so the app outlives this script and the Claude Code turn that ran it.
function launch(cmd: string, args: string[], env: Record<string, string> = {}) {
  spawn(cmd, args, { detached: true, stdio: "ignore", env: { ...process.env, ...env } }).unref();
}

function openUrl(url: string) {
  if (process.platform === "darwin") launch("open", [url]);
  else if (process.platform === "win32") launch("cmd", ["/c", "start", "", url]);
  else launch("xdg-open", [url]);
}

async function web(reason = "") {
  const url = "http://localhost:4747";
  const up = await fetch(`${url}/`).then((r) => r.ok, () => false);
  if (!up) launch(process.execPath, [join(ROOT, "tui", "web.ts"), "--port", "4747"]);
  for (let i = 0; i < 30 && !(await fetch(`${url}/`).then((r) => r.ok, () => false)); i++) await Bun.sleep(100);
  openUrl(url);
  console.log(`raffy dashboard → ${url}${up ? " (already running)" : ""}${reason ? ` — ${reason}` : ""}`);
}

function running(): boolean {
  if (process.platform === "win32") {
    const r = spawnSync("tasklist", ["/FI", "IMAGENAME eq raffy-desktop.exe"], { encoding: "utf8" });
    return (r.stdout ?? "").includes("raffy-desktop.exe");
  }
  return spawnSync("pgrep", ["-x", "raffy-desktop"], { stdio: "ignore" }).status === 0;
}

if (argv.includes("--web")) {
  await web();
} else if (running() && !argv.includes("--rebuild")) {
  console.log("raffy desktop is already running — click the raffy icon in the menu bar / tray to show it");
} else {
  const stale = !existsSync(BIN) || argv.includes("--rebuild") || SOURCES.some((s) => mtime(s) > mtime(BIN));
  if (stale && !has("cargo")) {
    await web(existsSync(BIN) ? "desktop build is out of date and Rust (cargo) is not installed" : "desktop app needs Rust to build: https://rustup.rs");
  } else {
    if (stale) {
      console.log(existsSync(BIN) ? "rebuilding the desktop app (sources changed) — ~40 s…" : "building the desktop app for the first time — 2–5 min, once…");
      const b = spawnSync("cargo", ["build", "--release"], { cwd: TAURI, stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
      if (b.status !== 0) {
        const last = (b.stderr ?? "").trim().split("\n").filter((l) => /error/.test(l)).slice(-3).join("\n");
        await web(`desktop build failed:\n${last || "see cargo build --release in native/raffy-desktop/src-tauri"}`);
        process.exit(0);
      }
    }
    launch(BIN, [], { RAFFY_ROOT: ROOT });
    console.log("raffy desktop opened — it lives in the menu bar / tray; closing the window keeps it there");
  }
}
