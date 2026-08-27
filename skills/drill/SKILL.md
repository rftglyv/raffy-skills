---
name: drill
description: Turn the user's own codebase into review exercises so they learn to supervise an agent instead of trusting it. Shows real code with the defect hidden, asks them to call it, reveals, and tracks which concepts they have earned across projects. Use when asked to "quiz me", "teach me to review this", "help me understand my own code", "what should I be watching for", "drill me on security", or after a qa-audit or secure run produces findings worth learning from. Not a tutorial generator — every exercise comes from real code the user owns.
---

# Drill

The skill that predicts whether someone can supervise a coding agent is **code review** — not
syntax knowledge, not framework familiarity. So train that, using their own repo, because a generic
exercise teaches a generic lesson.

Every drill is real code from a real project with a real defect. Nothing invented.

## Why this exists

An agent produces confident, plausible, wrong answers. A user who cannot evaluate the output is
not supervising — they are hoping. The measurable version of that gap:

- **L1 · Approve** — reads the diff, can say whether it did what was asked.
- **L2 · Choose** — presented with two approaches and their tradeoffs, picks correctly and can say
  why.
- **L3 · Spot** — finds the defect before the audit does.

The ledger tracks which concepts a user has reached L3 on. That is what "experienced enough to
supervise" means concretely, and it is what this skill moves.

---

## Phase 0 — Load the state

```bash
cat ~/.claude/raffy/progress.md 2>/dev/null
cat .raffy/progress.md 2>/dev/null
```

The ledger holds concepts encountered, level per concept, and past drill results. **No ledger?**
This is their first session — say so, start at L1, and create it.

Then ask what they want to work on, or pick from the weakest concepts in the ledger. Do not run
more than **five drills** in a sitting; attention is the constraint, not material.

## Phase 1 — Source the material

In priority order. Higher sources make better drills because the stakes are already real:

1. **Findings from a recent `/raffy:qa-audit` or `/raffy:secure`** — a verified defect with
   `file:line` is the best possible drill. Use the code *before* the fix.
2. **Git history** — a commit that fixed a bug. Show the parent, ask what is wrong.
   `git log --oneline --grep='fix' -20`
3. **The current codebase** — run the `secure` scan or read the code against the concepts in the
   ledger. Live defects make the sharpest drills, and finding one is a real result.
4. **The decisions in `.raffy/progress.md`** — "you chose Drizzle over Prisma; what would make that
   the wrong call?" Tests judgment rather than detection.

If none of these produce material, say so plainly and offer to run `/raffy:secure` first. **Do not
fabricate a defect.** An invented bug teaches an invented lesson, and the user will not trust the
next one.

## Phase 2 — Run the drill

One exercise at a time. The shape:

```
DRILL 3/5 · concept: row-level-authorization · your level: L2

  app/api/invoices/[id]/route.ts:93

  export async function PATCH(req: Request, { params }) {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await req.json()
    const invoice = await db.update(invoices)
      .set(body)
      .where(eq(invoices.id, params.id))
      .returning()

    return Response.json(invoice)
  }

  There are two problems here. What are they, and which is worse?
```

**Then stop and wait.** Do not reveal, do not hint on the first pass. The pause is where the
learning happens; filling it destroys the exercise.

### Grading

Be direct and be fair:

- **Got it** — say so in one line and move on. Do not embellish a correct answer.
- **Partial** — name what they found, then give one hint at the rest. Ask again.
- **Missed** — reveal, explain the mechanism, and show the fix. No consolation, no lecture.

Then the part that matters most: **why an agent produces this.** In the example above, the session
check looks like authorization, so both the model and the reviewer stop reading. And the spread of
`body` is mass assignment — a user sets `ownerId` or `status: "paid"` on themselves. Naming the
*pattern* is what transfers to the next codebase.

## Phase 3 — Escalate or hold

- **Two correct at a level** → promote that concept and say so out loud. Progress must be visible.
- **Two missed** → drop a level and drill the underlying concept instead. Missing row-level
  authorization repeatedly usually means the session-versus-request-parameter distinction has not
  landed yet.

## Phase 4 — Record

Append to `~/.claude/raffy/progress.md`:

```markdown
## drill — <date> — <project>
row-level-authorization   L2 → L3  (2/2)
webhook-idempotency       L1 → L1  (0/2 — revisit: at-least-once delivery)
mass-assignment           new → L1
```

Then close with **one thing to watch for in their next session**, tied to the concept they just
missed. Specific, and in their codebase.

---

## Rules

- **Real code only.** Their repo, their git history, their findings. Never a fabricated example.
- **Stop after asking.** The pause is the exercise.
- **Five drills maximum** per sitting.
- **Explain the pattern, not just the fix.** "Why an agent writes this" is the transferable part.
- **Grade honestly.** Inflated grading produces a user who thinks they can supervise and cannot,
  which is worse than not running the drill.
- **Show progress explicitly.** A promotion that goes unmentioned did not happen.
- **Never drill on code the user did not write or commission.** This is their codebase, not a
  public one.
