# raffy-skills

Claude Code plugin. One skill so far: **`raffy:qa-audit`** — an autonomous whole-product audit that
produces findings a senior engineer would sign their name to.

## What it does

Point it at a repo. It:

1. **Introspects** — derives the product's real user-facing domains from routes, services and the
   repo's own docs, instead of applying a generic checklist.
2. **Fans out** — one parallel agent per domain, each with an explicit file scope and a
   domain-specific bug-class list, all read-only.
3. **Measures live** — if an instance exists, collects real Web Vitals and API timing (read-only,
   never mutating).
4. **Verifies** — re-checks every P0 against source itself. Agents produce confident wrong
   answers; unverified output is worthless.
5. **Reports** — one markdown file per domain where **every finding is already a ticket**: title,
   impact, repro, fix, acceptance criteria, confidence.
6. **Imports** — parses the findings into structured JSON for Linear / Jira / GitHub, with a
   resumable ledger so a 200-issue import survives being interrupted.

## Why it's different

Most "audit my app" runs produce a plausible list nobody acts on. Three things fix that:

- **A verification pass.** The report states how many severe findings were independently
  re-verified and how many held. That number is the credibility of the whole document.
- **A rejected-hypotheses section.** Things that looked like bugs and provably weren't, with
  measurements. Anyone can list possible bugs; only someone who actually looked can list what
  turned out fine.
- **It says what's good.** A report that finds only problems reads as unserious — and it makes the
  real findings land harder when they're surrounded by honest calibration.

Every finding cites a real `file:line`. Anything that can't be grounded in code gets dropped.

## Install

```bash
claude plugin marketplace add ~/code/raffy-skills
claude plugin install raffy@raffy-skills
```

Or from GitHub once pushed:

```bash
claude plugin marketplace add rftglyv/raffy-skills
claude plugin install raffy@raffy-skills
```

## Use

```
/raffy:qa-audit
```

Or just ask: *"audit the whole app and list the bugs"*, *"find everything wrong with this
product"*, *"QA the app and prep it for Linear"*.

Scope it if you want: *"audit only the payments and auth surfaces"*.

## Output

```
Docs/audit-findings-<YYYY-MM-DD>/
├── README.md                  # index: totals, top-N ranked, duplicate clusters, caveats
├── 01-security.md             # one file per domain, priority-ordered
├── 02-monetization.md
├── ...
├── _issues.json               # generated — structured, ready for tracker import
└── _ledger.jsonl              # generated during import — makes it resumable
```

## Layout

```
skills/qa-audit/
├── SKILL.md                       # the 8-phase procedure
├── references/
│   ├── introspection.md           # per-stack discovery commands
│   ├── finding-format.md          # the exact finding block + severity calibration
│   ├── live-measurement.md        # read-only Web Vitals / API timing collection
│   ├── report-template.md         # the README skeleton
│   └── tracker-import.md          # field mapping, route selection, resumable ledger
└── scripts/
    └── parse_findings.py          # findings markdown → structured JSON
```

`parse_findings.py` doubles as a **self-check**: run it on your own report and it flags any
finding missing a `Files` field, acceptance criteria, or a substantive body.

```bash
python3 skills/qa-audit/scripts/parse_findings.py <findings-dir> --strict
```

## Cost

Real. It spawns 6–14 agents that each read a lot of source. Scale-appropriate for a milestone
audit, not for checking a single diff — use a code-review skill for that.

## Safety

- **Read-only.** The audit never modifies source. Fixing mid-audit destroys the baseline.
- **No live exploitation.** Findings describe attacks; they don't execute them. Live measurement
  is limited to public, read-only page loads.
- Findings routinely contain working exploit paths. Keep them in files and private trackers — not
  on hosted pages or public issue trackers.

## License

MIT
