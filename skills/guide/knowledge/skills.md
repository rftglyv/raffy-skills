# Skill cards

Judgment about *other people's* skills: when each one is the right call, when it is not, and what
it collides with. Same principle as the stack cards in `scaffold/knowledge/` — the card carries the
judgment, the skill's own SKILL.md carries the instructions. Read the card to choose; let the skill
itself do the work.

A skill that is installed but has no card here is still routable: `../scripts/inventory.ts` returns its
description, and that description is what Claude Code itself would match on. A card exists to add
what the description cannot say — the `Don't use when`, and which of three near-identical skills
to pick.

## Where they collide

Most routing mistakes happen here. Several families ship a skill for the same job, and their
descriptions all match the same request. Pick by the column, not by whichever fired first.

| Job | Pick this | When instead |
|---|---|---|
| Stress-test an idea | `mattpocock-skills:grilling` | `batch-grill-me` when you want every question at once, not one at a time · `mattpocock-skills:grill-with-docs` when the answers should land in ADRs and a glossary |
| Write a spec | `spec-driven-development` | `mattpocock-skills:to-spec` when the conversation already *is* the spec and it belongs in the issue tracker · `spec` is the same skill as a command |
| Break into tasks | `planning-and-task-breakdown` | `mattpocock-skills:to-tickets` when the tasks go to a tracker with blocking edges · `mattpocock-skills:wayfinder` when it will not fit in one session |
| Test-first | `mattpocock-skills:tdd` | `test-driven-development` for its Prove-It bug pattern · `test` is that one as a command |
| Debug | `mattpocock-skills:diagnosing-bugs` | `debugging-and-error-recovery` when a build or test just broke and the cause is probably shallow |
| Review a diff | `code-review` (built-in) | `mattpocock-skills:code-review` when there is a spec to check against · `code-review-and-quality` for a teaching-style multi-axis read |
| Security | `raffy:secure` | `security-and-hardening` while *writing* auth or input handling · `security-review` (built-in) for a single diff · `raffy:qa-audit` for everything at once |
| Launch | `raffy:ship` | `shipping-and-launch` for rollout and monitoring strategy · `ship` (command) for a persona-panel go/no-go on top |
| Web UI | `impeccable` | `ui-ux-pro-max` for mobile, Flutter, SwiftUI or a desktop stack · `frontend-design` for aesthetic direction only |
| "Which skill?" | `raffy:guide` | `mattpocock-skills:ask-matt` inside Matt's set only · `flow` inside a spec-driven project already using it |

Rule for ties: prefer the one whose **output lands where the user already works** (their tracker,
their repo docs, their terminal), and never run two from the same row in one pass — they will
disagree and the user cannot tell which to believe.

---

## Orient

### raffy:guide
**Phase:** orient · **Source:** raffy · **Docs:** n/a — this plugin

Works out where the project is, names the next skill, explains it, runs it, and logs the step.

**Use when** — the user does not know what to do next · asks "which skill" · opens a repo cold ·
two installed skills both claim the request
**Don't use when** — the user named the skill they want; run it · a one-line task with no phase
**Overlaps with:** `mattpocock-skills:ask-matt`, `flow` — both route within one family; this one routes across all of them

### mattpocock-skills:ask-matt
**Phase:** orient · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Router over Matt Pocock's own skills only.

**Use when** — the user is committed to Matt's flow (grill → to-spec → to-tickets → implement) and wants the next step inside it
**Don't use when** — the right skill might come from another family; it cannot see them
**Overlaps with:** `raffy:guide`

### flow
**Phase:** orient · **Source:** command · **Docs:** n/a — local command

Conductor for a spec-driven project: detects which of spec/plan/build/test/ship you are in.

**Use when** — the project already has the spec → plan → build artifacts this command expects
**Don't use when** — there is no spec yet and the user just wants to start; route to `raffy:scaffold` or `spec-driven-development` first
**Overlaps with:** `raffy:guide`

---

## Idea

### saas-idea-scout-elite
**Phase:** idea · **Source:** user · **Docs:** n/a — local skill

Mines forums for pain points, scores ideas, models revenue, writes a 90-day launch plan.

