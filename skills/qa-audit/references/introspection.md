# Introspection

Phase 1. Do this yourself before spawning anything — it determines the domain split, and a bad
split wastes every agent downstream.

Target: ~10 minutes. You are building a map, not reading the codebase.

---

## 1. Stack and entrypoints

```bash
ls
cat package.json pyproject.toml go.mod Cargo.toml composer.json Gemfile 2>/dev/null | head -80
cat docker-compose.yml Makefile 2>/dev/null | head -40
ls apps/ packages/ services/ src/ cmd/ 2>/dev/null      # monorepo shape
```

You want: language(s), framework(s), how many deployable services, where the boundaries are.

## 2. The user-facing surface

Adapt to what you found:

```bash
# Next.js App Router
find . -name "page.tsx" -o -name "route.ts" | grep -v node_modules | sort
# Next.js Pages / React Router / Vue
find . -path "*/pages/*" -name "*.tsx" | grep -v node_modules | sort
grep -rn "createBrowserRouter\|<Route\b\|useRoutes" src/ --include="*.tsx" | head -30
# FastAPI / Flask / Django
grep -rln "APIRouter\|@app.route\|urlpatterns" --include="*.py" . | grep -v test
# Express / Nest / Go / Rails
grep -rn "router\.\(get\|post\|put\|delete\)\|@Controller" --include="*.ts" . | head -30
grep -rn "http.HandleFunc\|mux.Handle" --include="*.go" . | head -30
sed -n '1,80p' config/routes.rb 2>/dev/null
```

Count it. Surface size drives agent count.

```bash
find . \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" \) \
  | grep -vE "node_modules|/test|/dist|/build" | wc -l
```

## 3. The repo's own intent — highest-value step

```bash
cat CLAUDE.md AGENTS.md README.md 2>/dev/null | head -120
ls Docs/ docs/ documentation/ adr/ 2>/dev/null
```

Read what the system claims to do, then check whether it does. **A documented promise the code
doesn't keep is the strongest finding class available** — nobody argues with it, because the
team wrote the requirement themselves.

Look especially for:
- Published policy/legal pages (privacy, cookies, terms) and marketing copy making factual claims
- ADRs describing an invariant
- Docstrings saying "X is handled by Y" — then check Y

Public-facing copy counts as documentation. In a web repo, grep the marketing pages for promises:

```bash
grep -rniE "private|we never|not shared|secure|encrypted|you control|consent" \
  --include="*.tsx" --include="*.mdx" app/ src/ | grep -viE "test|spec" | head -30
```

## 4. Fragility signals

```bash
git log --oneline -200 | grep -iE "revert|hotfix|rollback|regress|urgent"
git log --format="" --name-only -300 | grep -v "^$" | sort | uniq -c | sort -rn | head -25
```

High-churn files are where regressions already live. Name them in the relevant agent's prompt.

Low revert count is itself a finding — report it in the "what's good" paragraph.

## 5. Known-issue markers

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX\|BUG:" --include="*.ts" --include="*.tsx" --include="*.py" . \
  | grep -vE "node_modules|/test" | head -40
grep -rn "xfail\|@pytest.mark.skip\|\.skip(\|\.todo(" tests/ test/ spec/ 2>/dev/null | head -20
```

A tracked TODO isn't automatically a finding. It becomes one when you add the impact analysis the
author didn't: what breaks, for whom, how likely.

Skipped tests point at behaviour nobody is currently protecting.

## 6. Auth and authorization shape

Find the guard, then find who isn't using it — this is where the P0s are.

```bash
grep -rn "Depends(\|@login_required\|requireAuth\|getServerSession\|middleware" \
  --include="*.py" --include="*.ts" . | grep -viE "test|node_modules" | head -30
```

Then, per router/controller: list endpoints, note whether each has an auth dependency **and** an
ownership check. Endpoints taking an `:id` with only an auth check are IDOR candidates. Hand that
table to the security agent as a starting point — it saves it an hour.

---

## Output of this phase

Write it down before spawning:

1. **Stack summary** — services, languages, boundaries
2. **Surface inventory** — routes/pages grouped by product area
3. **Domain map** — domain → explicit file paths (no overlaps, no gaps)
4. **Hotspot list** — churn + TODOs + skipped tests, mapped to domains
5. **Intent list** — documented promises worth checking
6. **Commit SHA** — every finding is pinned to it
