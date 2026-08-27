# The knowledge base — four tiers of grounding

The agent answers from four sources, **in this order, and it says which one it used.**

| # | Tier | What it is | Trust |
|---|---|---|---|
| 1 | **Curated** | The `knowledge/` cards shipped with this plugin. Written, reviewed, versioned in git. | high |
| 2 | **Learned** | Entries the skill wrote after researching a question this user asked. | medium — carries source + date |
| 3 | **Live web** | Fetched now, because tiers 1 and 2 were empty or stale. | verify before use |
| 4 | **Model memory** | What the model already knows. | **last resort, and say so** |

The order is the whole design. **Model memory is the fallback, not the default** — it is the tier
with no source URL, no date, and no way to check. Anything version-specific answered from tier 4
should be treated as a guess and verified.

Tier 3 feeds tier 2: when the skill researches something, it writes the answer back into the local
store with provenance, so the second person to ask gets it instantly and the corpus compounds.

## Where it lives

```
~/.claude/raffy/kb/          user scope — shared across every project
  kb.sqlite                  the store: chunks, FTS index, optional embeddings
  sources.jsonl              provenance log, append-only
<project>/.raffy/kb/         project scope — decisions and findings specific to this repo
```

User scope is the durable corpus. Project scope holds things that are only true here — the stack
chosen and why, overrides the user made, gotchas hit in this codebase.

## Storage: SQLite, no server, no extension

One file, opened with `bun:sqlite`, which is built into the runtime — **no native compile, no
Docker, no API key, works offline.**

- **Lexical:** SQLite FTS5, built in. Excellent on technical text where the query shares vocabulary
  with the corpus, which is most of the time here.
- **Semantic:** an optional `embedding` BLOB per chunk, scored by brute-force cosine in JS. At a
  few tens of thousands of chunks this is single-digit milliseconds — an index would be premature.
- **Hybrid:** both, merged by reciprocal rank fusion. This beats either alone, which is the same
  advice `knowledge/search.md` gives; the KB follows its own guidance.

**Being straight about the design:** for the ~19 shipped cards, FTS5 alone is enough and a vector
store would be over-built. Vectors earn their place as tier 2 grows — hundreds of researched
entries whose wording will not match the user's question. The upgrade path, if the corpus ever
outgrows brute force, is `sqlite-vec` in the same file or LanceDB alongside it. Neither is needed
now, and adding them now would be exactly the over-building this skill exists to prevent.

## Embeddings

Optional and local. A small sentence-transformer through transformers.js runs in-process with no
key and no network after first download. **The same model must produce the shipped vectors and the
user's own**, or the two are not comparable — so the model id is pinned in the store's metadata and
a mismatch triggers a reindex rather than silently returning nonsense.

Without embeddings, everything still works on FTS5. This is a graceful degradation, not a
half-feature.

## Provenance — the rule that keeps this from rotting

**Every tier-2 entry carries `source_url`, `fetched_at`, `confidence`, and the question that
produced it.** An entry without a source does not get written. This is `qa-audit`'s
grounded-or-dropped rule applied to memory, and it is what separates a knowledge base from a
hallucination cache.

Freshness matters as much as source. Version-specific entries go stale fast:

- Under 90 days → use it.
- 90–365 days → use it, say it is old, re-verify if the answer is version-specific.
- Over a year → treat as a lead, not an answer. Re-research and overwrite.

Curated tier-1 cards do not expire on a clock; they expire when the repo updates them.

## The retrieval protocol

1. **Search tiers 1 and 2 together.** Hybrid query, top ~8 chunks.
2. **Is the answer there and fresh?** Use it. Cite the card or the source URL.
3. **Not there, or stale?** Research: the tool's own docs first, then release notes and changelogs,
   then GitHub issues for the specific breakage, then forums and community answers for the
   experience report. **Prefer primary sources.** A vendor blog is not documentation.
4. **Write it back** as a tier-2 entry with full provenance.
5. **Say which tier answered.** "From the curated card", "researched just now, source X", or "this
   is from model memory and unverified — want me to check?"

## When to research proactively

Not on every question — that is slow and mostly wasted. Research when:

- The question is **version-specific** ("does X work with Y at version Z").
- A card's `Gotcha` refers to a **bug that may since be fixed**.
- The user names a technology **not in the catalog at all**.
- Something **failed in practice** that the KB said would work — that contradiction is the most
  valuable thing that can happen, and it must be written back immediately.

## Updating

The cards live in git and ship with the plugin, so `claude plugin marketplace update` brings new
curated knowledge. A separate npm package carries the indexer and the prebuilt index so the store
can be refreshed without reinstalling the plugin:

```bash
bunx raffy-kb update     # pull new curated cards, reindex, keep learned entries
bunx raffy-kb search "does prisma work under bun"
bunx raffy-kb stats      # counts by tier, staleness histogram
```

**Learned entries are never destroyed by an update.** Curated content is replaced wholesale;
tier 2 is the user's, and a knowledge base that forgets what it learned is not one.
