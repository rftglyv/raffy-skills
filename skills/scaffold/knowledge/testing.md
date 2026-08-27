# Layer: Testing

**One real test in the first commit.** Not for coverage — so that the second test is easy to write.
A project with zero tests stays at zero.

What matters most in an AI-built codebase, in order: **the authorization tests** (can user A read
user B's row?), **the money tests** (does a replayed webhook double-charge?), and **one end-to-end
path** through the product. Coverage percentage is close to meaningless next to those three.

**Never let an agent fix a failing test by changing the assertion** unless you have confirmed the
assertion was wrong. That is the most common way AI-assisted work silently breaks behavior.

### `bun test`
**Bun:** full · **Docs:** https://bun.sh/docs/cli/test
**Teaches:** unit-testing, mocking, snapshots
Jest-compatible runner built into the runtime. No dependencies, no config.
**Use when** — the default for server-side TypeScript: units, API handlers, utilities, integration.
Roughly 3–6s on a 1,500-case suite against Vitest's 10–15s, with sub-second watch.
**Don't use when** — DOM component tests, where Vitest's environment story is better.
**Adopt:** minutes

### Vitest
**Bun:** full · **Docs:** https://vitest.dev · **Teaches:** component-testing, jsdom, test-environments
**Use when** — React, Vue or Svelte component tests · an existing Vite project.
**Don't use when** — server-only TypeScript on bun. Running both runners is normal: `bun test` for
server, Vitest for components.

### Playwright
**Bun:** partial · **Docs:** https://playwright.dev
**Teaches:** e2e-testing, selectors, flakiness, test-isolation
Real browsers, real user flows.
**Use when** — one or two critical paths: sign up, pay, the core action. That is the right amount.
**Don't use when** — you are tempted to E2E everything. Slow, flaky, and expensive to maintain.
**Adopt:** ~half a day · **Gotcha:** a Playwright MCP server exists, which lets an agent drive the
browser directly — useful for verifying its own work.

### MSW (Mock Service Worker)
**Docs:** https://mswjs.io · **Teaches:** mocking, network-layer-testing
Intercepts at the network layer so tests exercise real client code.
**Use when** — testing components or code that calls APIs.

### Testcontainers
**Docs:** https://testcontainers.com · **Teaches:** integration-testing, ephemeral-infrastructure
Real Postgres or Redis in a container, per test run.
**Use when** — integration tests that must hit a real database. Far more trustworthy than mocking
an ORM.
**Don't use when** — unit tests. Too slow for the inner loop.

### Type checking as a test
`tsc --noEmit` in CI. **Strict mode on from the first commit.** Turning it on later means fixing
hundreds of errors at once, so almost nobody does — which is why so many AI-built TypeScript
codebases are effectively untyped.
