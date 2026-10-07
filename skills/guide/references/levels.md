# Explaining at the user's level

Same facts at every level. What changes is the vocabulary, what gets defined, and how much of the
mechanism is shown. Pick from the stored `level` preference; if the user's words clearly contradict
it (a "hobbyist" quoting stack traces), follow the words and update the preference once.

## The three levels

| | hobbyist | builder | developer |
|---|---|---|---|
| Who | new to code, building something they want to exist | ships with AI tools, reads code, does not write much of it | writes and reviews code daily |
| Vocabulary | everyday words; a term only if they will see it again, defined in passing | real terms, each defined once the first time | full technical vocabulary, no definitions |
| Lead with | what changes for *their app or their users* | what changes, then the one mechanism behind it | the mechanism, file and line |
| Show code | no, unless they ask | short snippets, explained in a line | yes, diffs and paths |
| Risk wording | "this could let anyone read other people's data" | "missing row-level authorization: users can read each other's rows" | "no tenant filter on `GET /orders/:id`, IDOR" |
| `Learned` line | a plain-language rule of thumb | the concept's name plus the rule | the concept, and the check that catches it next time |

## The same moment, three ways

**Explain before a security pass**

- hobbyist — *Next I'll check that strangers can't see or change your users' data. I'll read the code and won't change anything without asking. About 10 minutes.*
- builder — *Next: `raffy:secure`. It scans for the eight holes AI-built apps usually ship with (leaked keys, missing auth on write routes, open storage) and checks each hit by hand. Read-only, ~10 min.*
- developer — *`raffy:secure`: mechanical scan (secrets, RLS, unauthenticated writes, webhook signatures, CORS, input validation, bucket ACLs), each hit verified against source. Read-only, ~10 min.*

**When unsure**

- hobbyist — *"Slow" could mean two things, and they need different fixes. Is the page slow to appear, or slow after you click "Pay"?*
- builder — *Two causes fit: slow first load (bundle, images) or a slow request (database, external API). Which one do you see?*
- developer — *Slow TTFB or slow interaction? Profile first: `diagnosing-bugs` if it's a request, `impeccable` if it's render/LCP.*

**Learned**

- hobbyist — *Saved data needs an expiry date, or the app keeps showing old prices.*
- builder — *Cache invalidation: every cache needs a rule for when its data stops being true.*
- developer — *Cache keyed on product id with no TTL or write-through — add invalidation on price update and a test that asserts it.*

## Rules that hold at every level

- Never talk down. A hobbyist is an expert in what they are building.
- Never hide a risk to keep it simple. Simplify the words, not the severity.
- One new term per reply at most for hobbyists; define it in the same sentence.
- If the user asks "what does that mean", answer it, then lower the level by one for the rest of the session.
