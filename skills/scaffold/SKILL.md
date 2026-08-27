---
name: scaffold
description: Interview the user about what they are building, compose a right-sized stack from a knowledge base of ~90 technologies, scaffold it with secure defaults, wire up AI-development tooling, and explain every decision so the user learns to supervise the agent. Use when asked to "start a new project", "set up a new app", "pick a stack", "which database/ORM/framework should I use", "scaffold a SaaS/API/mobile app", "bootstrap a repo", or when someone describes an app idea and needs the first commit. Not for adding a single library to an existing project — read the relevant knowledge card and just add it.
---

# Scaffold

Compose the stack. Do not pick a preset.

The output is a running project the user understands — not a template they inherited. Every
component in it was chosen against a stated constraint, and the user was told what was rejected
and what would change that verdict.

## The prime directive

**Not big, not small, scalable later.**

Three failure modes, and you are avoiding all of them:

- **Too small** — SQLite and a single file, then a rewrite at the first real user.
- **Too big** — Kafka, Kubernetes and a service mesh for an app with 40 users. Most common
  failure in AI-generated architecture, because the model pattern-matches to what "serious"
  systems look like.
- **Wrong shape** — the right components wired so the cheap change is expensive later.

The target is the smallest stack that does not need to be *replaced* to grow — only *added to*.
Postgres scales from prototype to 100k users untouched. A queue can be added later without
rewriting the app, **if** the long-running work was put behind a function boundary on day one.
That boundary is free today and costs a week in six months. That is the entire skill.

## The three non-negotiables

1. **Interview before composing.** Never propose a stack before Phase 1 is answered. A stack
   chosen from a one-line app description is a preset with extra steps.
2. **Name what you rejected.** Every decision is presented with the alternative you did not pick,
   why, and the concrete signal that would flip it. A choice without its rejected sibling teaches
   nothing.
3. **Secure by default, always.** Row-level authorization, server-only secrets, validated input at
   every boundary, and no service role key within reach of a browser. These are not phase-two
   items. 65% of scanned AI-built apps ship with security holes because they were.

---

## Phase 0 — Read the room

Before asking anything, check whether this is actually a new project.

```bash
ls -a && cat package.json 2>/dev/null && git log --oneline -5 2>/dev/null
```

- **Empty directory** → full interview, Phase 1.
- **Existing code** → this is not a scaffold. Offer instead: add a component (read its knowledge
  card, install it properly), or `/raffy:qa-audit` if they want to know what is wrong with what
  they have. Stop here unless they confirm they want a fresh project.

If a `.raffy/progress.md` exists, read it. It tells you what this user already knows, so you can
skip explanations they have earned and go deeper where they have not.

---

## Phase 1 — The interview

Ask these. **Ask them one message at a time if the user seems new; batch them if they are fluent.**
Do not skip a question because you think you can infer the answer — the wrong inference is the
whole problem.

Read `references/interview.md` for the full question tree, the follow-ups, and what each answer
maps to.

The five that decide almost everything:

1. **What are you building, and who uses it?** One paragraph. Push for the actual thing, not the
   category. "A booking tool for barbershops" decides more than "a SaaS".
2. **Do people log in — and can any user see another user's data?** This decides auth *and*
   row-level authorization, which is the single most common hole in AI-built apps.
3. **Does anything take longer than a web request?** Sending email, calling an LLM, generating a
   report, processing video, hitting a slow third-party API. Anything over ~2 seconds.
4. **Is there anything JavaScript is genuinely bad at here?** ML inference, scientific computing,
   heavy data work, an existing Python library you must use.
5. **Realistically, how many people use this in six months?** Ten, a thousand, a hundred thousand.
   Be blunt that the honest answer is usually "ten" and that this is fine — it is what keeps the
   stack from being over-built.

Two more when the answers warrant it: **do you take money?** (payments + webhooks + idempotency)
and **who maintains this in a year?** (a solo non-engineer needs different defaults than a team).

### Reading the answers

Ambiguity is normal. Resolve it with a follow-up, not a guess. When the user says "I don't know",
that is an answer — it means *no known constraint*, so choose the smaller option and record the
trigger that would change it.

---

## Phase 2 — Compose

Read only the knowledge layers the interview made relevant. Each file in `knowledge/` holds every
option for one layer with a `Use when` / `Don't use when` / `Bun` / `Cost to remove` block per
option. Compare within the file; do not choose from memory.

| Layer | File | Read when |
|---|---|---|
| Runtime & package manager | `knowledge/runtime.md` | always |
| Frontend framework | `knowledge/frontend.md` | anything with a UI |
| API / backend | `knowledge/api.md` | always |
| Database | `knowledge/database.md` | anything with persistence |
| ORM / query layer | `knowledge/orm.md` | with a database |
| Validation & contracts | `knowledge/validation.md` | always |
| Auth & authorization | `knowledge/auth.md` | if anyone logs in |
| Styling & components | `knowledge/styling.md` | anything with a UI |
| Background jobs | `knowledge/jobs.md` | if Q3 was yes |
| Messaging & streaming | `knowledge/messaging.md` | only if jobs is not enough |
| Payments | `knowledge/payments.md` | if they take money |
| Email & notifications | `knowledge/notifications.md` | almost always |
| File storage | `knowledge/storage.md` | if users upload |
| Search | `knowledge/search.md` | if users search |
| AI & LLM | `knowledge/ai.md` | if the product uses a model |
| Testing | `knowledge/testing.md` | always |
| Observability | `knowledge/observability.md` | always |
| Hosting & deploy | `knowledge/hosting.md` | always |
| Mobile | `knowledge/mobile.md` | if there is an app |

Then apply, in order:

