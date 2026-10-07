---
name: setup
description: First-run setup for raffy. Installs the graphify code map and local skill search, finds every skill on this machine, ranks the ones raffy does not know yet, and switches on the prompt hint. Use on first install, when the prompt hook says raffy is not set up, or after installing new skills.
---

# Setup

One pass, about three minutes, nothing installed without a yes. Each step is a script call that
prints one line; read the line, tell the user in plain words, move on.

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/setup/scripts/setup.ts"
bun "$S" check
```

`check` prints six lines: bun, uv, graphify, vectors, catalog, setup. Show the user what is missing
and the plan for it, as one short list. Then do the steps below in order, skipping any already ✓.

## 1 — Code map (graphify)

Graphify builds a map of a codebase from its syntax tree, locally, with no API key for code. The
guide uses it before grepping an unfamiliar repo. Ask: *"Install graphify? It's a Python tool,
installed in its own environment with uv. About 1 minute."*

```bash
bun "$S" graphify
```

Do **not** run `graphify claude install` or `graphify install`. Those add always-on hooks and a
global skill that change how every session reads files. Mention they exist; leave them to the user.

## 2 — Skill search by meaning (vectors)

Without this, raffy finds skills by keyword, which works. With it, raffy also matches by meaning.
Ask, with the real cost: *"About 400 MB on disk in `~/.claude/raffy/runtime`, runs offline after a
one-time 23 MB model download. Delete the folder to remove it."*

```bash
bun "$S" vectors
```

## 3 — Learn this machine's skills

```bash
bun "$S" introspect
```

It prints every skill on this machine that the catalog does not know yet — installed, inside other
projects, or unlinked in `~/.agents/skills` — one per line with its description. Classify each one
yourself into a catalog row:

```
id <TAB> tier <TAB> phase <TAB> domain <TAB> src <TAB> when
```

- **tier**: `core` general and run often · `often` common but situational · `rare` niche · `skip` duplicate, internal to another tool, or not about building software
- **phase**: orient idea shape stack plan build ui debug review secure qa ship grow learn handoff
- **domain**: any web mobile design ai-app ml research writing business
- **when**: under 90 characters, the job it does, in the user's words

Then write them in one call, each row a separate quoted argument:

```bash
bun "$S" learn $'id\ttier\tphase\tdomain\tsrc\twhen' $'…'
```

Rows that fail validation are reported and skipped. Fix and resend those only. The user's own
skills (no known source) default to `often` unless the description says otherwise.

## 4 — Index and finish

```bash
bun "$S" index    # embeds every catalog row; skipped if step 2 was declined
bun "$S" done     # stops the prompt hook from suggesting setup
```

## Close

Three lines, no more:

```
Set up     graphify ✓ · skill search by meaning ✓ · 272 skills known (34 learned here)
Changed    ~/.claude/raffy/ only — nothing in this project
Try        describe a task in plain words; raffy names the skill that fits, or ask /raffy:guide
```

Rerun `/raffy:setup` after installing new skills. Every step skips what is already done.
