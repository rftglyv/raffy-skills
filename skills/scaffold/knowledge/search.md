# Layer: Search

**Start in Postgres.** Rungs 0 to 2 in `../references/growth-ladders.md` require no new service at
all, and most teams jump straight to rung 3 without trying rung 1.

### `LIKE` / `ILIKE` (rung 0)
**Docs:** n/a — it is a SQL operator.
**Teaches:** query-patterns, indexes
**Use when** — under ~10k rows, exact-ish matching, an admin filter box.
**Don't use when** — users expect ranking or typo tolerance.
**Gotcha:** leading-wildcard `%term%` cannot use a normal index. Add a trigram index (`pg_trgm`)
when it gets slow.

### Postgres full-text search (rung 1)
**Docs:** https://postgresql.org/docs/current/textsearch.html
**Teaches:** inverted-index, stemming, ranking, tsvector
Real search — stemming, ranking, multi-language — inside the database you already run.
**Use when** — you need ranked results and this is not the product's core feature.
**Don't use when** — typo tolerance and instant-search UX are the product.
**Adopt:** ~half a day · **Remove later:** hours
**Gotcha:** store the `tsvector` in a generated column with a GIN index. Computing it per query is
the slow way people conclude Postgres search "doesn't work".

### pgvector (rung 2)
**Docs:** https://github.com/pgvector/pgvector · **Teaches:** embeddings, cosine-similarity, rag, chunking
Semantic similarity search in Postgres.
**Use when** — semantic search or RAG. Nearly always the right first vector store.
**Don't use when** — hundreds of millions of vectors with strict latency targets.
**Gotcha:** hybrid search — full-text *and* vector, results merged — beats either alone for most
products. Reach for it before reaching for a dedicated vector database.

### Meilisearch · Typesense (rung 3)
**Docs:** https://meilisearch.com/docs · https://typesense.org/docs
**Teaches:** search-engines, faceting, typo-tolerance, relevance-tuning
One container, typo tolerance, faceting, sub-50ms instant-search.
**Use when** — search *is* the product surface: a catalogue, a directory, a large document set.
**Don't use when** — Postgres full-text is untried.
**Adopt:** ~a day · **Remove later:** ~2 days
**Gotcha:** you now have two sources of truth. The index must be kept in sync — do it from a job,
and make reindexing a command you can run.

### Elasticsearch / OpenSearch (rung 4)
**Docs:** https://opensearch.org/docs · **Teaches:** aggregations, sharding, analyzers
**Use when** — complex aggregations and analytics over search, or log search at volume.
**Don't use when** — anything smaller. Heavy to run and to tune.

### Algolia
**Docs:** https://algolia.com/doc · **Use when** — you want best-in-class hosted search UX and the
price works. **Don't use when** — high record counts; it gets expensive quickly.

### Dedicated vector DBs — Qdrant · Pinecone · Weaviate · LanceDB
**Docs:** https://qdrant.tech/documentation · https://lancedb.github.io/lancedb
**Teaches:** vector-indexes, hnsw, filtering, hybrid-search
**Use when** — pgvector has measurably stopped scaling, or you need advanced filtering and hybrid
retrieval at large volume. **LanceDB is embedded and file-based** — no server — which makes it the
right pick for local and desktop use.
**Don't use when** — under a few million vectors. pgvector is one fewer service to run.
