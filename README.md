# raffy-skills

A Claude Code plugin for building software with an agent and coming out the other side able to
supervise one.

You probably have dozens of skills installed already — Matt Pocock's, impeccable, shadcn, figma,
addy's agent-skills, your own. Five of them claim the same job, and nothing tells you which one fits
*now*. **`/raffy:guide` is the front door:** it works out where your project is, picks the right
skill from everything installed, tells you what it will do and what it chose *not* to run, runs it,
and logs the step.

```
idea → shape → stack → plan → build → ui → debug → review → secure → qa → ship → learn
```

Eight skills, one namespace: `/raffy:*` — plus a library of 52 bundled skills from other authors and
a catalog of every skill on your machine.

| Command | Does |
|---|---|
| **`/raffy:setup`** | First run: installs the graphify code map and local skill search, learns every skill on your machine |
| **`/raffy:doctor`** | What your setup costs before the first prompt, in tokens per source; weak or competing skills; which skill a sentence would hit |
| **`/raffy:guide`** | Routes to the right installed skill for where you are, explains it, and keeps a trail across projects |
| **`/raffy:scaffold`** | Interviews you, composes a stack from a 144-card knowledge base, and explains every choice it rejected |
| **`/raffy:secure`** | Fast pre-deploy pass over the eight holes that show up in AI-built apps |
| **`/raffy:ship`** | Twelve production-readiness items, verified by running them, not by finding a file |
| **`/raffy:qa-audit`** | Full whole-product audit — parallel domain agents, verified findings, tracker-ready |
| **`/raffy:drill`** | Turns your own code into review exercises, and tracks what you have earned |

## The idea

Three failure modes of building with an agent, one skill aimed at each.

**Bad defaults get baked in.** Row-level security off, secrets in the client bundle, no migrations.
Cheap to prevent at commit one, expensive at commit four hundred. → `scaffold`, `secure`

**The agent forgets, and guesses.** It re-decides your architecture every session and answers
version-specific questions from stale training data with total confidence. → the knowledge base

**You can't tell.** Prompting a working prototype is not the same as judging whether a fix
addressed the cause — and that judgment is what predicts whether someone can supervise an agent at
all. → `drill`

## Three rules the whole plugin runs on

1. **Grounded or dropped.** Every finding cites a real `file:line`. Every researched fact carries a
   source URL. Anything that can't be grounded doesn't ship.
2. **Verify before reporting.** Agents produce confident wrong answers, so severe findings get
   re-checked against source and the report states the hold rate.
3. **Earn the infrastructure.** Queues, brokers and caches are added on a measured constraint, never
   on a hunch. Speculative scale is a bug.

## The knowledge base

`scaffold` doesn't pick from a list of presets. It reads 144 cards across 19 layers — runtime,
frontend, api, orm, database, validation, auth, styling, jobs, messaging, payments, notifications,
storage, search, ai, testing, observability, hosting, mobile.

Each card carries judgment rather than documentation: **when to use it, when not to, what it
conflicts with, how long it takes to adopt — and how long it takes to remove.** That last asymmetry
is usually the real decision and nobody writes it down. Actual API details are fetched from the
`Docs:` URL at the moment of implementation, so the cards never go stale on syntax.

The agent answers from four tiers, in order, and says which one it used:

| | Tier | Trust |
|---|---|---|
| 1 | **Curated** — the shipped cards, versioned in git | high |
| 2 | **Learned** — researched and written back with source and date | medium |
| 3 | **Live web** — fetched now, primary sources first | verify |
| 4 | **Model memory** — no source, no date, no way to check | last resort, and say so |

Local store, one SQLite file, no server and no API key:

```bash
bunx raffy-kb update              # reindex; never destroys learned entries
bunx raffy-kb search "does prisma work under bun"
bunx raffy-kb stats
```

## Dashboard

```bash
bun tui/dash.ts            # ↑↓ select · enter details · r refresh · q quit
bun tui/dash.ts --json     # the same data, for a web or native app
bun tui/web.ts             # the same view in a browser: http://localhost:4747 (127.0.0.1 only)
```

