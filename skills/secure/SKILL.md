---
name: secure
description: Fast pre-deploy security pass for the holes AI-built apps ship with — leaked secrets, missing row-level auth, open write routes, unverified webhooks, open CORS, public buckets. Every hit verified against source. Use for "is this safe to deploy" or "did I leak keys".
---

# Secure

The eight holes that account for most of what goes wrong in AI-built apps. Roughly 65% of scanned
vibe-coded applications carry at least one, and about 1 in 10 is directly exploitable.

This is **not** qa-audit. No agent fan-out, no domain derivation. A mechanical scan, a verification
pass, and a report — minutes, not an hour.

**Read-only. This skill never fixes anything.** It reports, and offers to fix afterwards as a
separate, confirmed step. An audit that edits while it looks cannot be trusted about what it found.

## The three that make it worth running

1. **Mechanical first, judgment second.** The scan script finds candidates by pattern. Patterns
   produce false positives, which is why step 2 exists.
2. **Every finding is verified against source before it ships.** Open the file, read the lines,
   confirm the hole is real and reachable. An unverified security finding is worse than none — it
   burns trust and hides the real ones.
3. **Exploitability, not theory.** "This endpoint has no auth check" matters. "This dependency has
   a CVE in a code path you never call" is noise. Rank by what an attacker can actually do.

---

## Phase 0 — Frame it

```bash
ls -a && cat package.json 2>/dev/null | head -40 && git log --oneline -3 2>/dev/null
```

Identify the stack: framework, ORM, auth library, host. The checks in `references/checks.md` are
grouped by stack, and running the Supabase checks on a Prisma app wastes everyone's time.

State the scope in one line before starting: *"Scanning <repo> — Next.js + Drizzle + Better Auth.
Read-only, roughly five minutes."*

---

## Phase 1 — Mechanical scan

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/secure/scripts/scan.ts" <repo-path>
```

Emits candidate hits with `file:line` for every pattern in the catalog. It is deliberately noisy —
recall over precision, because a missed secret costs more than a false positive.

Folders carrying a `SOURCE.json` (vendored third-party code with its upstream repo) are skipped and
counted in one line. Say the count in the report. Scan them with `--vendored` when the question is
supply chain rather than this app's own code.

If bun is unavailable, run the equivalent greps from `references/checks.md` by hand.

## Phase 2 — The eight checks

Work `references/checks.md` in order. The scan covers what is greppable; these need reading.

| # | Hole | What to actually check |
|---|---|---|
| 1 | **Exposed secrets** | Keys in client bundles, committed `.env`, `NEXT_PUBLIC_*` holding a real secret, keys in git history |
| 2 | **Missing row-level authorization** | Every query that reads user-owned data — is it filtered by the *session* user, server-side? |
| 3 | **Unauthenticated writes** | Every POST/PUT/PATCH/DELETE route and server action — is there an auth check before the mutation? |
| 4 | **Client-side authorization** | Role checks in components, hidden buttons standing in for access control |
| 5 | **Unverified webhooks** | Stripe and every other webhook — signature verified? Event id stored for idempotency? |
| 6 | **Unvalidated input** | Request bodies, params and webhook payloads parsed straight into queries or the ORM |
| 7 | **Open CORS / missing rate limits** | Wildcard origins, unmetered LLM or auth endpoints |
| 8 | **Public storage** | Buckets readable without a signed URL, user-supplied filenames, no size or type limit |

Two more that are always worth thirty seconds: **SQL built by string interpolation**, and
**`dangerouslySetInnerHTML` fed by user content**.

## Phase 3 — Verify

**Open every candidate and read it.** For each, answer three questions in writing:

- **Is it real?** The pattern matched — does the hole actually exist in this code path?
- **Is it reachable?** Can an unauthenticated or wrong user get there? A check in dead code is not
  a finding.
- **What is the worst case?** Read another user's data · take over an account · spend your money ·
  deface · nothing.

Anything that fails "is it real" moves to the rejected list. **Do not quietly drop it** — a
rejected hypothesis with its evidence is what proves the pass was thorough rather than
pattern-matched.

## Phase 4 — Report

Findings use the same block as qa-audit — read
`${CLAUDE_PLUGIN_ROOT}/skills/qa-audit/references/finding-format.md` so both skills produce
tracker-compatible output.

Severity here is exploitability:

- **P0** — an attacker reads or modifies another user's data, takes an account, or spends money.
  Do not deploy.
- **P1** — requires a condition (a leaked id, a specific role) but the impact is data or money.
- **P2** — real weakness, no direct path today. Rate limits, weak CORS, missing headers.
- **P3** — hardening. Headers, dependency updates, defence in depth.

Close the report with three sections: **fix before deploy**, **fix this week**, and
**checked and clean** — the last one names what you verified as safe. A report that lists only
problems reads as pattern-matching; naming what held proves you looked.

## Phase 5 — Offer to fix

Separately, and only after the report is read. Ask which findings to fix, fix those, and re-run
the scan to confirm. Never fix during the audit.

---

## Rules

- **Read-only until Phase 5**, and Phase 5 requires explicit consent.
- **`file:line` or it does not ship.** Same rule as qa-audit.
- **Verify before reporting.** Every finding, without exception.
- **Rank by exploitability**, never by how alarming the pattern name sounds.
- **Say what was clean.** Naming what held is what makes the rest credible.
- **Never print a discovered secret in full.** First four characters and the location. And if a
  live key is found, say plainly that it must be rotated — removing it from the repo is not enough
  once it has been committed.
