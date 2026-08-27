# Growth ladders — earn the infrastructure

The most common failure in AI-composed architecture is not under-building. It is a queue, a broker
and a cache in an app with forty users, because the model pattern-matched to what serious systems
look like.

**Rule: take the lowest rung that meets a constraint the user actually stated.** Then name the
signal that promotes you to the next rung. Speculative scale is a bug, and every unearned rung is
a thing the user must operate, monitor, pay for, and eventually debug at 2am.

The counter-rule matters just as much: **leave the seam.** Put long-running work behind a function
boundary on day one even with no queue. Moving `sendWelcomeEmail()` from inline to a job takes an
hour if it is already a function and a week if it is inlined across four route handlers.

---

## Background jobs

| Rung | Take it when | Cost |
|---|---|---|
| **0 · Inline, behind a function** | Nothing exceeds ~2s. Default. | free |
| **1 · pg-boss** | Anything outlives a request: email, PDF, LLM call, third-party API. | no new infra — it lives in the Postgres you already run |
| **2 · BullMQ** | You need concurrency limits, priorities, rate limiting, a real dashboard, or >~1k jobs/min. | +Redis |
| **3 · Inngest / Trigger.dev** | You want retries, steps, and observability without operating any of it, and you accept a vendor. | managed |
| **4 · Temporal** | A multi-step process must survive a crash mid-flight and resume exactly where it stopped. Payment flows, multi-day onboarding, saga patterns. | a real operational commitment |

**Promotion signals:** 0→1 the first task over ~2s · 1→2 job volume or you need priorities ·
2→4 you have written retry and compensation logic by hand and it is now the buggiest file.

---

## Messaging & streaming

Do not confuse this with jobs. Jobs are *you calling yourself later*. Messaging is *services
talking to each other*. One service never needs a broker.

| Rung | Take it when |
|---|---|
| **0 · Direct HTTP calls** | Two or three services, synchronous is fine. Default. |
| **1 · Postgres LISTEN/NOTIFY** | You need loose coupling inside one database. Free. |
| **2 · NATS + JetStream** | Three or more services must communicate asynchronously; you want a single lightweight binary. |
| **3 · Redpanda / Kafka** | You need an immutable replayable event log, multiple independent consumer groups, or genuinely high throughput. |
| **4 · RabbitMQ** | You need complex routing topologies, per-message TTL, and delivery guarantees over throughput. |

**Most products never leave rung 0.** Kafka is a log, not a queue — reaching for it to send an
email is the single clearest sign of over-building.

---

## Caching

| Rung | Take it when |
|---|---|
| **0 · None** | Under ~1k concurrent users with indexed queries. Default. |
| **1 · Framework cache** | Next.js `unstable_cache` / route segment config. Free. |
| **2 · Redis** | Sessions, rate limiting, or a hot query you can measure. |
| **3 · CDN edge cache** | Global audience and cacheable responses. |

**Do not add Redis before you have a slow query with a number attached.** "It'll be faster" is not
a constraint.

---

## Search

| Rung | Take it when |
|---|---|
| **0 · `LIKE` / `ILIKE`** | Under ~10k rows, exact-ish matching. Default. |
| **1 · Postgres full-text** | Ranking, stemming, multiple languages. Still no new infra. |
| **2 · pgvector** | Semantic or similarity search, RAG. Still Postgres. |
| **3 · Meilisearch / Typesense** | Typo tolerance, faceting, instant-search UX. One container. |
| **4 · Elasticsearch / OpenSearch** | Complex aggregations and analytics over search. Heavy. |

Rungs 0–2 need no new service at all. Most teams jump to 3 without trying 1.

---

## Observability

This is the one ladder where rung 1 is mandatory, not earned. You cannot supervise what you cannot
see, and an AI-built app fails in ways you did not anticipate by definition.

| Rung | Take it when |
|---|---|
| **1 · Structured logs + Sentry** | Day one. Always. |
| **2 · Uptime check** | Anything with users. |
| **3 · OpenTelemetry traces** | More than one service, or a latency problem you cannot locate. |
| **4 · Grafana / Tempo / Loki** | You are running your own infra and need retention and dashboards. |

---

## Database

| Rung | Take it when |
|---|---|
| **0 · SQLite (`bun:sqlite`)** | Local-first, single-node, CLI tools, prototypes. |
| **1 · Postgres, one instance** | Almost everything. Scales to ~100k users untouched. Default. |
| **2 · + read replicas** | Read-heavy load you have measured. |
| **3 · + specialized stores** | ClickHouse for analytics, Scylla for extreme write throughput, a vector DB when pgvector genuinely stops. |

**Postgres is the answer at rung 1 for the overwhelming majority of products**, and the reason it
is the right default is that rung 1 → rung 3 is *additive*. You never throw it away.
