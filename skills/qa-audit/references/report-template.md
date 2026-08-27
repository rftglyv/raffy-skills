# Report template

The `README.md` of the findings directory. This is the only file most people will read — the
other 12 exist so this one is trusted.

Section order below is deliberate: **credibility before content**. A reader who doesn't believe
the method won't act on the findings.

---

```markdown
# Full-app QA audit — <product / repo>

**Date:** <YYYY-MM-DD> · **Commit audited:** `<sha>` (<branch>) · **Scope:** <what was covered>.
<What was excluded, and why. e.g. "Admin panel deliberately excluded — this audit is from the
*user's* seat.">

**<N> findings — <X> P0 · <Y> P1 · <Z> P2 · <W> P3.**

---

## How this was produced

<K> parallel audit passes, one per product domain, each reading the actual source
(<layer> → <layer> → <layer>) and tracing flows end-to-end rather than pattern-matching.
<Plus a pass of live read-only measurement, if run.>

Every finding cites `file:line`. Findings are marked `confirmed` (the exact code path was read
and the failure can be stated concretely) or `likely` (grounded in code but the trigger path
wasn't fully traced). **<A> are `confirmed`, <B> are `likely`.**

<V> of the most severe claims were then independently re-verified against source before
publishing this index. **All <V> held.** <N> plausible-sounding hypotheses were *tested and
rejected* — recorded in `<NN>-live-production-measurements.md` so nobody re-files them:

- <Hypothesis> → <what you measured, with the number>.
- <Hypothesis> → <what you measured, with the number>.

<One honest paragraph on what is GOOD. Release hygiene, perf work, test coverage — whatever
actually holds up. Then name where the debt is concentrated. This paragraph is what makes the
P0 list land instead of reading as an attack.>

---

## The <N> that should be fixed first

Ranked by blast radius, not by how hard they are.

| # | Severity | Finding | Where | Why it's first |
|---|---|---|---|---|
| 1 | P0 | **<Punchy name>** — <one-line mechanism> | `file.ts:414` | <consequence in business terms> |

### The pattern worth naming

<The through-line across several findings. Usually one of:>
<- shipped behaviour contradicts a page the company already publishes>
<- a server-side rule enforced only on the client>
<- no compensation when a paid operation fails>
<- the same guard applied on one surface but not its sibling>

<Say why it's the cheapest argument to win. A contradiction with the company's own published
page needs no severity debate — the page states the requirement.>

---

## Duplicate clusters — merge these before importing

Different passes found the same root cause from different angles. File **one** ticket each.

| Root cause | Reported in |
|---|---|
| <root cause> | `04-chat` (P0+P1), `02-monetization` (P0), `10-backend` (P1) |

---

## Files

| File | Findings | Owns |
|---|---|---|
| `01-security.md` | 20 | <scope one-liner> |

---

## Importing to <tracker>

Each `###` block is one issue, already shaped for it:

- **Title** — the `###` line
- **Description** — `**Area:**` down to `**Confidence:**`
- **Acceptance criteria** — the checklist
- **Labels** — from `**Type:**`
- **Priority** — from `[P0]`…`[P3]`

Suggested epics: <derived from the actual clusters>.

Do the duplicate merge above **before** import.

---

## Caveats — state these if challenged

- This is **static source review<, plus read-only production measurement>**. No exploit was run
  against any live host. P0s marked `confirmed` are confirmed *in code*; repro steps are derived,
  not executed.
- The <B> findings marked `likely` are grounded in real code but the full trigger path was not
  traced. Triage those before committing engineering time.
- <What was out of scope.>
- Severity is one reviewer's judgement. The top <N> are ordered by blast radius; your priorities
  may reasonably differ.
```

---

## Rules for filling it in

**The rejected hypotheses are not optional.** They are the highest-signal part of the document.
Anyone can produce a list of possible bugs; only someone who actually looked can produce a list of
things that turned out fine, with measurements. If you rejected nothing, you did not verify
enough — go back to Phase 5.

**Report the verification count and hold rate.** "12 of the most severe re-verified, all 12 held"
is worth more than fifty extra P2s.

**Say what's good, specifically.** Not flattery — evidence. "Only one revert in 200 commits",
"measured CLS 0.000", "the deferred third-party loading strategy works as designed". It calibrates
the reader and it is the difference between a report that reads as diagnosis and one that reads as
an attack.

**Check your own arithmetic before publishing.** Counts in the README must match the files:

```bash
for f in [0-9]*.md; do printf "%-40s %s\n" "$f" "$(grep -c '^### ' $f)"; done
grep -h '^### ' [0-9]*.md | wc -l
grep -ho "Confidence:\*\* confirmed" *.md | wc -l
```

A mismatched number in the summary discredits everything under it.

**Order the top table by blast radius, never by fix difficulty.** "Easy wins first" is a planning
decision that belongs to whoever owns the roadmap, not to the auditor.
