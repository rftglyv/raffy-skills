# Layer: Frontend framework

The first question is not which framework — it is **does a logged-out person need to see this
content?** Yes → server rendering. No → a SPA is simpler, faster to build, and easier to reason
about. Agents over-reach for Next.js on apps that never needed it.

### Next.js (App Router)
**Bun:** partial — runs on bun for most projects; see the Prisma+Turbopack exception
**Docs:** https://nextjs.org/docs · **Teaches:** ssr, server-components, caching, routing
React framework with server components, server actions, route handlers, and rendering strategy
per route.
**Use when** — you need SEO *and* an authenticated app in one codebase · you want one deployable ·
marketing pages and product live together.
**Don't use when** — it is a pure dashboard behind a login (a SPA is less machinery) · you want a
static content site (Astro ships less JS) · the team does not know React.
**Pairs with:** Drizzle, Better Auth, Tailwind, shadcn · **Conflicts with:** Prisma under `--bun`
**Adopt:** hours · **Remove later:** a week+ — the framework shapes the whole codebase
**Gotcha:** the caching model is the most common source of "why is my data stale". Learn it before
shipping, not after.

### Vite + React (SPA)
**Bun:** full · **Docs:** https://vite.dev · **Teaches:** spa-architecture, client-routing, bundling
A client-rendered app with a build step and nothing else.
**Use when** — everything is behind a login · you want the simplest possible mental model · you
have a separate API already (this is the `bhvr` shape).
**Don't use when** — you need SEO or social previews on public pages.
**Adopt:** minutes · **Remove later:** days
**Gotcha:** `bun build` can replace Vite entirely for simple SPAs and libraries.

### Astro
**Bun:** full · **Docs:** https://astro.build · **Teaches:** islands, ssg, partial-hydration
Content-first framework that ships zero JS by default and hydrates only the islands you mark.
**Use when** — marketing sites, docs, blogs, landing pages · Core Web Vitals matter · you want to
use React components without paying for a full React app.
**Don't use when** — the site is really an app with sessions and mutations on every page.
**Pairs with:** MDX, Tailwind, a headless CMS
**Adopt:** hours · **Remove later:** days
**Gotcha:** it will happily render React, Vue and Svelte in one project. Do not.

### TanStack Start
**Bun:** full · **Docs:** https://tanstack.com/start · **Teaches:** type-safe-routing, ssr
Full-stack React with end-to-end type-safe routing and first-class data loading.
**Use when** — you want type-safe routes and loaders and are already deep in the TanStack ecosystem.
**Don't use when** — you need the largest ecosystem and the most hiring-compatible answer. That is
still Next.js.

### React Router (Remix)
**Bun:** full · **Docs:** https://reactrouter.com · **Teaches:** web-fundamentals, progressive-enhancement
Framework mode built on loaders, actions and real form semantics.
**Use when** — you want a web-standards mental model and progressive enhancement by default ·
you deploy to many runtimes.
**Don't use when** — you want the largest component and tutorial ecosystem.

### SvelteKit
**Bun:** full · **Docs:** https://svelte.dev/docs/kit · **Teaches:** reactivity, compiled-frameworks
**Use when** — the team knows Svelte, or you want smaller bundles and less ceremony than React.
**Don't use when** — you need React's component ecosystem, including shadcn/ui in its primary form.

### Nuxt
**Bun:** full · **Docs:** https://nuxt.com · **Teaches:** ssr, file-routing
Vue's full-stack framework.
**Use when** — the team is Vue. **Don't use when** — it is not.

### HTMX / server-rendered templates
**Docs:** https://htmx.org · **Teaches:** hypermedia, progressive-enhancement
**Use when** — an internal tool, a form-heavy CRUD admin, and you want no build step or client
state at all.
**Don't use when** — the UI is genuinely interactive: drag and drop, real-time, complex local state.
**Gotcha:** enormously underrated for admin panels. Consider it before reaching for React.
