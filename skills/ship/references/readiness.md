# Production readiness — twelve items

Each has: what good looks like, how to verify it, and the failure it prevents. **Verification means
running something**, not finding a file.

---

## Config

### 1 · Environment separation
**Good:** development, staging and production have separate databases, separate keys, and separate
third-party accounts (Stripe test vs live).
**Verify:** `grep -rn "DATABASE_URL\|STRIPE_" .env* --include='*.example'` and confirm the deploy
config points somewhere different from local.
**Prevents:** testing against production data, and the classic — a test charge on a live card.

### 2 · Secrets in a real store
**Good:** secrets live in the platform's secret store or a `.env` that is git-ignored and never
committed. `.env.example` holds placeholders only.
**Verify:** `git log --all --oneline -- .env .env.local | head` — empty is the only acceptable
result. Then `git check-ignore -v .env`.
**Prevents:** a leaked key. **If a real key was ever committed, it must be rotated** — removing it
from the current tree does nothing.

### 3 · Environment validated at boot
**Good:** a schema parses `process.env` at startup and the process **exits** on a missing or
malformed variable.
**Verify:** unset a required variable and start the app. It must fail immediately and say which
one.
**Prevents:** a missing variable surfacing at 3am inside a code path nobody had run yet — usually
password reset or payments.

---

## Data

### 4 · Migrations, versioned and applied by the deploy
**Good:** every schema change is a committed migration file. The deploy applies them. Nobody has
ever typed `ALTER TABLE` into production.
**Verify:** `ls migrations/ drizzle/ prisma/migrations/ 2>/dev/null` — files exist and are in git.
Then apply them to an empty scratch database and confirm the schema matches production.
**Prevents:** the single most expensive thing to retrofit. A hand-edited production schema has no
forward path and no reproducible environment.

### 5 · Seed data and a documented rollback path
**Good:** one command builds a working local database. Every migration's down-path is known — or
explicitly documented as forward-only, which is a legitimate choice made deliberately.
**Verify:** drop the local database, run migrate + seed, and confirm the app boots.
**Prevents:** a broken migration in production with no way back.

### 6 · Backups with a tested restore
**Good:** automatic daily backups, retention that matches how long it would take to notice
corruption, and **a restore you have performed**.
**Verify:** take a backup, restore it into a scratch database, count rows in the biggest table.
Write down how long it took — that number is your real recovery time.
**Prevents:** discovering the backup was empty, encrypted with a lost key, or a schema dump with no
data. Managed database snapshots count, but the restore still has to be tested.

---

## Runtime

### 7 · Error handling at every boundary
**Good:** every external call — database, third-party API, LLM, payment, email — has a timeout and
a failure path. Users see a useful message, not a stack trace and not a spinner forever.
**Verify:** point a third-party base URL at a black hole and use the app. It should fail quickly
and legibly.
**Prevents:** one slow dependency taking the whole app down, which is the most common outage there
is.

### 8 · Structured logs with request ids
**Good:** JSON logs, a request id on every line, and that id returned to the user on errors. No
secrets, tokens or full request bodies in the logs.
**Verify:** trigger an error, then find every line for that request with one query.
**Prevents:** unreproducible bug reports. "Error ref 8f3a" turns a week of guessing into one query.

### 9 · A health check that checks something
**Good:** `/health` verifies the database connection and any critical dependency, and returns
non-200 when they are down.
**Verify:** `curl /health`, then stop the database and `curl` again. A different answer is required.
**Prevents:** a load balancer routing traffic to an instance that is up but broken.

---

## Delivery

### 10 · CI that gates the merge
**Good:** on every PR — install, typecheck (`tsc --noEmit`), test, build. Red blocks the merge.
**Verify:** push a branch with a deliberate type error and confirm CI goes red.
**Prevents:** the agent shipping something that does not compile. This is the cheapest supervision
available and it works while you sleep.

### 11 · One-command rollback
**Good:** a single documented command returns to the previous known-good version, and you know
whether it also reverts the database.
**Verify:** **run it.** Deploy, roll back, confirm the old version is serving.
**Prevents:** a bad deploy becoming a bad night. Note the sharp edge: a rollback does not undo a
migration. If a deploy adds a destructive migration, the rollback is not a rollback — which is why
additive migrations (add a column, backfill, then drop later) are worth the extra step.

### 12 · A staging environment
**Good:** something that looks like production, with its own database, that the main branch deploys
to.
**Verify:** deploy to it and use it.
**Prevents:** production being the first place a change ever runs. A preview environment per PR is
the better version of this where the host supports it.

---

## The pre-launch pass

Fifteen minutes, worth all of them:

- Custom domain with TLS, and a redirect from the naked domain
- Error tracking receiving events — trigger one deliberately and confirm it lands
- Uptime check pointed at `/health`, alerting somewhere you will actually see
- Email sending from a domain with SPF, DKIM and DMARC — **check the spam folder from a real
  Gmail account**, not just that the API returned 200
- `robots.txt` and a `noindex` on any staging environment
- A 404 and a 500 page that are not the framework's default
- Rate limits on login, signup, password reset and any LLM endpoint
- One real end-to-end run through the core flow, in production, with a real card if money is
  involved
