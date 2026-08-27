# The shadcn ecosystem — the workflow, not the docs

The CLI in 2026 is a **package manager for UI with a search API, an MCP server, and an official
skill.** Most agents use none of that: they hand-write a component that already exists, finished
and accessible, one search away.

**Docs:** https://ui.shadcn.com/docs — and specifically
[registry directory](https://ui.shadcn.com/docs/directory) ·
[namespaces](https://ui.shadcn.com/docs/registry/namespace) ·
[dynamic search](https://ui.shadcn.com/docs/registry/dynamic-search) ·
[MCP](https://ui.shadcn.com/docs/mcp) · [skills](https://ui.shadcn.com/docs/skills).
Fetch these when wiring; the commands below are the *discipline*, which does not change.

## The discipline: info → search → view → add

1. **`shadcn info --json`** — framework, Tailwind version, aliases, icon library, what is already
   installed. Run it before touching any UI. Stops the second button, the wrong alias, the mixed
   icon set.
2. **`shadcn search @<registry> --query "…"`** — server-side search, so it works against
   registries with thousands of items. This is the step agents skip and the reason generated UI
   looks generated.
3. **`shadcn view @<registry>/<item>`** — read third-party code before it lands in the repo
   permanently. Non-negotiable in a skill whose job is to make the user a reviewer.
4. **`shadcn add @<registry>/<item> …`** — several at once.

The search endpoint is a plain `GET …/registry.json?q=&type=&limit=&offset=`, so an agent can call
it directly and page through `pagination.hasMore` when the CLI is not convenient.

## Wire the two integrations during scaffolding

- **MCP server** — `shadcn mcp init --client claude`, or a `shadcn` entry in `.mcp.json`. Gives the
  agent *hands*: browse, search across every configured registry, install by natural language
  ("find me a login form", "build a landing page from the acme hero and features blocks").
- **Official skill** — `bun dlx skills add shadcn/ui`. Gives the agent *context*: reads
  `shadcn info --json`, carries CLI, theming and registry-authoring knowledge.

Install both. They do different jobs, and together they turn UI work from generation into assembly.

## Registries worth knowing

Directory-listed ones need no config — `shadcn add @<registry>/<item>` just works. Check
[the directory](https://ui.shadcn.com/docs/directory) for the current list; these are the anchors:

| Namespace | Reach for it when |
|---|---|
| `@shadcn` | Always the base. Primitives you own outright. |
| `@originui` | Forms, inputs, application chrome. |
| `@magicui` | Marketing pages that need motion. |
| `@aceternity` | A landing hero that has to impress. |
| `@kibo-ui` | Gaps the core library leaves. |
| `@tweakcn` | Escaping the default slate-and-zinc look. Theme editor. |
| `@tailark` | Landing page blocks. |
| `@v0` | One-off generated screens to adapt. |

Custom and private registries are configured per-project under `registries` in `components.json`,
with `${ENV_VAR}` interpolation for tokens — private GitHub repos work, and any public repo can be
one. A registry can serve hooks, utilities, config, and AI prompt files too, which makes it a real
way to distribute project conventions.

## Rules

1. **Search before you write.** Every time.
2. **`view` before you `add`.** Third-party code is permanent.
3. **Base plus at most two registries.** More and the UI stops looking like one product — mixed
   animation vocabularies and clashing spacing scales read worse than plain shadcn.
4. **Theme before components,** or you re-theme all of them afterwards.
5. **Know that you own `components/ui/*` after install** — no upstream fixes. That is shadcn's
   whole tradeoff. Make it knowingly.
6. **Never commit a literal registry token.** `${VAR}` only.
