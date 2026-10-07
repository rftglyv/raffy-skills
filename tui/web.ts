#!/usr/bin/env bun
/**
 * raffy dashboard in the browser — the same page and the same data as the
 * desktop app, served locally. No build step, no dependencies, nothing leaves
 * the machine.
 *
 *   bun tui/web.ts [--port 4747]      then open http://localhost:4747
 *
 * Binds to 127.0.0.1 only: session titles and project paths are private.
 * Read-only on purpose: the desktop app can enable skills and open terminals,
 * but an HTTP endpoint for that could be called by any web page you visit.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const port = Number(argv[argv.indexOf("--port") + 1]) || 4747;
const ROOT = join(import.meta.dir, "..");

// Same table as `fn raffy` in native/raffy-desktop/src-tauri/src/main.rs — keep them in step.
const QUERIES: Record<string, string[]> = {
  projects: ["tui/dash.ts", "--json"],
  sessions: ["tui/sessions.ts", "--json"],
  skills: ["skills/guide/scripts/catalog.ts", "list", "--json"],
  drill: ["skills/drill/scripts/ledger.ts", "json"],
  budget: ["skills/doctor/scripts/doctor.ts", "budget", ".", "--json"],
};

// Async: a slow script (doctor runs hooks) must not hold up every other request.
async function query(name: string): Promise<Response> {
  if (!Object.hasOwn(QUERIES, name)) return new Response("not found", { status: 404 });
  const [script, ...rest] = QUERIES[name];
  const proc = Bun.spawn([process.execPath, join(ROOT, script), ...rest], { cwd: homedir(), stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) return Response.json({ error: err.trim().split("\n").at(-1) }, { status: 500 });
  return new Response(out, { headers: { "content-type": "application/json" } });
}

// The page lives in tui/web/index.html so the desktop app can ship the same file.
const page = readFileSync(join(import.meta.dir, "web", "index.html"), "utf8");

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch(req) {
    // 127.0.0.1 keeps other machines out, not other web pages: a site can rebind its
    // DNS name to 127.0.0.1 and read this API as same-origin. Only answer our own names.
    const host = req.headers.get("host");
    if (host !== `127.0.0.1:${server.port}` && host !== `localhost:${server.port}`) return new Response("forbidden", { status: 403 });
    const { pathname } = new URL(req.url);
    if (pathname.startsWith("/api/")) return query(pathname.slice(5));
    if (pathname === "/") return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response("not found", { status: 404 });
  },
});
console.log(`raffy dashboard → http://localhost:${server.port}  (Ctrl-C to stop)`);
