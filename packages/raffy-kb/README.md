# raffy-kb

The local knowledge base behind [`raffy`](https://github.com/rftglyv/raffy-skills), a Claude Code
plugin. One SQLite file, no server, no API key, works offline.

```bash
bunx raffy-kb update              # pull the shipped cards and reindex
bunx raffy-kb search "does prisma work under bun"
bunx raffy-kb stats
bunx raffy-kb add --title "..." --body "..." --source https://...
```

## What is in it

**Tier 1, curated** — the stack knowledge cards shipped with the plugin: ~144 entries across 19
layers, each with when to use a technology, when *not* to, what it conflicts with, and how
expensive it is to remove later.

**Tier 2, learned** — what your agent researched and wrote back, with a source URL, a fetch date
and a confidence. An entry without a source is refused: that rule is what separates a knowledge
base from a hallucination cache.

Search is FTS5 for lexical plus optional embeddings for semantic, fused by reciprocal rank fusion.

**`update` never destroys learned entries.** Curated content is replaced wholesale; tier 2 is
yours.

## Statusline

```json
{ "statusLine": { "type": "command", "command": "node <path>/statusline.mjs" } }
```

Prints `kb · 12 learned · 2 stale · indexed 3d ago`, and prints nothing when there is no store.

Requires [bun](https://bun.sh) for `bun:sqlite`.
