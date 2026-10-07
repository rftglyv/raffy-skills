---
name: guide
description: The front door to every installed skill. Works out where the project is on the idea → production path, picks the right next skill from everything installed (raffy, Matt Pocock, impeccable, shadcn, figma, addy's agent-skills, the user's own), explains in plain words what it will do and why now, runs it, and logs the step. Use when the user asks "what should I do next", "which skill should I use", "where are we", "help me with this project", "I'm lost", opens a repo cold, or when two installed skills both match a request and the wrong one would waste the session. Not needed when the user already named the skill they want — run that one.
---

# Guide

People do not fail with skills for lack of skills. They fail because there are eighty of them, five
claim the same job, and nothing says which one fits *now* or what it is about to do to their repo.
This skill is the answer to "what next, and why" — and it keeps the user oriented the whole way.

```
idea → shape → stack → plan → build → ui → debug → review → secure → qa → ship → grow → learn
```

Three promises, every time:

1. **Only route to what this machine can run** — active, or bundled in raffy. Otherwise say plainly where the better tool lives and how to get it.
2. **Explain before running.** The user should be able to say what is about to happen and why.
3. **Leave a trail.** Every step is logged, so the next session — or a dashboard — knows where this project is.

---

## Phase 0 — Look

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/journey.ts" where .
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/journey.ts" show . -n 3
```

`where` infers the phase from files and the last logged step. **The last logged step outranks the
files**, and the files are only a floor: a `SPEC.md` nobody agreed to is still a spec on disk. When
the confidence is `low`, ask one question before routing — *"Is this a new idea, or code that already
runs?"* — and nothing else.

Do **not** load the full inventory or the catalog into context. Ask for candidates instead:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/catalog.ts" find <3–5 keywords> [--phase <p>] -n 5
```

Rewrite the request as keywords first — "my checkout is slow" → `slow performance bug`. Each line
back is `id · tier · availability · when`. The catalog covers every skill on this machine, ~240,
in four tiers: `core` (general, run often), `often` (common but situational), `rare` (niche, known),
`skip` (never route). Availability is `active` (invocable now), `dormant` (on disk in
`~/.agents/skills`, not linked), `project` (inside another repo only), or `missing`.

## Phase 1 — Choose

**The request beats the phase.** If the user says "the login page looks bad", that is `ui` whatever
`where` said. Use the phase only when the request is "what next" or is empty.

1. **Name the job** in a few words: *stress-test the idea*, *pick a stack*, *find why checkout is slow*.
2. **Find candidates** with `catalog.ts find`. For the top one or two, read their card in
   `knowledge/skills.md` if one exists — the card has the `Don't use when`; the catalog line does not.
3. **Resolve collisions with the table** at the top of `knowledge/skills.md`. Read the `Don't use when`
   of the winner; if it applies, take the next row's choice.
4. **Prefer `active`, then `bundled`.** A `bundled` skill ships inside raffy at
   `${CLAUDE_PLUGIN_ROOT}/library/<dir>/` — read its `SKILL.md` and follow it as if it were invoked.
   Paths it names (`scripts/…`, `references/…`) resolve from that directory, not the project. Its
   `SOURCE.json` names the original repo and license; credit it in one line when you use it.
5. **Otherwise**, if the best fit is `dormant`, offer to link it — `catalog.ts enable <id>` shows
   what it would do, `--yes` does it after the user agrees, and it works from the next session — and
   route to the best active one for now. `missing` or `project`: say where it lives in one line. Never
   stall the user on an install.
6. **Prefer the one whose output lands where the user already works** — their tracker, their repo
   docs, their terminal.

Never run two skills from the same collision row in one pass. They will disagree, and the user cannot
tell which to believe.

## Phase 2 — Explain

Before invoking anything, show this — short, concrete, no jargon the user has not used:

```
Where you are   build — 14 commits, tests, no CI yet  (from files, medium)
Next            mattpocock-skills:diagnosing-bugs
Why this one    the bug survived one fix; this runs a reproduce → isolate loop instead of guessing
Not             debugging-and-error-recovery — that is for a build that just broke
You'll do       answer 2–3 questions about when it happens
It will touch   reads code, adds a failing test, no commits without asking
Takes           ~20 min
```

The `Not` line is the point. Naming the skill that was *not* picked, and why, is what teaches the
user to route for themselves next time.

If the user pushes back or names a different skill, take theirs. It is their project.

## Phase 3 — Run and log

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/journey.ts" log . --skill <id> --phase <phase> --status started
```

Invoke the chosen skill with the Skill tool and follow it fully — its instructions replace this
skill's until it finishes. Do not summarise or shortcut it; the user picked it to get *its* behaviour.

When it ends:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/journey.ts" log . --skill <id> --phase <phase> \
  --status done|failed|skipped --note "<one line: what now exists that did not before>"
```

`--note` is what a future session — or the user at a dashboard — will read. Write what changed
("spec agreed: 6 user stories, auth out of scope"), never what was attempted.

## Phase 4 — Reorient

End every run with the path and the marker, so the user always knows where they stand:

```
idea ✓ · shape ✓ · stack ✓ · plan ✓ · [build] · ui · review · secure · qa · ship
Done      checkout bug: cause was a stale price cache, fixed + regression test
Next      raffy:secure — you added a webhook today and nothing has checked it
```

Then stop. One next step, not a menu. If the user wants it, they say so and Phase 1 starts again.

---

## Memory

The session-start hook already printed this project's decisions, if it has any. Before re-deciding
anything — a library, an auth model, a data shape — check what was decided and why:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/memory.ts" recall <keywords>
```

When the user agrees to a decision, record it once, at the moment it lands:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/guide/scripts/memory.ts" remember --kind decision \
  --text "<the decision, one line>" --why "<the reason that would change it>" --tags <words someone would search>
```

- `--tags` carries the search: the small local model does not know Postgres is a database, so
  write `database,db,postgres,orm`. This is the single most useful thing to get right.
- `--kind fact` for things that are true but not chosen (a webhook path, a quota). `--kind pref` for
  how the user likes to work; preferences follow them across projects.
- Never store a map of the code: it goes stale the day the code changes. That is graphify's job.
- A reversed decision is `forget <id> --why "<what replaced it>"`, then `remember` the new one.

## Code map

In a repo you have not read before, check for `graphify-out/GRAPH_REPORT.md` before grepping. If
`graphify` is on PATH and there is no graph, offer to build one (`graphify update .`, local, no
API key) — then answer structure questions with `graphify query "<question>" --budget 1500`
instead of reading files one by one. If graphify is missing, say `/raffy:setup` installs it, once.

## Rules

- **Do not route when the user named the skill.** Run it. Logging still applies.
- **Phases are not a gate.** Jumping to `ui` with no spec is allowed; mention what was skipped once, in the `Where you are` line, and move on.
- **Built-ins count.** `code-review`, `security-review`, `simplify` and `run` ship with Claude Code; route to them like any other skill.
- **Cards are judgment, not instructions.** Never act on a card's summary of a skill instead of invoking the skill.
- **A routing mistake is cheap to admit.** If the chosen skill turns out wrong mid-run, say so, log it `failed` with why, and re-route.

## Files

- `knowledge/skills.md` — when to use each skill, when not, and the collision table
- `knowledge/catalog.tsv` — every skill on the machine, one line each; read through `catalog.ts`, never whole
- `${CLAUDE_PLUGIN_ROOT}/library/` — 52 bundled skills from other authors, license-checked; `INDEX.tsv` lists them
- `scripts/catalog.ts` — `find` candidates for a job, `stats` for coverage, `enable` to link a dormant skill
- `scripts/inventory.ts` — what is installed, from where, and which names collide
- `scripts/memory.ts` — decisions, facts and preferences: `remember`, `recall`, `forget`, `brief`
- `scripts/journey.ts` — phase inference, the per-project log, and the cross-project index at `~/.claude/raffy/projects.json`
