# raffy-skills

A Claude Code plugin for building software with an agent and coming out the other side able to
supervise one.

Five skills, one namespace: `/raffy:*`.

| Command | Does |
|---|---|
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

## Install

```bash
claude plugin marketplace add rftglyv/raffy-skills
claude plugin install raffy@raffy-skills
```

Then `/raffy:scaffold` in an empty directory.

## Layout

```
.claude-plugin/          plugin + marketplace manifests
skills/
  scaffold/              SKILL.md · 8 references · 19 knowledge layers · kb.ts
  secure/                SKILL.md · checks.md · scan.ts
  ship/                  SKILL.md · readiness.md
  qa-audit/              SKILL.md · 5 references · parse_findings.py
  drill/                 SKILL.md · concepts.md
packages/raffy-kb/       npm package: CLI + statusline
```

## Developing

`claude plugin install` **copies** the repo into
`~/.claude/plugins/cache/raffy-skills/raffy/<version>/`. Editing files here changes nothing until
you bump the version and reinstall:

```bash
# bump "version" in .claude-plugin/plugin.json first
claude plugin marketplace update raffy-skills
claude plugin install raffy@raffy-skills
```

Scripts referenced from a `SKILL.md` must use `${CLAUDE_PLUGIN_ROOT}` — the runtime path is the
cache directory, not this repo.

MIT.
