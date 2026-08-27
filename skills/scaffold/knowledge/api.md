# Layer: API / backend

Ask first: **do you need a second deployable at all?** A Next.js app with route handlers is one
service, one deploy, one set of env vars. A separate API is correct when the frontend is a SPA or
mobile app, when several clients share it, or when the language must differ. Otherwise it is
overhead the user pays for daily.

### Next.js Route Handlers + Server Actions
**Bun:** partial · **Docs:** https://nextjs.org/docs/app/building-your-application/routing/route-handlers
**Teaches:** request-boundary, server-client-split
**Use when** — the frontend is Next.js and there is one client · you want a single deployable.
**Don't use when** — a mobile app or third party also consumes the API · the backend needs to scale
independently of the UI.
**Gotcha:** Server Actions are for mutations from *your own* UI. Webhooks and public endpoints go in
route handlers. Mixing them up produces endpoints with no auth check.

### Hono
**Bun:** full · **Docs:** https://hono.dev · **Teaches:** middleware, routing, web-standards, edge
Tiny web-standards router that runs on bun, Node, Cloudflare Workers, Deno and Lambda.
**Use when** — you want portability across runtimes · Cloudflare Workers · a small, fast, boring API
· you value being able to move hosts later.
**Don't use when** — you want batteries-included structure for a large team (see NestJS).
**Pairs with:** Zod, Drizzle, bhvr, Cloudflare · **Adopt:** minutes · **Remove later:** hours
**Gotcha:** the type-safe RPC client makes a Hono + React monorepo feel like tRPC with no extra layer.

### Elysia
**Bun:** full — bun-native by design · **Docs:** https://elysiajs.com
**Teaches:** type-inference, schema-first-apis, openapi
The fastest bun-native framework, with end-to-end types to the client via Eden and TypeBox schemas
that double as validation and OpenAPI.
**Use when** — you are all-in on bun · you want the strongest type story from handler to client ·
raw throughput matters.
**Don't use when** — you might need to run on Node or Workers later (Hono is the portable choice).
**Pairs with:** TypeBox, Drizzle, bun · **Adopt:** hours · **Remove later:** hours

### Fastify
**Bun:** partial · **Docs:** https://fastify.dev · **Teaches:** plugins, json-schema
Mature, fast, plugin-based Node framework with JSON-schema validation built in.
**Use when** — a Node-first team wants something proven with a deep plugin ecosystem.
**Don't use when** — greenfield on bun; Hono or Elysia are lighter and faster there.

### Express
**Bun:** full · **Docs:** https://expressjs.com · **Teaches:** middleware, http-basics
**Use when** — you are maintaining something that already uses it, or a tutorial-familiarity
requirement genuinely exists.
**Don't use when** — greenfield. Slower, no built-in types, no validation. Chosen out of habit.

### NestJS
**Bun:** partial · **Docs:** https://nestjs.com · **Teaches:** dependency-injection, modular-architecture
Opinionated, Angular-inspired, DI-based framework.
**Use when** — a large team needs enforced structure · you are coming from Spring or .NET and want
familiar shape.
**Don't use when** — a small team or a solo builder. The ceremony outweighs the benefit under about
five engineers.
**Adopt:** days · **Remove later:** weeks

### FastAPI
**Bun:** n/a (Python) · **Docs:** https://fastapi.tiangolo.com
**Teaches:** python-typing, openapi, async-python, service-boundaries
Typed async Python with automatic OpenAPI, backed by Pydantic.
**Use when** — you genuinely need Python: ML inference, computer vision, scientific or heavy data
work, or a library with no JS equivalent.
**Don't use when** — "we might do AI later." Calling an LLM API is an HTTP request.
**Pairs with:** SQLAlchemy, Pydantic, Postgres · **Adopt:** hours · **Remove later:** a week
**Gotcha:** generate the client from its OpenAPI schema. A hand-written TypeScript client against a
Python API drifts within weeks.

### tRPC
**Bun:** full · **Docs:** https://trpc.io · **Teaches:** rpc, end-to-end-types
Type-safe RPC between a TypeScript client and server with no schema or codegen.
**Use when** — one TypeScript monorepo, one client, and type safety is the top priority.
**Don't use when** — a mobile app, a third party, or any non-TS consumer needs the API. You would be
building a private protocol where you needed a public one.
**Gotcha:** Hono RPC and Elysia Eden give most of the benefit without the extra layer.

### Go (chi / Echo) · Rust (Axum)
**Docs:** https://go.dev · https://docs.rs/axum
**Teaches:** static-typing, concurrency, systems-tradeoffs
**Use when** — a measured CPU-bound bottleneck, very high throughput, or a single distributable
binary is a hard requirement.
**Don't use when** — you have not measured. A second language doubles the maintenance surface, and
this is a common over-build.
