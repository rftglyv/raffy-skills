# Layer: Runtime, package manager & toolchain

Read `../references/bun-policy.md` alongside this. The default is bun; this file is about when it
is not.

### bun
**Bun:** n/a · **Docs:** https://bun.sh/docs · **Teaches:** toolchain-unification, esm
Runtime, package manager, test runner, bundler and script runner in one binary. TypeScript runs
directly with no build step.
**Use when** — default for every JS/TS project · you want one lockfile and one toolchain · you are
self-hosting or deploying to Docker · you want `bun test` and `bun build` instead of four devDeps.
**Don't use when** — you depend on a native node-gyp addon that has no alternative · you need PM2
or an APM agent that hooks Node internals · your host only runs Node (then bun stays as your local
and CI toolchain).
**Pairs with:** Hono, Elysia, Drizzle, SQLite · **Conflicts with:** Prisma under `--bun` + Turbopack
**Adopt:** minutes · **Remove later:** hours
**Gotcha:** `bun install` is safe on literally any project including Node ones. The runtime is the
part that needs verification, not the package manager.

### node
**Bun:** n/a · **Docs:** https://nodejs.org/docs · **Teaches:** runtime-compatibility
The incumbent. Widest compatibility, every host supports it, every library targets it.
**Use when** — a dependency needs node-gyp or V8 internals · your deploy target is Vercel, Lambda
or a PaaS that runs Node · you need PM2 or a Node-specific APM.
**Don't use when** — nothing forces it. There is no longer a default-choice argument for Node over
bun in greenfield work.
**Adopt:** free · **Remove later:** hours
**Gotcha:** using Node at runtime does not mean using npm. Keep `bun install` and `bun test`.

### deno
**Bun:** n/a · **Docs:** https://docs.deno.com · **Teaches:** capability-security, web-standards
Secure-by-default runtime with explicit permissions and web-standard APIs.
**Use when** — you specifically want the permission model, or you are on Deno Deploy.
**Don't use when** — anything else. The ecosystem gravity is with bun and Node, and mixing three
runtimes across projects costs more than it returns.
**Adopt:** hours · **Remove later:** days

### npm / pnpm / yarn
**Docs:** https://pnpm.io · **Teaches:** dependency-resolution
**Use when** — a team standard requires it, or CI is locked to it. pnpm is the best of the three
for large monorepos with strict peer-dependency handling.
**Don't use when** — you have a free choice. `bun install` is faster and the lockfile is fine.
**Gotcha:** never commit two lockfiles. Pick one, delete the others, add the rest to `.gitignore`.

### turborepo / nx
**Docs:** https://turborepo.com · **Teaches:** monorepo-caching, task-graphs
Build orchestration and remote caching for monorepos.
**Use when** — several packages with real interdependencies and CI times you have measured as
painful.
**Don't use when** — under ~4 packages. Bun workspaces alone handle a small monorepo, and bhvr
ships one with no orchestrator at all.
**Adopt:** hours · **Remove later:** a day
