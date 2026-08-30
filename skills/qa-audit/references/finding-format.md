# Finding format

Paste this block into **every** agent prompt verbatim. Consistency is what makes the findings
machine-parseable in Phase 7 — `../scripts/parse_findings.py` depends on this exact shape.

---

## The block

Repeat per finding, ordered most severe first, separated by `---`:

```
### [P0|P1|P2|P3] Short imperative title
- **Area:** <Domain> / <sub-area>
- **Type:** bug | security | perf | ux | a11y | cost | reliability | data | seo | gap
- **Files:** `path/to/file.ts:120-140`
- **What's wrong:** 2-4 sentences, concrete, referencing the actual code.
- **User impact:** what a real user experiences / what the business loses.
- **Repro:** numbered steps, or the exact input/state/load condition that triggers it.
- **Proposed fix:** 1-3 sentences, specific.
- **Acceptance criteria:**
  - [ ] testable statement
  - [ ] testable statement
- **Confidence:** confirmed | likely
```

---

## Field rules

**Title** — imperative, scoped to one change, readable without the body.
Good: `Refund the chat turn when generation fails — coins are debited before the reply exists`
Bad: `Coin bug`, `Issues with the payment flow`, `Improve error handling`

**Type** — drives the tracker label. One value, not a list.

**Files** — must be real and must be where the problem *is*, not where it's noticed. Line
ranges, not just filenames. Multiple paths allowed when the bug spans a boundary
(frontend call site + backend handler).

**What's wrong** — describe the code, not the category. Quote identifiers. If the codebase's own
comment or docstring contradicts the behaviour, **quote it** — a bug the code itself documents as
handled elsewhere is the most persuasive kind.

**User impact** — the "so what". Money, trust, data, or time. Never "this is bad practice".

**Repro** — concrete enough that someone could execute it. For perf/backend, the load condition.
For security, the exact request. If you can't write a repro, the finding probably isn't real.

**Acceptance criteria** — testable, and they must *fail today*. Prefer measurable:
`LCP on /pricing under 2.5s on Slow 4G` beats `page feels faster`. 2–4 items.

**Confidence** —
- `confirmed`: you read the exact code path and can state the failure concretely.
- `likely`: grounded in real code, but the full trigger path wasn't traced.

Be honest. A report that is 90% `confirmed` and admits the rest is worth far more than one
claiming certainty everywhere.

---

## Severity

Blast radius, not effort.

| | |
|---|---|
| **P0** | Data loss, auth bypass, cross-user data exposure, money loss, or broken for everyone. |
| **P1** | Broken for a meaningful subset, or significant revenue/trust impact. |
| **P2** | Degraded experience, or a latent bug awaiting the right conditions. |
| **P3** | Polish. Real, but nobody is suffering. |

Calibration: if you have more than ~12% P0, you're inflating and the report loses its force.
If you have zero P0 in a large consumer product, you probably didn't look at authorization.

---

## What does NOT belong

Cut these before writing the file. They are the difference between a report that gets acted on
and one that gets skimmed.

- Style, naming, formatting — that's what linters are for
- "Add more tests" / "improve documentation" as standalone findings
- Theoretical vulnerability classes with no concrete call site
- Anything you couldn't ground in a file you actually opened
- Restating a TODO the team already wrote, without adding impact analysis
- Duplicates of a finding you already wrote from a different angle

**A tempting hypothesis you tested and disproved is not a failure — hand it to the lead for the
rejected-hypotheses section.** Include what you checked and what you observed.