**Use when** — there is no idea yet · the user wants one validated or scored before building
**Don't use when** — the idea is decided and the user wants to build; its stack advice is fixed
(Next.js / Elysia), so let `raffy:scaffold` pick the stack
**Hands off to:** `mattpocock-skills:grilling`, then `raffy:scaffold`

### mattpocock-skills:research
**Phase:** idea · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Answers a question from primary sources and saves the findings as Markdown in the repo.

**Use when** — a decision hinges on facts nobody in the conversation has · docs or API behaviour need checking
**Don't use when** — the question is about social chatter or a platform URL; `agent-reach` reaches those
**Overlaps with:** `agent-reach`, `anthropic-skills:deep-research`

### agent-reach
**Phase:** idea · **Source:** user · **Docs:** n/a — local skill

Fetches content from the web and 15 platforms (Reddit, X, YouTube, GitHub…).

**Use when** — the user shares a URL or wants "what people say about X"
**Don't use when** — the answer belongs in the repo as a sourced note; use `mattpocock-skills:research`

---

## Shape

### mattpocock-skills:grilling
**Phase:** shape · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Interviews the user, one hard question at a time, until the plan has no soft spots.

**Use when** — an idea or design is about to be committed to · the user says "grill me" · the
plan has never been challenged
**Don't use when** — the user needs a decision made for them right now · it is a bug, not a plan
**Overlaps with:** `mattpocock-skills:grill-me`, `mattpocock-skills:grill-with-docs`, `batch-grill-me`

### mattpocock-skills:grill-with-docs
**Phase:** shape · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Grilling that writes ADRs and a glossary as decisions land.

**Use when** — the project will outlive the conversation and decisions need a written record
**Don't use when** — it is a throwaway or a solo weekend build; the docs become noise

### batch-grill-me
**Phase:** shape · **Source:** user · **Docs:** n/a — local skill

Grilling that asks every open question at once, round by round.

**Use when** — the user would rather answer a list than have a back-and-forth
**Don't use when** — answers depend on each other; one-at-a-time catches that, batches do not

### spec-driven-development
**Phase:** shape · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Writes a structured spec before any code.

**Use when** — a new project or significant feature has no written requirements · requirements exist only as a vague idea
**Don't use when** — the change is small and obvious · a spec already exists; go to planning
**Overlaps with:** `spec` (same skill as a command), `mattpocock-skills:to-spec`

### mattpocock-skills:to-spec
**Phase:** shape · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Turns the conversation so far into a spec and files it in the issue tracker. No interview.

**Use when** — the shaping already happened in conversation and needs to land in the tracker
**Don't use when** — requirements are still unclear; grill first · the repo has no tracker configured (`setup-matt-pocock-skills` first)

### mattpocock-skills:domain-modeling
**Phase:** shape · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Builds the project's domain vocabulary into CONTEXT.md and ADRs.

**Use when** — the same concept has three names in the code · the user is defining what a "workspace" or "order" actually is
**Don't use when** — a CRUD app with obvious nouns
**Overlaps with:** `ubiquitous-language` — that one extracts a glossary from one conversation; this one maintains it in the repo

### mattpocock-skills:prototype
**Phase:** shape · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Builds a throwaway to answer one design question.

**Use when** — nobody can tell whether a state model or UI feels right without seeing it
**Don't use when** — the answer is knowable by reading; and never let the prototype become the product

---

## Stack

### raffy:scaffold
**Phase:** stack · **Source:** raffy · **Docs:** n/a — this plugin

Interviews, composes a right-sized stack from 144 cards, scaffolds with secure defaults, explains every rejection.

**Use when** — a new project with no first commit · "which database/ORM/framework should I use"
**Don't use when** — adding one library to an existing repo; read the matching card in `scaffold/knowledge/` and add it
**Hands off to:** `planning-and-task-breakdown`, `impeccable` for the first screen

### elysia-microservice
**Phase:** stack · **Source:** user · **Docs:** https://elysiajs.com

Scaffolds and extends Elysia services inside a Bun + Turborepo monorepo.

**Use when** — the stack is already Elysia in that monorepo shape and a new service or module is needed
**Don't use when** — the stack is not decided yet; `raffy:scaffold` decides whether Elysia is even right

