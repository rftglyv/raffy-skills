# Layer: Database

**The default is Postgres, and the reason is that you never have to leave it.** It does relational,
JSON, full-text search, vectors (pgvector), geospatial, and queues (pg-boss) — each well enough
that you add a specialized store only when you have measured a real limit. Growing means *adding*,
never *replacing*. See `../references/growth-ladders.md`.

### Postgres
**Bun:** full · **Docs:** https://postgresql.org/docs
**Teaches:** relational-modeling, indexes, transactions, migrations, row-level-security
**Use when** — almost always. Scales from prototype to ~100k users on one instance.
**Don't use when** — a single-node embedded database is genuinely enough (CLI tool, desktop app).
**Pairs with:** Drizzle, Prisma, pg-boss, pgvector · **Adopt:** ~1h · **Remove later:** weeks
**Gotcha:** the two things AI-generated schemas skip are **indexes on foreign keys** and
**transactions around multi-step writes**. Check both before shipping.

### SQLite / `bun:sqlite` / Turso
**Bun:** full — built into the runtime, no native compile
**Docs:** https://bun.sh/docs/api/sqlite · https://turso.tech
**Teaches:** embedded-databases, local-first, write-concurrency
**Use when** — CLI tools, desktop apps, local-first products, prototypes, read-heavy single-node
services. Turso adds replication and edge distribution on top.
**Don't use when** — many concurrent writers, or you need Postgres features you will miss.
**Adopt:** minutes · **Remove later:** a day (to Postgres — plan the schema so it ports)

### MySQL / MariaDB
**Docs:** https://dev.mysql.com/doc · **Teaches:** relational-modeling
**Use when** — an existing system, a host that only offers it, or a team standard.
**Don't use when** — free choice. Postgres has the better feature set for new work.

### Redis / Valkey
**Bun:** full · **Docs:** https://redis.io/docs · **Teaches:** caching, ttl, rate-limiting, pub-sub
In-memory store for cache, sessions, rate limits, queues and pub/sub.
**Use when** — you have a measured slow query, need rate limiting, or BullMQ requires it.
**Don't use when** — no measurement exists. "It'll be faster" is not a constraint, and Redis is the
most commonly over-added service in AI-composed stacks.
**Adopt:** ~1h · **Remove later:** hours *if* you kept it as a cache and not a source of truth
**Gotcha:** never let it become the only copy of anything. It is not durable by default.

### MongoDB
**Docs:** https://mongodb.com/docs · **Teaches:** document-modeling, denormalization
**Use when** — genuinely schema-less documents, or an existing system.
**Don't use when** — your data has relationships, which it almost certainly does. Choosing it to
avoid learning SQL costs far more later.

### ClickHouse
**Docs:** https://clickhouse.com/docs · **Teaches:** columnar-storage, olap, analytics
Columnar OLAP database for analytics over very large event volumes.
**Use when** — analytical queries over tens of millions of rows are slow in Postgres, measured.
**Don't use when** — you have a dashboard with a few thousand rows. Postgres with an index is fine.

### pgvector
**Docs:** https://github.com/pgvector/pgvector · **Teaches:** embeddings, similarity-search, rag
Vector similarity search inside Postgres.
**Use when** — semantic search or RAG, and you already run Postgres. This is nearly always the
right first vector store.
**Don't use when** — billions of vectors with strict latency targets — then a dedicated vector DB.

### Cassandra / ScyllaDB
**Docs:** https://scylladb.com/docs · **Teaches:** wide-column, partition-keys, eventual-consistency
**Use when** — extreme write throughput with a known access pattern, at real scale.
**Don't use when** — you have not hit Postgres's write ceiling. Query flexibility is gone forever
once you model around partition keys.

### Managed Postgres — Neon · Supabase · PlanetScale · RDS
**Docs:** https://neon.tech · https://supabase.com/docs
**Teaches:** connection-pooling, serverless-databases, managed-tradeoffs
**Use when** — you do not want to operate a database, which for a solo builder is the right call.
Neon for branching and scale-to-zero; Supabase when you also want auth, storage and realtime.
**Don't use when** — data residency or cost at scale rules it out.
**Gotcha:** serverless functions exhaust connection pools. Use the pooled connection string —
this is the single most common production failure with managed Postgres.

### Cloudflare D1
**Docs:** https://developers.cloudflare.com/d1 · **Teaches:** edge-databases
SQLite at the edge, for Workers.
**Use when** — a Workers app with modest data needs. **Don't use when** — heavy writes or large
datasets.
