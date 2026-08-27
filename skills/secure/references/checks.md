# The eight checks

Grouped by what an attacker gets. Each carries the greps worth running and the thing you must read
with your own eyes, because the dangerous version of each is the one no pattern catches.

---

## 1 · Exposed secrets

**Worst case:** full compromise of a third-party account, and a bill you did not authorize.

```bash
git ls-files | grep -E '^\.env' ; git log --all --oneline -- .env .env.local 2>/dev/null | head
grep -rnE '(sk_live|sk_test|rk_live|AKIA|ghp_|gho_|xoxb-|AIza|eyJhbGciOi)' --include='*.{ts,tsx,js,jsx,json,env,yml,yaml}' .
grep -rn 'NEXT_PUBLIC_\|VITE_\|EXPO_PUBLIC_' --include='*.{ts,tsx,js,jsx}' . | grep -iE 'secret|private|service_role|api_key|token'
```

**Read for yourself:** anything prefixed `NEXT_PUBLIC_`, `VITE_` or `EXPO_PUBLIC_` **ships to the
browser**. A service-role key behind one of those prefixes is a full database compromise, and it is
one of the most common single mistakes in AI-built apps.

Then search the built output, not just the source:

```bash
bun run build && grep -rE '(sk_live|service_role|SUPABASE_SERVICE)' .next/ dist/ build/ 2>/dev/null | head
```

**A committed key is a leaked key.** Deleting the line does not help — it is in the history and in
every clone. It must be rotated.

## 2 · Missing row-level authorization

**Worst case:** any user reads or edits every other user's data. The single most common critical
hole, and it is silent — the app looks like it works.

```bash
grep -rnE '\.(findMany|findFirst|findUnique|select\(|from\()' --include='*.ts' . | head -50
grep -rn 'params.id\|params\.\w*Id\|searchParams' --include='*.ts' --include='*.tsx' . | head -30
```

**Read for yourself:** for every query touching user-owned data, is there a `where` clause tying it
to the **session** user — not to an id from the URL? The bug looks like this:

```ts
// the id comes from the request, so any id works
const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, params.id) })
```

The fix is a second condition on the session user. Check the mutation paths especially — people
remember to filter reads and forget updates and deletes.

**On Supabase:** RLS is the entire model and it is **off until enabled**.

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
```

Any `false` on a table holding user data is a P0. A table with RLS on but no policy is also a
finding — behaviour differs from what people assume.

## 3 · Unauthenticated write routes

**Worst case:** anyone deletes or modifies anything.

```bash
grep -rn 'export async function \(POST\|PUT\|PATCH\|DELETE\)' --include='*.ts' .
grep -rn "'use server'" --include='*.ts' --include='*.tsx' .
```

**Read for yourself:** open every one. Is there a session check *before* the mutation? Server
Actions are the common miss — they look like local functions but they are public HTTP endpoints,
and an agent that generated one rarely adds the check.

Admin routes deserve a second look: an authenticated *user* is not an authenticated *admin*.

## 4 · Client-side authorization

**Worst case:** a hidden button is not a permission.

```bash
grep -rnE 'role\s*===|isAdmin|user\.role|hasPermission' --include='*.tsx' --include='*.jsx' .
```

Any role logic in a component is a UI affordance only. Confirm the same check exists server-side.
If it does not, the feature is open to anyone who calls the endpoint directly.

## 5 · Unverified webhooks

**Worst case:** anyone marks an invoice paid, or grants themselves a subscription.

```bash
grep -rn 'webhook' --include='*.ts' -l . | head
grep -rn 'constructEvent\|verifyHeader\|svix\|signature' --include='*.ts' .
```

**Read for yourself, three things:**
1. **Signature verified** against the raw body — not the parsed JSON. Frameworks that auto-parse
   break this silently.
2. **Idempotency.** The event id is stored, and a repeat is ignored. Providers retry; a retried
   "grant subscription" must not grant two.
3. **The database is the source of truth**, not the browser's return from a checkout redirect.

## 6 · Unvalidated input

**Worst case:** injection, mass assignment, or a crash on malformed data.

```bash
grep -rn 'await req.json()\|request.json()\|req.body' --include='*.ts' .
grep -rnE '\$\{[^}]*\}' --include='*.ts' . | grep -iE 'select |insert |update |delete |where '
```

**Read for yourself:** every parsed body should hit a schema (`schema.parse(body)`) before it
reaches a query. Spreading a request body into an ORM update is mass assignment — a user sets
`role: "admin"` on themselves.

String-interpolated SQL is the oldest vulnerability there is and generated code still produces it.
Parameterize, always.

## 7 · Open CORS and missing rate limits

**Worst case:** credential stuffing, and an LLM bill someone else writes.

```bash
grep -rn "Access-Control-Allow-Origin\|cors(" --include='*.ts' .
grep -rn 'rateLimit\|ratelimit\|@upstash/ratelimit' --include='*.ts' .
```

`*` with credentials is a finding. Then check that **login, password reset, signup, and any
LLM-calling endpoint** are rate limited. An unmetered AI endpoint is a financial vulnerability even
when no data is at risk.

## 8 · Public storage

**Worst case:** every user upload is public, which is a breach with no attacker required.

```bash
grep -rn 'PutObject\|createPresignedUrl\|getSignedUrl\|upload(' --include='*.ts' .
grep -rn 'public: true\|ACL.*public' --include='*.ts' --include='*.tf' .
```

**Read for yourself:** bucket ACL and policy. Then the upload handler — is the filename **generated
server-side**, or taken from the user? A user-supplied path is directory traversal. Is there a size
limit and a content-type check? Both server-side.

---

## Always-worth-thirty-seconds

```bash
grep -rn 'dangerouslySetInnerHTML\|v-html\|innerHTML' --include='*.tsx' --include='*.vue' .
grep -rn "jwt.decode\|algorithms.*none\|verify: false\|rejectUnauthorized: false" --include='*.ts' .
bun audit 2>/dev/null || npm audit --production 2>/dev/null | tail -20
```

Security headers on the responses (CSP, HSTS, `X-Content-Type-Options`), session cookies
`httpOnly` + `secure` + `sameSite`, and tokens stored in cookies rather than `localStorage`.

## What is *not* a finding

Say these out loud in the clean section rather than reporting them:

- A publishable key in the client. Stripe publishable keys and Supabase anon keys are **designed**
  to be public — the anon key is only safe when RLS is on, so check that instead.
- A dependency CVE in a code path the app never calls.
- A missing security header on a purely static page.
- `.env.example` with placeholder values. That is correct practice.
