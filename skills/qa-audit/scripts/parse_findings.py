#!/usr/bin/env python3
"""Parse deep-audit findings markdown into structured JSON for tracker import.

Usage:
    python3 parse_findings.py <findings-dir> [-o OUT] [--min-severity P2] [--strict]

Reads every ``NN-name.md`` in the directory, extracts each ``### [Pn] Title`` block, and
emits a JSON array where each object is one ready-to-file ticket.

Depends on the exact block shape in references/finding-format.md.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter

HEADING = re.compile(r"###\s*\[(P[0-3])\]\s*(.+)")
SPLIT = re.compile(r"\n(?=###\s*\[P[0-3]\])")
# a field runs until the next "- **Field:**" bullet, a markdown heading, a rule, or EOF
FIELD = (
    r"\*\*{name}:\*\*\s*(.*?)"
    r"(?=\n[-*]\s*\*\*[A-Z][A-Za-z' /]*:\*\*|\n#{{1,6}}\s|\n---\s*(?:\n|$)|\Z)"
)

SEVERITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def derive_area(stem: str) -> str:
    """`03-auth-onboarding` -> `Auth Onboarding`."""
    return re.sub(r"^\d+[-_]", "", stem).replace("-", " ").replace("_", " ").title()


SINGLE_LINE = {"Confidence", "Type", "Area"}


def field(body: str, name: str) -> str:
    m = re.search(FIELD.format(name=re.escape(name)), body, re.S)
    if not m:
        return ""
    val = m.group(1).strip()
    if name in SINGLE_LINE:
        val = val.splitlines()[0].strip() if val else ""
    return val


def parse_file(path: str) -> list[dict]:
    stem = os.path.splitext(os.path.basename(path))[0]
    area = derive_area(stem)
    text = open(path, encoding="utf-8").read()

    found = []
    for part in SPLIT.split(text):
        m = HEADING.match(part.lstrip())
        if not m:
            continue
        severity, title = m.group(1), m.group(2).strip()
        body = part.lstrip()[m.end() :].strip()
        # drop a trailing horizontal rule / next-section bleed
        body = re.split(r"\n---\s*(?:\n|$)", body)[0].strip()

        found.append(
            {
                "file": stem,
                "area": field(body, "Area") or area,
                "severity": severity,
                "priority": SEVERITY_ORDER[severity],
                "title": title,
                "type": (field(body, "Type") or "bug").split("|")[0].strip(),
                "confidence": field(body, "Confidence") or "unspecified",
                "files": field(body, "Files"),
                "impact": field(body, "User impact"),
                "acceptance_criteria": [
                    ln.strip()[5:].strip()
                    for ln in field(body, "Acceptance criteria").splitlines()
                    if ln.strip().startswith("- [ ]")
                ],
                "body": body,
            }
        )
    return found


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("findings_dir")
    ap.add_argument("-o", "--out", default=None, help="default: <findings-dir>/_issues.json")
    ap.add_argument("--min-severity", default="P3", choices=list(SEVERITY_ORDER))
    ap.add_argument("--strict", action="store_true", help="exit 1 on any malformed finding")
    args = ap.parse_args()

    d = args.findings_dir
    if not os.path.isdir(d):
        print(f"error: not a directory: {d}", file=sys.stderr)
        return 2

    paths = sorted(
        os.path.join(d, f)
        for f in os.listdir(d)
        if re.match(r"^\d+[-_].*\.md$", f)
    )
    if not paths:
        print(f"error: no NN-name.md files in {d}", file=sys.stderr)
        return 2

    issues: list[dict] = []
    for p in paths:
        issues.extend(parse_file(p))

    cutoff = SEVERITY_ORDER[args.min_severity]
    issues = [i for i in issues if i["priority"] <= cutoff]
    issues.sort(key=lambda i: (i["priority"], i["file"]))

    # quality gate — a finding missing these is unusable downstream
    problems = []
    for i in issues:
        if len(i["body"]) < 120:
            problems.append(f"{i['file']}: body too short — {i['title'][:60]}")
        if not i["files"]:
            problems.append(f"{i['file']}: no Files field — {i['title'][:60]}")
        if not i["acceptance_criteria"]:
            problems.append(f"{i['file']}: no acceptance criteria — {i['title'][:60]}")

    out = args.out or os.path.join(d, "_issues.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(issues, fh, indent=1, ensure_ascii=False)

    sev = Counter(i["severity"] for i in issues)
    print(f"parsed {len(issues)} findings from {len(paths)} files -> {out}")
    print("  severity: " + " · ".join(f"{k} {sev[k]}" for k in sorted(sev, key=SEVERITY_ORDER.get)))
    print("  type:     " + " · ".join(f"{k} {v}" for k, v in Counter(i["type"] for i in issues).most_common()))
    print("  conf:     " + " · ".join(f"{k} {v}" for k, v in Counter(i["confidence"] for i in issues).most_common()))

    if problems:
        print(f"\n  {len(problems)} malformed:", file=sys.stderr)
        for p in problems[:15]:
            print("    - " + p, file=sys.stderr)
        if len(problems) > 15:
            print(f"    … and {len(problems) - 15} more", file=sys.stderr)
        if args.strict:
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
