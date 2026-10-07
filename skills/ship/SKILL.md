---
name: ship
description: Takes a working prototype to production — environments, migrations, error handling, logging, health checks, rollback, backups and CI, checked against the repo. Use for "is this ready to deploy" or "help me launch". Run /raffy:secure first.
---

# Ship

The gap between "it works on my machine" and "it survives a Tuesday" is a short, boring list. This
skill walks it, verifies each item against the actual repo, and fixes what is missing.

**Run `/raffy:secure` first.** Security holes are not a deployment concern to be handled later;
they are the reason not to deploy at all. This skill assumes that pass is clean.

## The three that matter most

Everything here is standard practice. These three are the ones AI-built projects skip, and each
one is the difference between a bad hour and a bad week:

1. **Migrations, versioned and applied by the deploy.** A hand-edited production database has no
   path forward. This is the single most expensive thing to retrofit.
2. **A rollback you have actually run.** Not a plan — a command you have executed once, before you
   needed it.
3. **A restore you have actually tested.** An untested backup is a hope, and people discover this
   at the worst possible moment.

---

## Phase 0 — Assess

```bash
ls -a && cat package.json 2>/dev/null | head -40
ls .github/workflows/ 2>/dev/null; ls -d migrations drizzle prisma 2>/dev/null
git log --oneline -5 2>/dev/null
```

Identify stack, host, and what already exists. Then state the plan: *"Checking twelve readiness
items against <repo>. I'll report what's missing and fix what you approve."*

## Phase 1 — The checklist

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/ship/scripts/readiness.ts" <repo-path>
```

The script reports what it can **see**: it finds migration directories, loggers, CI gates, health
endpoints and tracked `.env` files. It cannot report what it cannot **run** — a migration directory
proves migrations exist, not that the deploy applies them, and nothing can tell you a restore works.
Those come back as `MANUAL` and `PARTIAL`, and Phase 3 is where they get executed.

Then work `references/readiness.md` for everything the script cannot reach. For each item,
**verify against the repo** — do not accept a config file's existence as proof it works.

| Group | Items |
|---|---|
| **Config** | environment separation · secrets in a real store · env validated at boot |
| **Data** | migrations versioned and applied by deploy · seed and rollback path · backups with a tested restore |
| **Runtime** | error handling at every boundary · structured logs with request ids · health check that checks something |
| **Delivery** | CI that gates the merge · a one-command rollback · a staging environment |

Mark each **present · partial · missing**, with the `file:line` or the command that proves it.

## Phase 2 — Report before fixing

Print the twelve with their status, then split into:

- **Blocks the deploy** — missing migrations, no rollback, secrets in the repo, no error tracking.
- **Fix this week** — no staging, no backup test, thin logging.
- **Already good** — name these. It tells the user what they got right, which is how they learn
  what "right" looks like.

Ask which to fix. **Do not start fixing during the assessment.**

## Phase 3 — Fix, verify, and prove it

For each approved item: make the change, then **demonstrate it works**.

- Migration → run it against a scratch database and show the applied output.
- Health check → `curl` it and show the response, including with the database stopped.
- Rollback → run it. A rollback that has never been executed is not a rollback.
- CI → push a branch and show the run.
- Backup → take one, **restore it into a scratch database**, and show a row count.

An item is not done because the file exists. It is done because you ran it.

## Phase 4 — Hand over

Write or update these, then walk the user through them:

- **`DEPLOY.md`** — how to deploy, how to roll back, where logs and errors live, who to call. Short
  enough to read at 2am.
- **`.env.example`** — every variable, with a comment on what it does and where to get it.
- **`CLAUDE.md`** — updated with the deploy commands, so the agent stops inventing them.

Close with the three things most likely to break first in **this specific** app, and what the
symptom will look like. That is the part they will remember.

---

## Rules

- **Run `/raffy:secure` first.**
- **Verify, do not assume.** A file's existence proves nothing; run it.
- **Report before fixing**, and fix only what was approved.
- **Never invent infrastructure the app does not need.** A staging environment and a rollback are
  not the same kind of item as a Kubernetes cluster. Read
  `${CLAUDE_PLUGIN_ROOT}/skills/scaffold/references/growth-ladders.md` before adding a service.
- **Test the restore, not the backup.**