---

## Plan

### planning-and-task-breakdown
**Phase:** plan · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Splits a spec into small, ordered, verifiable tasks with acceptance criteria.

**Use when** — a spec exists and the work is more than one sitting
**Don't use when** — no spec yet; shape first · the task already fits in one commit
**Overlaps with:** `plan` (same as a command), `mattpocock-skills:to-tickets`

### mattpocock-skills:to-tickets
**Phase:** plan · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Breaks a plan into tracer-bullet tickets with blocking edges, filed to the tracker.

**Use when** — tasks should live in Linear/GitHub Issues and be picked up one by one, maybe by other agents
**Don't use when** — a solo session that will finish today; a local task list is lighter

### mattpocock-skills:wayfinder
**Phase:** plan · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Plans work too big for one session as a map of decision tickets, resolved one at a time.

**Use when** — the work spans many sessions and the path is unclear, not just long
**Don't use when** — the path is clear and only long; ordinary planning is enough

---

## Build

### incremental-implementation
**Phase:** build · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Lands a change in small verified slices instead of one large write.

**Use when** — a change touches more than one file · the urge is to write everything at once
**Don't use when** — a one-file fix
**Overlaps with:** `build` (command form), `mattpocock-skills:implement`

### mattpocock-skills:implement
**Phase:** build · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Implements one ticket or spec from the tracker.

**Use when** — the work came from `to-tickets` and should close a specific ticket
**Don't use when** — there is no ticket; `incremental-implementation` does not need one

### mattpocock-skills:tdd
**Phase:** build · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Red-green-refactor, favouring integration tests.

**Use when** — logic with clear inputs and outputs · a bug that should never come back
**Don't use when** — UI layout or exploratory prototyping; the tests will be rewritten tomorrow
**Overlaps with:** `test-driven-development`, `test`

### test-driven-development
**Phase:** build · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Test-first, with the Prove-It pattern for bugs: reproduce in a failing test before fixing.

**Use when** — fixing a reported bug · changing behaviour that has no test yet
**Don't use when** — `mattpocock-skills:tdd` already ran on this change; do not stack two
**Overlaps with:** `mattpocock-skills:tdd`, `test`

### source-driven-development
**Phase:** build · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Grounds every implementation choice in the official docs, cited.

**Use when** — a library changed recently · version-specific behaviour matters · the agent sounds confident about an API it has not read
**Don't use when** — stable, boring code (string utils, plain SQL)

### doubt-driven-development
**Phase:** build · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Sends each non-trivial decision to a fresh-context adversarial review.

**Use when** — production data, money, auth, irreversible migrations
**Don't use when** — speed matters more than correctness; it multiplies cost per decision

### mattpocock-skills:codebase-design
**Phase:** build · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Vocabulary and moves for deep modules: interfaces, seams, testability.

**Use when** — designing a module's interface · code is hard for an agent to navigate
**Don't use when** — no structural question is on the table
**Overlaps with:** `mattpocock-skills:improve-codebase-architecture` — that one scans the whole repo and reports; this one is the vocabulary

---

## UI

### impeccable
**Phase:** ui · **Source:** user · **Docs:** https://impeccable.style

Designs, critiques and polishes web interfaces: hierarchy, typography, layout, states, a11y.

**Use when** — any web UI is being built or looks generic · a page needs a UX critique
**Don't use when** — native mobile or desktop; use `ui-ux-pro-max` · backend-only work
**Overlaps with:** `ui-ux-pro-max`, `frontend-design`, `web-design-guidelines`
**Pairs with:** `shadcn` for components, `design-motion-principles` for motion

### ui-ux-pro-max
**Phase:** ui · **Source:** user · **Docs:** n/a — local skill

Style, palette and font-pairing database across 21 stacks, mobile and desktop included.

**Use when** — Flutter, React Native, SwiftUI, Compose or desktop UI · the user wants a style picked from a catalogue
**Don't use when** — a web UI where `impeccable` is installed; do not run both on one screen

### frontend-design
**Phase:** ui · **Source:** user · **Docs:** n/a — local skill

Aesthetic direction so new UI does not read as a template.