Every project raffy has touched and every Claude Code session on the machine, on one screen: phase,
last step, decisions and why, recent sessions. Read-only; no server.

## How it finds the right skill

| Piece | What it is | Cost per session |
|---|---|---|
| `skills/guide/knowledge/catalog.tsv` | One line per skill, ~240 curated, in four tiers: core · often · rare · skip | 0 — read through a script, never loaded |
| `~/.claude/raffy/catalog.local.tsv` | Skills `/raffy:setup` found on *your* machine and ranked | 0 |
| `library/` | 52 skills bundled from other authors (MIT / Apache-2.0 only), outside `skills/` | 0 — the guide reads one when it needs it |
| `hooks/guard.ts` | Before each Bash command: asks first for dropping data, resetting a database, force-pushing or deleting broad paths; refuses wiping a disk or home folder. `RAFFY_GUARD=off` disables | 0 — prints only when it stops something |
| `hooks/proof.ts` | When Claude is about to say "tests pass": checks a test ran this turn, after the last edit, with no failures, and that no test was weakened. Otherwise Claude keeps going. `RAFFY_PROOF=off` disables | 0 — prints only when a claim is unproven |
| `hooks/prompt.ts` | Before each message: one line naming the skill that fits, only on a strong match | ~25 tokens when it speaks, 0 otherwise |
| Vectors | `all-MiniLM-L6-v2`, ONNX, 384 dims, in SQLite — the same model ruflo uses. Optional | 0 |

## Bundled skills and credits

`library/` holds copies of other people's skills so the guide can use them with nothing installed.
Each has a `SOURCE.json` with its origin and license, and every license text is in
`library/licenses/`. `scripts/vendor.ts` refreshes them and refuses any source without a permissive
license — so `anthropics/skills`, `vercel-labs/agent-skills`, `vercel-labs/next-skills` and the
figma plugin are cataloged but not bundled.

From: `mattpocock/skills` · `addyosmani/agent-skills` · `pbakaus/impeccable` · `shadcn/ui` ·
`wshobson/agents` · `kylezantos/design-motion-principles` · `coreyhaines31/marketingskills` ·
`resciencelab/opc-skills` · `obra/superpowers` · `vercel-labs/skills` · `ayghri/i-have-adhd` ·
`nextlevelbuilder/ui-ux-pro-max-skill` · `Panniantong/Agent-Reach` · `Orchestra-Research/AI-Research-SKILLs`.

## Install

```bash
claude plugin marketplace add rftglyv/raffy-skills
claude plugin install raffy@raffy-skills
```

Then `/raffy:guide` in any repo — or `/raffy:scaffold` in an empty directory.

## Layout

```
.claude-plugin/          plugin + marketplace manifests
skills/
  setup/                 SKILL.md · setup.ts
  doctor/                SKILL.md · doctor.ts
  guide/                 SKILL.md · skills.md · catalog.tsv · catalog.ts · inventory.ts · journey.ts · embed.ts
  scaffold/              SKILL.md · 8 references · 19 knowledge layers · kb.ts
  secure/                SKILL.md · checks.md · scan.ts
  ship/                  SKILL.md · readiness.md
  qa-audit/              SKILL.md · 5 references · parse_findings.py
  drill/                 SKILL.md · concepts.md
library/                 52 bundled skills · sources.json · licenses/ · INDEX.tsv
hooks/                   hooks.json · guard.ts (PreToolUse) · proof.ts (Stop) · prompt.ts (UserPromptSubmit) · session.ts (SessionStart)
tui/                     dash.ts (terminal) · web.ts (browser, localhost only) — across projects and sessions
.raffy/                  raffy's own journey and decisions, kept in the repo
packages/raffy-kb/       npm package: CLI + statusline
```

## Developing

Installed from a local directory marketplace, the plugin **loads in place** from this repo: edits
take effect at the next session start or after `/reload-plugins`. Bump the version only to release:

```bash
# bump "version" in .claude-plugin/plugin.json, then
claude plugin update raffy@raffy-skills
```

Scripts referenced from a `SKILL.md` must use `${CLAUDE_PLUGIN_ROOT}` — the runtime path is the
cache directory, not this repo.

MIT.
