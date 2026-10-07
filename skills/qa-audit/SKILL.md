---
name: qa-audit
description: Whole-product audit. Derives the app's real domains, fans out parallel agents for bugs, security, performance and logic gaps, verifies the severe ones, and writes tracker-ready findings. Use for "audit the app" or "find everything wrong". Not for a single diff.
---

# Deep Audit

Produce a findings report a senior engineer would sign their name to: every claim grounded in a
real `file:line`, the severe ones independently re-verified, and the plausible-but-wrong ones
explicitly rejected in writing.

The output is a set of markdown files where **each finding is already a ticket** — title,
impact, repro, fix, acceptance criteria.

## What makes this different from "list some bugs"

Three things, and they are the whole point. Do not skip them.

1. **Introspection before fan-out.** Domains are derived from what the repo actually contains, not
   from a generic checklist.
2. **A verification pass.** You personally re-check the severe findings against source before
   publishing. Agents produce plausible-sounding wrong answers; unverified output is worthless.
3. **A rejected-hypotheses section.** Things that looked like bugs and provably weren't. This is
   what makes the report trustworthy — it proves you tested rather than pattern-matched.

---

## Phase 0 — Scope and consent

Confirm before spending real money on agents:

- **What's in scope.** Whole product, or one surface? Admin/internal tooling is usually
  *excluded* — audit from the user's seat unless told otherwise.
- **Where output goes.** Default `Docs/audit-findings-<YYYY-MM-DD>/` (or the repo's existing docs
  convention — check for a `Docs/`, `docs/`, or `documentation/` dir and match it).
- **Is a live instance available?** Prod URL, staging, or local dev. Changes Phase 4.

If the user already said "audit everything autonomously", take that as consent and proceed —
don't re-ask. State your assumptions in one line and go.

**Get the repo to a known state first:** current branch, `git fetch`, pull latest on the default
branch, and record the exact commit SHA. Every finding is pinned to that SHA.

---

## Phase 1 — Introspect the repo

Do this yourself. It is fast and it determines everything downstream.

```bash
# stack + entrypoints
ls; cat package.json pyproject.toml go.mod Cargo.toml composer.json 2>/dev/null | head -60
# route/page surface (adapt to the framework you found)
find . -name "page.tsx" -o -name "route.ts" -o -name "*.controller.ts" | grep -v node_modules | sort
find . -path ./tests -prune -o -name "*.py" -print | grep -iE "rout|view|api|endpoint"
# size
find . -name "*.ts" -o -name "*.tsx" -o -name "*.py" | grep -v node_modules | wc -l
```

Then read the repo's own docs — `CLAUDE.md`, `README.md`, `Docs/*.md`, ADRs. They tell you what
the system is *supposed* to do, which is how you find gaps between intent and implementation.
**A documented promise the code doesn't keep is the highest-value finding class there is.**

Finally, find the fragile parts:

```bash
git log --oneline -200 | grep -iE "revert|hotfix|rollback|regress"   # what breaks repeatedly
git log --format="" --name-only -300 | grep -v "^$" | sort | uniq -c | sort -rn | head -25
```

High-churn files are where regressions already live. Weight agent attention toward them.

See `references/introspection.md` for the full command set per stack.

---

## Phase 2 — Derive domains

Group the surface into **independent domains a user would recognise**, not into layers. One agent
per domain.

Derive them from what you actually found. A consumer SaaS typically yields something like: auth
& onboarding · core product loop · creation/authoring · monetization & entitlements ·
discovery/feed · realtime (calls/chat/collab) · social & sharing · settings & account lifecycle.
Plus these cross-cutting passes, which are **always** worth their own agent:

- **Security** — authz/IDOR sweep across every endpoint, from an attacker's seat
- **Backend reliability & cost** — DB, async correctness, caching, provider resilience, spend
- **Performance & SEO** — rendering strategy, bundle, headers, crawlability (if it's a web product)

**Scale:** roughly one agent per coherent domain. 6–8 for a small app, 10–14 for a large one.
Past ~15 you get overlap, not coverage. Respect any workflow-size guideline in the environment.

Assign every domain **explicit file paths**. Overlapping scopes waste money; unassigned code
is a blind spot. Write the map down before spawning.

---

## Phase 3 — Fan out

Spawn all agents in **one message** so they run concurrently. Use `general-purpose` (or a
repo-specific auditor type if one exists).

Every agent prompt must contain, verbatim:

- **Repo path, branch, commit SHA**, and a one-paragraph description of what the product does
- **Its exact scope** — the file list, plus which service/layer boundaries it owns
- **What to hunt** — tailored to the domain. Generic prompts produce generic findings. Name the
  bug classes that actually apply: race conditions in a realtime domain, webhook idempotency in
  billing, IDOR in anything with an `:id` route, resource leaks in anything holding a device.
- **The method rules** (copy these exactly):
  - Read the files. Follow imports. Trace each flow end-to-end.
  - Every finding MUST cite a real `file:line`. **If you cannot ground it in code you read,
    drop it.**
  - `Confidence: confirmed` only if you read the exact code path and can state the failure
    concretely. Otherwise `likely`.
  - Prefer 10–18 high-value findings over 40 shallow ones. **No style nits. No "add more tests"
    filler. No theoretical vulnerability classes without a concrete call site.**
- **`READ-ONLY. Do NOT modify any source file. Your only write is your findings file.`**
- **The output path and the exact finding format** (`references/finding-format.md`)
- **"Your final response should be a 5-line summary only. The file is the deliverable."**
  — keeps 12 agents' worth of prose out of your context.

Give each agent a distinct output file in a scratch dir.

Point agents at the churn hotspots and at the repo's own docs for their domain.

---

## Phase 4 — Measure live (only if an instance exists)

While agents run, ground the analysis in reality. Read-only.

Load key pages and collect: Resource Timing, `PerformanceObserver` for CLS/LCP/long tasks,
console errors, duplicate or serialized API calls, response headers.

**Rules:**
- Public/read-only surfaces only. Never sign up, purchase, submit forms, or mutate state on a
  production system.
- **Measurement beats inference.** If you measure it and it's fine, it is fine — say so and drop
  the hypothesis.

This phase is where you earn the rejected-hypotheses section. See `references/live-measurement.md`.

---

## Phase 5 — Verify (mandatory, non-negotiable)

Agents will hand you confident, well-written, wrong findings. Your job is to catch them.

**Re-check every P0 yourself**, plus a sample of P1s, by reading the cited lines:

```bash
sed -n '<start>,<end>p' <cited file>
```

For each: does the code say what the finding claims? Does the failure actually follow?

- **Holds** → keep it.
- **Partially holds** (real risk, wrong trigger path) → keep, downgrade to `likely`, correct the
  description.
- **Doesn't hold** → cut it, and if it was a tempting hypothesis, move it to rejected.

Record how many you verified and how many held. Put that number in the README — it is the single
strongest credibility signal in the document.

**Never publish an unverified P0.**

---

## Phase 6 — Synthesize

Create the output dir. One file per domain, prefixed by priority order (`01-security.md`,
`02-monetization.md`, …) so the reading order encodes the triage.

Write `README.md` from `references/report-template.md` — it has the full skeleton. Sections,
in this order:

1. **Header** — date, commit SHA, scope, exclusions.
2. **Totals** — `N findings — X P0 · Y P1 · Z P2 · W P3`, and the confirmed/likely split.
3. **How this was produced** — passes run, verification count and hold rate, and the
   **rejected hypotheses** with their measurements.
4. **Top 10–15 table** — ranked by *blast radius*, not by fix difficulty. Columns:
   `# | Severity | Finding | Where | Why it's first`.
5. **The pattern worth naming** — the through-line. Usually one of: "shipped behaviour
   contradicts a published policy page", "client-side enforcement of a server-side rule",
   "no compensation on failure". Name it; it's what turns 200 tickets into one conversation.
6. **Duplicate clusters** — root causes found by multiple agents, with a merge instruction.
   Without this the tracker gets five tickets for one bug.
7. **File table** — file, finding count, what it owns.
8. **Tracker import instructions** — field mapping.
9. **Caveats** — state the limits plainly: static review vs executed exploits, what `likely`
   means, what was out of scope, that severity is a judgement call.

Verify your own counts before publishing:

```bash
for f in [0-9]*.md; do printf "%-40s %s\n" "$f" "$(grep -c '^### ' $f)"; done
grep -h '^### ' [0-9]*.md | wc -l
grep -ho "Confidence:\*\* confirmed" *.md | wc -l
```

A README whose numbers don't match its own files destroys the credibility the verification pass
bought you.

---

## Phase 7 — Hand off to a tracker

Emit `_issues.json` — every finding as a structured object ready for import:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/qa-audit/scripts/parse_findings.py" <findings-dir>
```

It prints severity/type/confidence counts and flags malformed findings. Use it as a **self-check
on your own report** even if no import follows — if it reports malformed entries, the findings
files are inconsistent and need fixing before anyone reads them.

Then follow `references/tracker-import.md`, which covers the field mapping, the confirm-destination
gate, and the **resumable ledger** (essential: importing 200 issues one API call at a time will
get interrupted, and without a ledger you create duplicates on retry).

---

## Rules

- **Grounded or dropped.** No finding without a `file:line` you actually read.
- **Verify before you publish.** Especially anything you're proud of.
- **Report what you rejected.** It is evidence of rigour, and it stops the same false lead being
  re-filed next quarter.
- **Read-only.** An audit does not fix things. Fixing mid-audit destroys the baseline and blows
  the scope.
- **Say what's good.** If the perf work is solid or release hygiene is clean, write that down. A
  report that finds only problems reads as unserious, and it makes the real findings land harder.
- **Severity is blast radius**, not effort. P0 = data loss, auth bypass, money loss, or broken for
  everyone.
- **Findings can contain live exploit paths.** Keep them in files and private trackers. Do not
  publish them to hosted pages, public issue trackers, or external services.