**Use when** — choosing a visual direction before any component exists
**Don't use when** — `impeccable` is already working on the screen; it covers this

### shadcn
**Phase:** ui · **Source:** user · **Docs:** https://ui.shadcn.com/docs

Adds, searches, fixes and composes shadcn/ui components and registries.

**Use when** — the project has a `components.json` · the user needs a component that a registry already has
**Don't use when** — the project is not on Tailwind + React
**Pairs with:** `shadcn-dashboard` for data-heavy screens

### shadcn-dashboard
**Phase:** ui · **Source:** user · **Docs:** https://ui.shadcn.com/docs

Dashboards and admin panels from shadcn, Tailwind and Recharts.

**Use when** — KPI cards, tables, charts, sidebar shells
**Don't use when** — a marketing page or a form flow

### design-motion-principles
**Phase:** ui · **Source:** user · **Docs:** n/a — local skill

Builds or audits UI motion against named designers' principles.

**Use when** — adding transitions or micro-interactions · motion feels off and nobody can say why
**Don't use when** — the layout itself is wrong; motion does not fix hierarchy

### web-design-guidelines
**Phase:** ui · **Source:** user · **Docs:** https://vercel.com/design/guidelines

Checks UI code against the Web Interface Guidelines.

**Use when** — a fast compliance pass on finished UI · accessibility check
**Don't use when** — the design is still being decided; `impeccable` shapes, this checks

### figma:figma-design-to-code
**Phase:** ui · **Source:** figma · **Docs:** https://help.figma.com/hc/en-us/articles/32132100833559

Implements a Figma design as code through the Figma MCP server.

**Use when** — the user shares a figma.com link and wants it built
**Don't use when** — there is no Figma file; design in code with `impeccable`
**Overlaps with:** `figma:figma-generate-design` — that one goes the other way, code into Figma

---

## Debug

### mattpocock-skills:diagnosing-bugs
**Phase:** debug · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

A diagnosis loop for hard bugs and performance regressions.

**Use when** — the bug survived one fix attempt · intermittent, slow, or "works on my machine"
**Don't use when** — the error message names the cause; just fix it
**Overlaps with:** `debugging-and-error-recovery`

### debugging-and-error-recovery
**Phase:** debug · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Systematic root-cause debugging when a build or test just broke.

**Use when** — a test or build failed right after a change
**Don't use when** — the bug is old, intermittent or a performance regression; use `mattpocock-skills:diagnosing-bugs`

---

## Review

### code-review
**Phase:** review · **Source:** built-in · **Docs:** https://docs.claude.com/en/docs/claude-code

Claude Code's built-in diff review, at an effort level you choose.

**Use when** — before merging any change
**Don't use when** — you want the whole product audited, not one diff; use `raffy:qa-audit`
**Overlaps with:** `mattpocock-skills:code-review`, `code-review-and-quality`

### mattpocock-skills:code-review
**Phase:** review · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Reviews changes since a point against the repo's standards *and* the originating spec, in parallel.

**Use when** — the change came from a spec or ticket and "did it do what was asked" matters
**Don't use when** — there is no spec or standards doc; half its review has nothing to compare against

### code-review-and-quality
**Phase:** review · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Multi-axis review: correctness, readability, architecture, security, performance.

**Use when** — the user wants to understand *why* code is good or bad, not only a findings list
**Don't use when** — a built-in `code-review` already ran on the same diff

---

## Secure

### raffy:secure
**Phase:** secure · **Source:** raffy · **Docs:** n/a — this plugin

Mechanical scan for the eight holes AI-built apps ship with, each hit verified against source.

**Use when** — before any first deploy · "did I leak any keys" · after adding auth or webhooks
**Don't use when** — you want every domain audited; that is `raffy:qa-audit`
**Hands off to:** `raffy:ship`, `raffy:drill` with the findings

### security-and-hardening
**Phase:** secure · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Secure-coding guidance while writing input handling, auth and integrations.

**Use when** — *writing* the code that takes untrusted input
**Don't use when** — checking code that already exists; `raffy:secure` verifies, this advises

---

## QA

### raffy:qa-audit
**Phase:** qa · **Source:** raffy · **Docs:** n/a — this plugin