1. **`references/bun-policy.md`** — bun is the default at every layer it can serve. The exception
   list is short, specific, and you must say the reason out loud when you deviate.
2. **`references/growth-ladders.md`** — for jobs, messaging, search, caching and observability,
   take the *lowest rung that meets a stated constraint*. Earn the infrastructure.
3. **`references/recipes.md`** — check whether the composition matches a known-good recipe
   (bhvr, house-stack, sprint, split, content). If it does, use the recipe's verified wiring
   instead of inventing it. If it does not, that is fine — say so.

### Compatibility check

Before presenting, verify the composition actually runs together. The known sharp edges are in
`references/bun-policy.md` and each card's `Conflicts with` field. The one that bites most often:
**Prisma under `bun --bun` with Next.js Turbopack is broken** — pick Drizzle, or run Next on Node.

---

## Phase 3 — Present the decision

Never scaffold silently. Print this table first and get a yes.

```
STACK PROPOSAL — <project name>

Runtime      bun 1.x                    ← everything: install, test, build, run
Frontend     Next.js (App Router)       ← you need SEO + server rendering
API          Next Route Handlers        ← one deployable; no second service to run
Database     Postgres                   ← relational data, scales without replacement
ORM          Drizzle                    ← SQL-first, clean under bun
Auth         Better Auth                ← self-hosted, owns its tables, RLS-compatible
Validation   Zod                        ← one schema, inferred types, validates every boundary
Styling      Tailwind + shadcn/ui       ← you own the component code
Jobs         none (yet)                 ← nothing outlives a request today
Hosting      Docker + GitHub Actions    ← portable; no vendor to migrate off later

REJECTED, AND WHAT WOULD CHANGE IT
  Prisma        Better migrations, worse under bun. Flip if the team prefers schema-first
                and you accept running Next on Node.
  Supabase      Faster to launch, but you would learn RLS the hard way and own none of it.
                Flip if you need to ship in a weekend.
  A job queue   No task currently outlives a request. Flip the moment you add email sending,
                a PDF export, or any LLM call over ~2s — then take pg-boss, not BullMQ.
  Redis         Nothing to cache yet, no sessions to store. Flip at ~1k concurrent users
                or the first slow dashboard query.
  A broker      You have one service. Flip when you have three that must talk asynchronously.

WHAT THIS TEACHES YOU
  Row-level authorization · schema migrations · the request/background boundary
```

Ask: **"Does this look right, or do you want to change anything?"** If they push back on a
choice, that is a teaching moment, not a fight — explain the tradeoff and defer to them. Record
the override in the ledger.

---

## Phase 4 — Build it

Scaffold in this order. Verify each step runs before continuing; a scaffold that does not boot is
worse than none.

1. **Init.** Prefer the ecosystem's own creator (`bun create bhvr@latest`, `bunx create-next-app`,
   `bun create hono`) over hand-assembling files. Then `bun install`.
2. **Config.** `tsconfig.json` strict on. `.env.example` committed, `.env` git-ignored, and a
   `.gitignore` that covers it *before the first commit*.
3. **Data.** Schema, first migration, and a seed script. Migrations from day one — retrofitting
   them onto a hand-edited database is genuinely painful.
4. **Auth.** Wired, with row-level authorization enforced server-side. Never a client-side role
   check. See the `auth` card's checklist.
5. **One real vertical slice.** One route, end to end: validated input → authorized query →
   rendered output. Not a placeholder. This proves the wiring and becomes the pattern the agent
   copies for everything after.
6. **One test.** `bun test` on the slice. It exists so the second test is easy to write.
7. **DX tooling.** Phase 5.
8. **First commit.** Then `git init` + first commit, with the `.gitignore` already correct.

Never write secrets into any file that ships to a browser. If a key must reach the client, it is
a publishable key by design — check, do not assume.

---

## Phase 5 — Wire the AI-development tooling

This is a scaffolding step, not an afterthought. The tools that make an agent produce good work
belong in the repo from commit one. Read `references/dx-tooling.md` and set up:

- **`CLAUDE.md`** — written from the interview answers. Stack, conventions, commands, and the
  constraints you deliberately chose. This is what stops the agent re-deciding your architecture
  every session.
- **Impeccable** — design-quality guardrails, so generated UI does not converge on the same
  AI defaults. Offer to install it.
- **Agentation** — point-and-annotate feedback on the running UI that reaches the agent as
  structured context instead of "make the button better".
- **shadcn registries** — configure `components.json` with the namespaces relevant to the project
  so components come from a curated registry, not from scratch each time.
- **Hooks and CI** — format, typecheck, and `bun test` on commit and in Actions.

---

## Phase 6 — Teach, and record it

The point is not the repo. The point is that after a few projects the user can supervise the
agent instead of trusting it.

Write `.raffy/progress.md` in the project and append to `~/.claude/raffy/progress.md`:

```markdown
## <project> — <date>
Stack: <one line>
Decisions the user made themselves: <list>
Decisions deferred to the agent: <list>
Concepts introduced: row-level-authorization, migrations, request-boundary
Triggers to watch: add pg-boss when email sending lands
```

Then, in chat, give them **three things to watch for** in this specific codebase — the places
where an agent will plausibly do the wrong thing. Concrete, with file paths. That list is what
turns them into a reviewer.

Close with the one command that runs the app.

---

## Rules

- **Interview first.** No stack proposal before Phase 1 answers exist.
- **Every choice carries its rejected sibling and a flip trigger.** No exceptions.
- **Take the lowest rung that meets a stated constraint.** Speculative scale is a bug.
- **bun by default; name the reason whenever you deviate.**
- **Verify it boots.** Do not report success on a scaffold you have not run.
- **Explain while building, not after.** The decision is teachable at the moment it is made.
