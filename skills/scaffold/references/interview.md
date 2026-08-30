# The interview

Ten to fifteen minutes of questions that prevent a rewrite. Ask conversationally, one at a time
for a new user, batched for a fluent one. **Never infer an answer you could ask for.**

Every question below maps an answer to a *constraint*, and constraints — not preferences — pick
components.

---

## Q1 · What are you building, and who uses it?

Push past the category. "A SaaS" decides nothing; "a booking tool barbershops use on a phone while
standing at the chair" decides mobile-first, offline tolerance, and SMS over email.

**Listen for:** consumer vs business · public content vs private app · does anyone see this who is
not logged in (→ SEO and server rendering) · phone or desktop · one-off tool or a product.

## Q2 · Do people log in — and can any user see another user's data?

The most important question in the interview, and the one AI-built apps fail most often.

- **No login** → skip auth entirely. Do not add it "for later".
- **Login, everyone sees the same data** → simple session auth.
- **Login, users own private rows** → row-level authorization, enforced server-side on *every*
  query. This is the finding that shows up in ~10% of scanned AI-built apps as an exploitable hole.
- **Roles, teams, or organizations** → this is the real complexity. Model it explicitly now;
  retrofitting multi-tenancy is a rewrite, not a refactor.

**Follow-up when roles exist:** "can a user belong to two organizations?" The answer changes the
entire data model.

## Q3 · Does anything take longer than a web request?

Anything over roughly two seconds: sending email, calling an LLM, generating a PDF or report,
processing an image or video, importing a file, hitting a slow third-party API, scheduled work.

- **Nothing** → no queue. Put it behind a function anyway (see `growth-ladders.md`).
- **Something, low volume** → rung 1, pg-boss, no new infrastructure.
- **High volume, needs priorities or rate limits** → rung 2, BullMQ + Redis.
- **Must survive a crash mid-process** → rung 4, Temporal. Rare. Verify before believing it.

## Q4 · Is there anything JavaScript is genuinely bad at here?

ML inference, scientific computing, heavy dataframe work, computer vision, or an existing Python
library with no JS equivalent.

- **No** → one language, one deployable. Strongly prefer this.
- **Yes** → a separate Python service (FastAPI), talking over HTTP. Not a rewrite of the whole
  backend into Python.

"We might do AI later" is **not** a yes. Calling an LLM API is an HTTP request; every language does
those. Only local models and real data work justify the second runtime.

## Q5 · Realistically, how many people use this in six months?

Be blunt that the honest answer is usually "ten", and that this is *good* — it is what keeps the
stack from being over-built.

- **Under ~1k** → single Postgres, no cache, no replicas, no broker. Everything else is theatre.
- **~1k–100k** → same stack. Add Redis and indexes when a measurement says so.
- **Over 100k, genuinely** → ask what makes them confident. If the answer is solid, read the
  higher rungs. If it is a hope, build for a thousand and leave the seams.

## Q6 · Do you take money? *(when relevant)*

Payments bring webhooks, idempotency, and reconciliation — three things AI-generated code gets
wrong by default. A duplicate webhook must not charge twice. See `../knowledge/payments.md`.

Also decide: subscriptions vs one-off, and whether a merchant of record is worth it for global
tax handling.

## Q7 · Who maintains this in a year? *(when relevant)*

- **A solo non-engineer** → managed services, fewer moving parts, the boring choice everywhere,
  and a much heavier `CLAUDE.md`.
- **A team** → conventions and CI matter more; self-hosting is affordable.
- **Nobody / it's a prototype** → say so plainly and build the small version. A prototype that
  admits it is a prototype is not technical debt.

## Q8 · Anything you already know you want? *(always ask last)*

Sometimes they have a real constraint — an existing database, a company standard, a language they
know. Sometimes they name a tool they read about. Both are worth hearing.

**If they name something you would not have chosen:** explain the tradeoff, then defer to them and
log the override. Being right is worth less than them understanding the choice.

---

## Mapping answers to layers

| Answer | Layers to read |
|---|---|
| Public content, SEO matters | frontend (SSR/SSG), hosting |
| Private app, no SEO | frontend (SPA is fine), auth |
| Users own rows | auth, database, orm |
| Roles / organizations | auth, database — model tenancy explicitly |
| Long-running work | jobs |
| Multiple services talking | messaging — but check jobs is not enough first |
| Python needed | api (FastAPI), hosting (two deployables) |
| Uploads | storage |
| Search | search |
| Money | payments, notifications |
| Uses a model | ai |
| Mobile | mobile |

## When the user says "I don't know"

That is a real answer: **no known constraint.** Take the smaller option, and record the trigger
that would change it. Do not fill the gap with an assumption, and do not build for the possibility.
