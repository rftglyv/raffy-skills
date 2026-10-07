#!/usr/bin/env bun
/**
 * raffy dashboard in the browser — the same data as `dash.ts --json`, served
 * locally. No build step, no dependencies, nothing leaves the machine.
 *
 *   bun tui/web.ts [--port 4747]      then open http://localhost:4747
 *
 * Binds to 127.0.0.1 only: session titles and project paths are private.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collect } from "./dash.ts";

const argv = process.argv.slice(2);
const port = Number(argv[argv.indexOf("--port") + 1]) || 4747;

// The page lives in tui/web/index.html so the desktop app can ship the same file.
const page = readFileSync(join(import.meta.dir, "web", "index.html"), "utf8");

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/projects") return Response.json(collect());
    if (pathname === "/") return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response("not found", { status: 404 });
  },
});
console.log(`raffy dashboard → http://localhost:${server.port}  (Ctrl-C to stop)`);
