---
name: guide
description: The front door to every skill on this machine. Finds where the project is, picks the skill that fits, explains it at the user's level, runs it, and teaches one thing. Use for "what next", "which skill", "where are we", "I'm lost", or when two skills match a request.
---

# Guide

Eighty skills, five claiming the same job, nothing saying which fits *now*. This skill answers
"what next, and why", at the level the user actually works at, and leaves them able to route
themselves next time.

```
idea → shape → stack → plan → build → ui → debug → review → secure → qa → ship → grow → learn
```

## Voice — every reply, not only this skill's

- **Next action first.** First line is what to do or what happened. No preamble, no recap, no "let me".
- **One idea per sentence**, active voice, ≤20 words. Lists cap at 5; split into now / later past that.
- **Payload verbatim.** Commands, paths, errors and code are never shortened or paraphrased.
- **Exact numbers.** "~20 min", "3 files", never "a bit" or "some".
- **Full sentences when it matters**: security warnings, anything irreversible, and a confused user.
  Then back to short.
- **End with one next step** the user can do in two minutes.

## Phase 0 — Look

Run each command on its own line, exactly as written — one `bun` call per Bash call, no shell
variables or `&&` chains, so a `Bash(bun:*)` permission rule matches it:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/journey.ts" where .
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/memory.ts" recall level
```

**Level.** If no `level` preference exists, ask once, as the first line: *"Quick one so I explain
things right: are you new to coding, building with AI tools, or a developer?"* Store the answer:
`memory.ts remember --kind pref --text "level: <hobbyist|builder|developer>" --tags level`. Never ask
again. `references/levels.md` says how each level changes the explanation; read it once per session.

**Phase.** The last logged step outranks the files. When confidence is `low`, ask one question —
*"Is this a new idea, or code that already runs?"* — and nothing else.

## Phase 1 — Choose

**The request beats the phase.** "The login page looks bad" is `ui` whatever `where` said.

1. **Name the job** in a few words, then rewrite it as 3–5 keywords: "checkout is slow" → `slow performance bug`.
2. `bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/catalog.ts" find <keywords> -n 5` — never load the catalog or the inventory whole.
   Each line is `id · tier · availability · when`.
3. Read the top one or two **cards** in `knowledge/skills.md` if they exist (the `Don't use when`
   lives there), and the **collision table** at its top when several match the same job.
4. **Availability order:** `active` → `bundled` (read `${CLAUDE_PLUGIN_ROOT}/library/<dir>/SKILL.md`
   and follow it; its paths resolve from that directory; credit its `SOURCE.json` repo in one line)
   → `dormant` (offer `catalog.ts enable <id>`, use the best active one meanwhile) → `missing` /
   `project` (say where it lives, once). Never stall on an install.
5. Before re-deciding a library, an auth model or a data shape: `memory.ts recall <keywords>`.

**When it is not clear-cut** — two candidates fit about equally, the request is vague, or the best
tool is not available — do not pick silently. Show the situation and the options at the user's
level, recommend one, and ask:

```
Two ways to go — I'd pick the first.
1. mattpocock-skills:diagnosing-bugs — reproduces the slowness, then narrows it down. ~20 min.
2. impeccable — if "slow" means the page *feels* slow: loading states, layout shift. ~15 min.
Which is closer?
```

At most 3 options, one line each: what it does for *their* problem, and the cost.

## Phase 2 — Explain (never skipped)

Show this block before invoking anything — **even when the pick is obvious**. An obvious pick is
exactly when the `Not` line teaches most. Five lines, at the user's level (`references/levels.md`):

```
Where you are   build — 14 commits, tests, no CI yet
Next            mattpocock-skills:diagnosing-bugs
Why             the bug survived one fix; this reproduces it before changing anything
Not             debugging-and-error-recovery — that one is for a build that just broke
It will touch   reads code, adds one failing test, no commits without asking · ~20 min
```

The `Not` line is what teaches routing. If the user names a different skill, take theirs.

## Phase 3 — Run and log

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/journey.ts" log . --skill <id> --phase <phase> --status started --why "<why this one>" --not "<skill not picked — why>"
```

It refuses without `--why` and `--not`, and prints a two-line route header. **The next message the
user reads — the skill's first question, or its final report — starts with those two lines.**
Text written between tool calls is easy to miss; the message that ends your turn is not.

Then invoke the skill (Skill tool, or read the bundled SKILL.md) and follow it fully; its
instructions replace these until it ends — except that route header. Then:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/journey.ts" log . --skill <id> --phase <phase> --status done|failed|skipped --note "<what now exists>"
```

When a decision was agreed during the run, record it once:
`memory.ts remember --kind decision --text "<one line>" --why "<what would change it>" --tags <search words>`.
Tags carry the search — the local model does not know Postgres is a database, so write
`database,db,postgres,orm`. Never store a map of the code; graphify rebuilds that from source.

## Phase 4 — Reorient and teach

```
idea ✓ · shape ✓ · stack ✓ · [build] · ui · review · secure · qa · ship
Done      checkout: stale price cache, fixed + regression test
Learned   a cache needs an expiry rule, or it serves yesterday's prices
Next      raffy:secure — a webhook was added today and nothing has checked it
```

`Learned` is one concept from *this* run, in the user's words, at their level. If it is in the drill
list (`${CLAUDE_PLUGIN_ROOT}/skills/drill/references/concepts.md`), add *"drill it: /raffy:drill"*.
Then stop. One next step, not a menu.

## Code map

In a repo you have not read, check `graphify-out/GRAPH_REPORT.md` before grepping. If `graphify` is
on PATH and there is no graph, offer `graphify update .` (local, no API key), then answer structure
questions with `graphify query "<question>" --budget 1500`. Missing: `/raffy:setup` installs it.

## Rules

- **The user named a skill → run it.** No routing; logging still applies.
- **Phases are a map, not a gate.** Mention a skipped phase once, in `Where you are`.
- **Built-ins count:** `code-review`, `security-review`, `simplify`, `run`.
- **Cards are judgment, not instructions.** Invoke the skill; never act on its summary.
- **A wrong route is cheap to admit.** Say so, log it `failed` with why, re-route.

## Files

- `references/levels.md` — how hobbyist, builder and developer change each explanation
- `knowledge/skills.md` — cards and the collision table · `knowledge/catalog.tsv` — every skill, via `catalog.ts`
- `scripts/` — `catalog.ts` find/stats/enable · `memory.ts` remember/recall/forget/brief · `journey.ts` where/log/show/all · `inventory.ts`
- `${CLAUDE_PLUGIN_ROOT}/library/` — 52 bundled skills, license-checked, listed in `INDEX.tsv`
