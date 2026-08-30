# Layer: Background jobs

Read `../references/growth-ladders.md` first. **Take the lowest rung that meets a stated
constraint**, and put long-running work behind a function boundary even at rung 0 — that seam costs
nothing today and a week later.

### Inline, behind a function (rung 0)
**Docs:** n/a — it is a function call.
**Teaches:** request-boundary
Just call it, but call it from a named function like `sendWelcomeEmail(userId)` rather than inlining
the logic in the route handler.
**Use when** — nothing exceeds ~2 seconds. The correct default.
**Don't use when** — anything blocks a user-facing response.

### pg-boss (rung 1)
**Bun:** full · **Docs:** https://github.com/timgit/pg-boss
**Teaches:** queues, retries, at-least-once-delivery, earn-the-infrastructure
A job queue that lives in the Postgres you already run. Scheduling, retries, dead-letter, cron.
**Use when** — the first task outlives a request: email, PDF, LLM call, third-party API, imports.
**Don't use when** — very high throughput, or you need fine-grained concurrency and priorities.
**Pairs with:** Postgres, Drizzle · **Adopt:** ~2h · **Remove later:** ~a day
**Gotcha:** **jobs run at-least-once.** Make handlers idempotent — a retried "charge card" job must
not charge twice. This applies to every rung, and it is the concept this layer exists to teach.

### BullMQ (rung 2)
**Bun:** full · **Docs:** https://docs.bullmq.io
**Teaches:** concurrency-control, backpressure, priorities, rate-limiting
Redis-backed queue with concurrency limits, priorities, repeatable jobs, flows and a real dashboard.
**Use when** — you need priorities, rate limiting, or roughly a thousand jobs a minute and up.
**Don't use when** — you do not already run Redis and pg-boss would do. That is a whole service to
operate for features you may not need.
**Pairs with:** Redis · **Adopt:** ~4h · **Remove later:** ~2 days

### Inngest · Trigger.dev (rung 3)
**Docs:** https://inngest.com/docs · https://trigger.dev/docs
**Teaches:** durable-execution, step-functions, observability
Managed durable workflows: define steps, get retries, concurrency, and a UI without operating
anything.
**Use when** — you want durable multi-step workflows and would rather pay than run infrastructure ·
serverless hosting where a long-lived worker is awkward.
**Don't use when** — data residency rules it out, or the volume makes it expensive.
**Adopt:** ~2h · **Remove later:** ~3 days

### Temporal (rung 4)
**Docs:** https://docs.temporal.io
**Teaches:** durable-execution, sagas, compensation, exactly-once-semantics
Workflow engine where execution state survives crashes and resumes exactly where it stopped.
**Use when** — a multi-step process genuinely must survive a crash mid-flight: payment
orchestration, multi-day onboarding, saga patterns with compensation.
**Don't use when** — you have not first hand-written retry and compensation logic and watched it
become the buggiest file in the repo. That experience is what makes Temporal make sense.
**Adopt:** days · **Remove later:** weeks — workflows are written against its API

### Cron / scheduled work
**Docs:** https://github.com/kelektiv/node-cron · **Teaches:** scheduling, idempotency, drift
**Use when** — periodic work: digests, cleanup, syncs.
**Options:** pg-boss and BullMQ both schedule · a platform scheduler (Vercel Cron, Cloudflare Cron
Triggers, GitHub Actions on a schedule) · system cron on a VPS.
**Gotcha:** two instances means two runs. Use a database lock or a scheduler with leader election.
Also: a job that runs every minute and takes 90 seconds will overlap itself.
**Don't use when** — the work is event-driven. A poll every minute is a worse queue.
