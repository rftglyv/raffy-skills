# Tracker import

Phase 7. Turning the findings directory into tickets.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/qa-audit/scripts/parse_findings.py" <findings-dir>
```

Emits `_issues.json` next to the findings — one object per finding, with `title`, `body`,
`severity`, `priority`, `type`, `area`, `files`, `impact`, `acceptance_criteria`, `confidence`.
It prints severity/type/confidence counts and flags anything malformed. Use `--strict` to fail
the run on malformed input, `--min-severity P1` to import only the actionable set.

---

## Choose the route by size

| Count | Route | Why |
|---|---|---|
| **any** | **CSV / native importer** | One file, one drag, preview before commit. Fastest by far. |
| > 50 | **API + scripted loop** | One bash/curl loop. Full field control. Needs an API token. |
| < 30 | **MCP server** | Convenient, but one tool call per issue. |
| — | `gh issue create` | Fast (CLI loop), but only if GitHub is the actual destination. |

**Say this out loud before starting:** an MCP route costs one tool call per issue. For 200 issues
that is 200 sequential network round-trips whose results all land in context — expect hours and
heavy context use. A CLI or CSV route does the same work in one command. Recommend accordingly,
then **do what the user chooses** — if they pick the slow route after hearing the tradeoff, that's
their call. State the tradeoff once; don't re-litigate.

---

## Always confirm the destination first

Before creating anything:

- List available teams / projects / boards and existing labels
- Propose the target and the labels you'd need to create
- **Wait for an explicit yes**

200 tickets in the wrong team is loud, and cleanup is manual. This gate is not optional.

---

## Field mapping

| Finding | Ticket |
|---|---|
| `title` | Title, verbatim — do not "improve" it |
| `body` | Description, verbatim (already well-formed markdown) |
| `severity` | P0→Urgent · P1→High · P2→Medium · P3→Low |
| `type` | Label (`bug`, `security`, `perf`, `ux`, `a11y`, `cost`, `reliability`, `data`, `seo`, `gap`) |
| `area` | Second label, or the epic/project |
| — | `qa-audit` label on every issue, so the batch is filterable and revertible |

Append a provenance footer to each description:

```
---
Source: `<findings-dir>/<file>.md` · audit commit `<sha>` · confidence: <confidence>
```

Create in **P0 → P1 → P2 → P3** order so the critical ones get the lowest issue numbers and land
at the top of any default sort.

---

## Idempotency — required for anything over ~30

Long import runs get interrupted. Without a ledger, the retry double-files.

Before starting, create `<findings-dir>/_ledger.jsonl`. After **each** successful create,
immediately append one line:

```json
{"title": "...", "id": "...", "identifier": "ENG-123"}
```

On every run, load the ledger first and skip any title already present. Dying at issue 150 must
mean the retry creates 56, not 206.

On a single failure: log it, continue, report failures at the end. Never abort the batch for one
bad create.

Report progress every ~25 — a count and the current severity band. Do not narrate each ticket.

---

## Duplicate clusters

The README's cluster table lists root causes found by multiple agents. Handle one of two ways,
and ask which the user wants:

**Merge (default)** — file only the most severe member of each cluster. Fewer, better tickets.

**File all, then link** — create everything, then add a tracker relation from each non-canonical
member to the canonical one. If relations aren't available, prepend to each duplicate's
description:

```
> Duplicate of <ENG-XXX> — same root cause, different surface.
```

---

## Final report

- Total created, broken down by severity
- Identifier range (e.g. `ENG-101 … ENG-306`)
- Any failures, with reasons
- **The P0 identifiers as a plain list** — that's what gets pasted into standup

---

## Security

Findings descriptions routinely contain working exploit paths for a live system. Keep them in
files and private trackers. Do not publish them to public issue trackers, hosted pages, artifacts,
or any external service — and say so when recommending a route.