Whole-product audit with parallel domain agents and verified findings, tracker-ready.

**Use when** — "find everything wrong" · before a launch or a funding demo · inheriting a codebase
**Don't use when** — reviewing one PR; that is `code-review` · the app does not run yet

### qa
**Phase:** qa · **Source:** user · **Docs:** n/a — local skill

The user reports bugs in conversation and the agent files GitHub issues.

**Use when** — the user is clicking through the app and finding things themselves
**Don't use when** — the user wants the agent to find the bugs; that is `raffy:qa-audit`

---

## Ship

### raffy:ship
**Phase:** ship · **Source:** raffy · **Docs:** n/a — this plugin

Twelve production-readiness items checked against the repo, the unverifiable ones run by hand.

**Use when** — "is this ready to deploy" · before the first real user
**Don't use when** — `raffy:secure` has not passed; run that first
**Overlaps with:** `ship` (command), `shipping-and-launch`

### shipping-and-launch
**Phase:** ship · **Source:** user · **Docs:** https://github.com/addyosmani/agent-skills

Launch strategy: staged rollout, monitoring, rollback plan.

**Use when** — the app is ready and the question is *how* to roll it out
**Don't use when** — the readiness items are not done; `raffy:ship` first

### ship
**Phase:** ship · **Source:** command · **Docs:** n/a — local command

Persona-panel pre-launch review that ends in a go/no-go.

**Use when** — after `raffy:ship`, as a second opinion before the switch is flipped
**Don't use when** — instead of `raffy:ship`; it judges, it does not fix

### seo-geo
**Phase:** ship · **Source:** user · **Docs:** n/a — local skill

Search and AI-search visibility: keywords, schema markup, meta.

**Use when** — a public marketing site is going live
**Don't use when** — an app behind a login

### copywriting
**Phase:** ship · **Source:** user · **Docs:** n/a — local skill

Marketing copy for landing, pricing and product pages.

**Use when** — a public page needs to persuade
**Don't use when** — UI microcopy inside the app; `impeccable` handles UX copy

---

## Learn

### raffy:drill
**Phase:** learn · **Source:** raffy · **Docs:** n/a — this plugin

Review exercises built from the user's own code, with a ledger of what they have earned.

**Use when** — after `raffy:secure` or `raffy:qa-audit` produced real findings · "teach me to review this"
**Don't use when** — the user is mid-task and needs it done; offer it after

### mattpocock-skills:teach
**Phase:** learn · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Teaches a concept inside the current workspace.

**Use when** — the user asks what a concept *is*
**Don't use when** — they need to practise spotting it in code; that is `raffy:drill`

---

## Handoff

### mattpocock-skills:handoff
**Phase:** handoff · **Source:** mattpocock-skills · **Docs:** https://github.com/mattpocock/skills

Compacts the conversation into a document another agent can pick up.

**Use when** — ending a session mid-work · passing work to a parallel agent
**Don't use when** — the work is done; a commit message is the handoff

---

## Memory and the code map

### raffy:doctor
**Phase:** orient · **Source:** raffy · **Docs:** n/a — this plugin

Measures what loads before the first prompt and whether skills can be found.

**Use when** — hitting usage limits · "too many skills" · a skill never fires · before installing more skills
**Don't use when** — the question is which skill to run for a task; that is `raffy:guide`

### raffy:memory
**Phase:** orient · **Source:** raffy · **Docs:** n/a — this plugin

Records what the project decided and why, and brings it back at session start.

**Use when** — a decision is agreed · the user asks "why did we…" · about to re-decide a library or a data shape
**Don't use when** — the thing is a fact about the code's structure; graphify rebuilds that from source and memory would go stale
**Pairs with:** `graphify`

### graphify
**Phase:** build · **Source:** tool · **Docs:** https://github.com/Graphify-Labs/graphify

Builds a graph of a codebase from its syntax tree, locally, and answers structure questions from it.

**Use when** — opening a repo you have not read · "where is X used" · "what breaks if I change Y" (`graphify affected`)
**Don't use when** — a single file is enough · the repo has a fresh `graphify-out/` already; query it instead of rebuilding
**Gotcha:** naming communities calls an LLM backend; `graphify update .` alone stays local and needs no key
