# The concept map

Concepts are the unit of progress. Each has a level per user in the ledger, an observable
definition of L3, and the reason an agent gets it wrong — which is the part that transfers.

Concept slugs match the `Teaches:` field on the scaffold knowledge cards, so a stack composed in
Phase 2 of `scaffold` already names what its user will need to learn.

---

## Tier A — the ones that leak data or money

Drill these first. Everything else is craft; these are consequences.

### `row-level-authorization`
**L3 looks like:** given any query, immediately asks "filtered by the *session* user, or by an id
from the request?"
**Why agents miss it:** a session check at the top of the handler *looks* like authorization, so
both the model and the reviewer stop reading there.
**Drill source:** any handler taking `params.id`.

### `mass-assignment`
**L3:** sees `...body` spread into an update and asks which fields a user could set.
**Why agents miss it:** the happy path works perfectly. The defect only appears when someone sends
a field you did not document.

### `webhook-idempotency`
**L3:** asks "what happens when this arrives twice?" before reading anything else.
**Why agents miss it:** providers retry; local testing never does. The bug cannot be reproduced by
the person who wrote it.

### `secret-exposure`
**L3:** knows which prefixes ship to the browser without looking them up, and knows a committed key
must be rotated rather than deleted.
**Why agents miss it:** `NEXT_PUBLIC_` makes the error go away, so it gets applied as a fix.

### `injection`
**L3:** spots interpolation into SQL or HTML in a single pass.
**Why agents miss it:** string building is the most natural way to express the query.

---

## Tier B — the ones that break under load or time

### `at-least-once-delivery`
**L3:** assumes every job and message handler runs more than once, and designs for it.
**Why agents miss it:** queue APIs read like function calls.

### `request-boundary`
**L3:** notices when something slow sits inline in a request handler, before it becomes a timeout.
**Why agents miss it:** it works fine with one user and a fast network.

### `transactions`
**L3:** sees multi-step writes and asks what happens if step two fails.
**Why agents miss it:** the ORM makes each write independently easy.

### `migrations`
**L3:** knows a schema change without a committed migration is a future outage, and that a rollback
does not undo one.
**Why agents miss it:** push-to-database is faster in development and gives identical results there.

### `connection-pooling`
**L3:** connects "serverless" to "exhausted pool" without being prompted.
**Why agents miss it:** it fails only under concurrency, which local development never has.

---

## Tier C — judgment, not detection

These are drilled by asking the user to *choose*, not to *spot*.

### `earn-the-infrastructure`
**L3:** can name the specific measurement that would justify adding Redis, a queue, or a broker —
and refuses to add one without it.
**Why agents miss it:** models pattern-match to what serious systems look like, so they propose
the architecture of a system a thousand times larger.

### `cost-to-remove`
**L3:** asks how hard a dependency is to remove *before* adopting it, not after.

### `abstraction-timing`
**L3:** can say why the third occurrence is the right time to extract a shared function, and the
second usually is not.

### `test-assertion-integrity`
**L3:** when a test fails, asks whether the code or the assertion is wrong — and never lets an
agent change the assertion to make a test pass without checking.
**Why it matters most:** this is the single behaviour that most reliably prevents an agent from
silently breaking working software.

---

## Running a Tier C drill

Detection drills show code and ask what is wrong. Judgment drills show a **decision** and ask what
would change it:

```
DRILL · concept: earn-the-infrastructure · L2

  Your app sends a welcome email on signup. Today it runs inline in the
  route handler and takes about 900ms.

  An agent has proposed adding Redis and BullMQ.

  Do you take it? If not, what exactly would have to be true before you do —
  and what would you do instead today?
```

The right answer is not a component. It is a **threshold**, and the seam that makes moving cheap
when the threshold arrives.
