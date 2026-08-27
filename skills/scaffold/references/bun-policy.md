# The bun policy

**Default to bun at every layer it can serve.** Runtime, package manager, test runner, bundler,
script runner, and its built-in SQLite, S3 and password APIs. One toolchain, one lockfile, no
`node_modules` archaeology.

This is not a preference. `bun install` is the fastest correct package manager, `bun test` runs a
1,500-case server-side suite in ~3–6s against Vitest's ~10–15s with sub-second watch, and
`bun build` replaces a Vite or Webpack config outright for SPAs and libraries.

**But bun is a tool, not a religion.** When it is the wrong call, say so out loud and say why.
A silent deviation teaches the user nothing and looks like a mistake.

## Where bun wins outright

| Use | Command | Replaces |
|---|---|---|
| Install | `bun install` | npm, pnpm, yarn — universally safe, even on Node projects |
| Run | `bun run x` / `bun x.ts` | node, ts-node, tsx — TypeScript runs directly, no build step |
| Test | `bun test` | jest, vitest — for server-side TS |
| Bundle | `bun build` | esbuild, webpack, vite (for SPAs and libraries) |
| Watch | `bun --hot` | nodemon |
| SQLite | `bun:sqlite` | better-sqlite3 — built in, no native compile |
| Scripts | `#!/usr/bin/env bun` | shell scripts that outgrew shell |
| Monorepo | workspaces in root `package.json` | turborepo (for small monorepos) |

API servers on Hono or Elysia, Drizzle, CLI tools, scripts, CI, and self-hosted Docker are all
bun end to end with no caveats.

## The exception list

Five places to deviate. These are the complete list as of 2026 — check before adding a sixth.

### 1. Prisma under `bun --bun` with Next.js Turbopack — broken

`@prisma/adapter-pg` fails to dynamically resolve the `pg` driver because the `--bun` flag
sandboxes module resolution (prisma/prisma#28956, oven-sh/bun#25032).

**Options, in order of preference:** pick Drizzle, which is clean on bun · or keep Prisma and run
Next on Node while still using `bun install` for packages · or keep Prisma outside the Next
process, in a separate worker or API service.

### 2. Native node-gyp addons

`sharp`, `canvas`, some native crypto wrappers and a few database drivers may fail to build or
run. This is the largest remaining gap and it is shrinking, but verify rather than assume.

**Fix:** check the specific package before committing to it. Most have a WASM or pure-JS
alternative now; where they do not, run that one process on Node.

### 3. PM2 and most APM agents

They depend on `process.binding`, internal modules, and cluster semantics bun does not fully
match.

**Fix:** you do not need PM2 under Docker — the container is the supervisor. Use `bun --hot` in
dev and a restart policy in prod. For APM, prefer OpenTelemetry, which bun supports.

### 4. Vercel, AWS Lambda, and most managed PaaS

The deploy target runs Node regardless of what you develop on. This does not mean stop using bun
— it means bun is your local and CI toolchain and Node is the production runtime, which is fine
and extremely common.

**Fix:** `bun install` and `bun test` in CI, Node at runtime. Nothing changes in your code. If you
want bun in production too, self-host on Docker or use Cloudflare Workers with Hono.

### 5. React / Vue / Svelte component tests

`bun test` owns server-side TypeScript. For DOM-environment component testing, Vitest still has
the better story with the Vite module graph and `jsdom`/`happy-dom` integration.

**Fix:** `bun test` for server, unit and integration; Vitest for component tests; Playwright for
end-to-end. Running both is normal and cheap.

## How to present a deviation

Never silently drop to Node. Say it in one line at proposal time:

> Runtime: **bun** everywhere except the Next.js process, which runs on Node — Prisma's driver
> resolution is broken under `--bun` with Turbopack (bun#25032). You still get `bun install`,
> `bun test`, and one lockfile. Switch to Drizzle and this exception disappears.

That sentence is a lesson. Silence is not.
