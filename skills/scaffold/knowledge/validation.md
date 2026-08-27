# Layer: Validation & contracts

**Validate at every boundary where data enters your system**: HTTP request bodies, query params,
webhook payloads, form submissions, environment variables, and third-party API responses. Not just
the ones you expect to be attacked — the ones you expect to be malformed, which is all of them.

Unvalidated input is one of the most reliable holes in AI-generated code, because the happy path
works and nothing complains.

### Zod
**Bun:** full · **Docs:** https://zod.dev · **Teaches:** runtime-validation, type-inference, parse-dont-validate
Schema declaration and validation with static types inferred from the schema — one definition, no
drift between the type and the check.
**Use when** — the default for TypeScript. Works everywhere: forms, API boundaries, env vars,
LLM structured output.
**Don't use when** — you are on Elysia (TypeBox is native) or bundle size is critical (Valibot).
**Pairs with:** React Hook Form, Hono, Drizzle, the AI SDK · **Adopt:** minutes
**Gotcha:** validate `process.env` with a Zod schema at startup. A missing env var should crash on
boot, not at 3am in a code path nobody ran.

### TypeBox
**Bun:** full · **Docs:** https://github.com/sinclairzx81/typebox · **Teaches:** json-schema, openapi
JSON-Schema-based validation with static type inference. Faster than Zod and produces real JSON
Schema, so OpenAPI docs come free.
**Use when** — Elysia (it is native there) · you need JSON Schema or OpenAPI output.
**Don't use when** — Zod's ecosystem integration matters more than raw speed.

### Valibot
**Bun:** full · **Docs:** https://valibot.dev · **Teaches:** tree-shaking, runtime-validation
Zod-like API, modular so unused validators are tree-shaken out.
**Use when** — client bundle size is a hard constraint. **Don't use when** — server-side, where the
bundle does not matter and Zod's ecosystem wins.

### ArkType
**Docs:** https://arktype.io · **Use when** — you want TypeScript-syntax schemas and top-tier
performance. **Don't use when** — you need the largest ecosystem.

### OpenAPI / schema-generated clients
**Docs:** https://openapis.org · **Teaches:** api-contracts, codegen, drift
**Use when** — a Python or Go backend serves a TypeScript frontend, or a third party consumes your
API. Generate the client; never hand-write it.
**Gotcha:** the FastAPI + hand-written TS client combination drifts within weeks. This is the fix.
