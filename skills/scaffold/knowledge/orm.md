# Layer: ORM / query layer

The real choice: **do you want to think in SQL or in objects?** SQL-first (Drizzle, Kysely) keeps
the database legible and the abstraction thin. Schema-first (Prisma) gives better migrations and a
gentler on-ramp at the cost of a layer between you and the query.

### Drizzle
**Bun:** full — pure JS driver, no engine binary · **Docs:** https://orm.drizzle.team
**Teaches:** sql-mental-model, migrations, type-inference, connection-pooling
TypeScript-first query builder where the schema is TS and the queries look like SQL.
**Use when** — you are on bun · edge or serverless runtimes · you want to see the SQL you are
running · bundle size matters.
**Don't use when** — the team wants a GUI-driven schema workflow and a fuller migration toolchain ·
nobody on the team knows SQL at all.
**Pairs with:** Postgres, bun, Hono, Elysia, Zod · **Conflicts with:** Prisma
**Adopt:** ~2h · **Remove later:** ~a day
**Gotcha:** `drizzle-kit` handles migrations. Generate and commit them; do not use push-to-prod.

### Prisma
**Bun:** partial — **broken under `bun --bun` with Next.js Turbopack** (prisma#28956, bun#25032)
**Docs:** https://prisma.io/docs · **Teaches:** schema-modeling, migrations, orm-abstraction, cost-to-remove
Schema-first ORM with a dedicated schema language, strong migrations, and a good studio GUI.
**Use when** — the team prefers a declarative schema file · migration ergonomics are the priority ·
someone new to databases needs the gentlest on-ramp.
**Don't use when** — running Next.js under bun's runtime · edge runtimes · you want to control the
exact SQL.
**Conflicts with:** Drizzle, `bun --bun` + Turbopack · **Adopt:** ~2h · **Remove later:** ~a week
**Gotcha:** the query engine binary is what makes it awkward in constrained runtimes. That is the
whole compatibility story in one sentence.

### Kysely
**Bun:** full · **Docs:** https://kysely.dev · **Teaches:** sql-mental-model, type-safety
A type-safe SQL query builder and nothing more. No schema layer, no migrations opinion.
**Use when** — you know SQL well and want types without an ORM · an existing database you do not
control.
**Don't use when** — you want migrations and schema management included.

### Raw SQL (`bun:sqlite`, `postgres.js`)
**Bun:** full · **Docs:** https://github.com/porsager/postgres
**Teaches:** sql, parameterized-queries, injection
**Use when** — small scripts, CLI tools, a service with a handful of queries · you want zero
abstraction.
**Don't use when** — a schema that will evolve. You will hand-roll migrations badly.
**Gotcha:** **always parameterize.** String-interpolated SQL is the oldest vulnerability there is
and AI-generated code still produces it.

### SQLAlchemy + Alembic
**Bun:** n/a (Python) · **Docs:** https://docs.sqlalchemy.org
**Teaches:** orm-patterns, migrations, unit-of-work
The Python answer. Use it in a FastAPI service; Alembic handles migrations.
**Don't use when** — the service is TypeScript. This is the Python answer only.

### Mongoose
**Bun:** partial · **Docs:** https://mongoosejs.com · **Teaches:** document-modeling, schemas
ODM for MongoDB.
**Use when** — you have already decided on MongoDB for a real reason.
**Don't use when** — you chose MongoDB because it seemed easier than SQL. That is the wrong reason,
and relational data in a document store gets expensive fast.
