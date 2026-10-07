---
name: doctor
description: Checks what the Claude Code setup costs before the first prompt (skills, CLAUDE.md, hooks, memory, in tokens) and whether skills can be found — weak descriptions, competing skills, which one a sentence would hit. Use for "why am I hitting limits", "too many skills", "is my skill being used".
---

# Doctor

Two questions people cannot answer from inside a session: *what am I paying for before I type*,
and *why didn't my skill fire*. Every number here is measured from the machine, and every fix is
reversible.

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/doctor.ts" budget .
```

## 1 — Budget

Prints the tokens loaded before the first prompt, biggest source first, then the skills the catalog
ranks `rare` that still load every session, and the longest descriptions.

- Tokens are **estimates** (characters ÷ 4). Say so once. They rank sources correctly.
- Hooks are listed but not run. If a `SessionStart` hook could be large, ask before measuring it:
  *"Measuring hook output means running each SessionStart hook once. OK?"* — then add `--run-hooks`.
- Lead with the one change that saves the most. Usually that is unlinking rarely used skills.

Unlinking is the only change this skill makes, and only on a yes, one skill at a time:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/doctor.ts" unlink <skill>          # shows what it would do
bun "${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/doctor.ts" unlink <skill> --yes    # removes the symlink only
```

It only removes symlinks in `~/.claude/skills` that point into `~/.agents/skills`. The skill stays on
disk, the guide still finds it as `dormant`, and `catalog.ts enable <skill>` brings it back. Plugin
skills cannot be unlinked one by one; say which plugin to disable and let the user decide.

## 2 — Skills

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/doctor.ts" skills .
bun "${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/doctor.ts" fire "<the user's sentence>"
```

- **Weak descriptions**: too short to match, too long to afford, or no trigger phrase ("Use when…").
  A description is the only thing the model reads when deciding to load a skill.
- **Competing for the same job**: from the guide's collision table. Not a problem to fix — it is
  why `/raffy:guide` exists. Name the one the guide would pick for the user's usual work.
- **Possibly overlapping**: similar descriptions, unconfirmed. Mention only the top two.
- **fire** ranks skills by similarity to a sentence. It is an **estimate, not the model's real
  choice** — say that every time. When nothing clears 0.30, the honest answer is that no
  description uses the user's words, and the guide is the better route.

## Close

```
Before you type   ~9.2k tokens · biggest: 37 user skills (3.7k)
Cut first         unlink 6 rarely used skills · saves ~1.1k per session
Skills            39 weak descriptions · 10 jobs with competing skills — the guide picks
Next              say "unlink them" and I'll do it one by one, or pick the ones to keep
```

At the user's level (`${CLAUDE_PLUGIN_ROOT}/skills/guide/references/levels.md`). Never unlink, edit
another author's skill, or disable a plugin without an explicit yes.
