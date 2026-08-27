# Knowledge card schema

## The governing principle: judgment here, docs on the web

These cards do **not** document how to use a technology. Documentation rots, and embedding it
burns context on things the agent could fetch fresh. What cannot be fetched — and what an agent
reliably gets wrong — is *whether this is the right tool for this user's app*.

**So each card carries the judgment and a pointer. The agent fetches the real docs at the moment
it commits to a choice, not before.**

```
Card answers:  should I use this, for THIS app, given THIS constraint?
Web answers:   how do I actually wire it up, at today's version?
```

This means: read the cards to choose. Then `WebFetch` the `Docs:` URL — or use the tool's own MCP
server or skill where one exists — before writing a line of implementation. Never implement from
memory of an API. Versions move; your training data does not.

## The shape

```markdown
### <name>
**Bun:** full | partial | none — <reason if not full>
**Docs:** <canonical URL — fetch this before implementing>
**Teaches:** <concept slugs, for the learning ledger>

<One sentence: what it actually is.>

**Use when** — 2–5 real conditions
**Don't use when** — 2–5 real conditions
**Pairs with:** … · **Conflicts with:** …
**Adopt:** ~<time> · **Remove later:** ~<time>
**Gotcha:** <the specific thing that bites, with an issue number if there is one>
```

## Why each field exists

- **Use when / Don't use when** — the judgment. A card with only benefits is marketing.
  `Don't use when` is the field that turns the user into a reviewer.
- **Docs** — the escape hatch from stale knowledge. Every card has one.
- **Bun** — `bun-policy.md` needs a per-component answer, not a vibe.
- **Adopt / Remove later** — the asymmetry *is* the decision, and nobody writes it down.
  Two hours in, a week out, is a different tool than two hours in, two hours out.
- **Conflicts with** — the Phase 2 compatibility check reads this. It is how a composition avoids
  shipping a stack that does not boot.
- **Teaches** — feeds `.raffy/progress.md`, so a drill can later be built from the user's own code.

## Rules for writing a card

1. **Conditions, not adjectives.** "Under ~10k rows" beats "for smaller projects."
2. **Every card has a `Don't use when`.** If you cannot name one, you do not know the tool well
   enough to recommend it.
3. **No API surface, no config blobs, no version numbers.** That is what `Docs:` is for.
4. **Time costs are orders of magnitude.** Hours, a day, a week. The ratio is the signal.
5. **Cards do not rank each other** except via `Conflicts with`. Ranking happens at composition
   time, against the interview.
6. **Absent is a valid card.** If a tool is genuinely niche, one line pointing at it beats silence
   — the agent can go read about it if the interview surfaces the need.
