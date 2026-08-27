# Recipes — compositions known to work together

A recipe is not a preset. It is a composition that has been verified to boot, with its wiring
already solved. **Reach for one only when the interview already pointed at it.** If the answers do
not match a recipe, compose from the knowledge cards and say plainly that this is a custom stack.

Each recipe names the shape of app it fits and the first thing that will make you outgrow it.

---

## `bhvr` — Bun · Hono · Vite · React

**https://bhvr.dev** · `bun create bhvr@latest`

A typed monorepo: `client/` (Vite + React), `server/` (Hono), `shared/` (TypeScript types both
import), workspaces in the root `package.json`. The shared package is the point — types flow from
API to UI with no codegen step and no drift.

**Fits:** an app behind a login, a dashboard, an internal tool, a product where SEO does not
matter. Bun end to end with no exceptions — this is the recipe where the bun policy has zero
carve-outs.
**Deploy:** client to Cloudflare Pages or any static host; server anywhere bun or Workers run.
**Outgrow it when:** you need server-rendered public pages for SEO — then Next.js or Astro.
**Add next:** Drizzle + Postgres, Better Auth, Zod at the Hono boundary.

## `house` — Next.js · Drizzle · Postgres · Better Auth

`bunx create-next-app` then add. One deployable, App Router, Route Handlers and Server Actions for
the API, Tailwind + shadcn/ui, Docker + GitHub Actions to deploy.

**Fits:** the default for a SaaS with public marketing pages *and* a private app. SEO and auth in
one codebase.
**Bun:** install, test, build and scripts. The Next process itself may need Node — see
`bun-policy.md`; choosing Drizzle over Prisma removes that exception.
**Outgrow it when:** you need Python, or the background work outgrows the web process.
**Add next:** pg-boss when the first slow task appears.

## `sprint` — Next.js · Supabase · Stripe · Vercel

Managed auth, database, storage and hosting. Live in an afternoon.

**Fits:** validating an idea, a hackathon, a deadline measured in days.
**The cost, stated honestly:** row-level security is a cliff — RLS misconfiguration is the single
most common critical hole in vibe-coded apps, and the failure is silent. You also own none of it,
so the eventual migration is real.
**Outgrow it when:** the RLS policy set stops fitting in your head, or the bill outgrows a VPS.
**Graduating from this to `house` is the best lesson in the catalog** — you learn what was being
done for you.

## `split` — Next.js or Vite frontend · FastAPI backend · Postgres

Two deployables, Docker Compose, GitHub Actions.

**Fits:** ML inference, computer vision, heavy data work, or a Python library with no JS
equivalent. **Only when Q4 was genuinely yes.**
**Cost:** two languages, two dependency sets, CORS, auth across a network hop, and a contract
between them that will drift unless you generate it from OpenAPI.
**Outgrow it when:** the services multiply — then read `messaging.md`.

## `content` — Astro (+ React islands where needed)

**Fits:** marketing sites, docs, blogs, landing pages. Ships almost no JavaScript, which is why it
wins on Core Web Vitals without effort.
**Outgrow it when:** the site becomes an app with sessions and mutations everywhere — then Next.js.
**Add next:** a CMS, or MDX in-repo if the authors are technical.

## `edge` — Hono on Cloudflare Workers · D1 or Postgres · Drizzle

**Fits:** APIs, webhook receivers, small services, anything that must be globally low-latency and
cost near nothing at low traffic.
**Cost:** the Workers runtime is not Node — some libraries will not run. Verify each dependency.
**Outgrow it when:** you need long-running processes or a persistent connection pool.

## `mobile` — Expo · React Native · TypeScript

Pairs with any backend recipe above. Add NativeWind if the team already thinks in Tailwind.
**Fits:** iOS and Android from one codebase, over-the-air updates.
**Outgrow it when:** you need deep native platform work — then a native module, not a rewrite.

## `cli` — Bun · TypeScript

`bun build --compile` produces a single executable with no runtime to install. `bun:sqlite` for
local state.
**Fits:** developer tools, scripts that outgrew shell, internal utilities.

---

## Using a recipe correctly

1. **Say which recipe you chose and why**, in the Phase 3 table.
2. **Say what the recipe leaves out.** Every one of them omits something the user will eventually
   need; naming it now is the education.
3. **Do not bend a recipe past its shape.** If the interview says Astro but the app needs sessions
   and mutations everywhere, that is not "Astro plus a bit" — that is the wrong recipe. Compose
   from cards instead.
4. **A custom composition is a normal outcome**, not a failure. Say so when it happens.
