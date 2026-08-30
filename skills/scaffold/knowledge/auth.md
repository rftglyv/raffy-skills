# Layer: Auth & authorization

**Authentication is who you are. Authorization is what you may touch. AI-built apps get the first
right and the second wrong**, and the second is the one that leaks data. Roughly 1 in 10 scanned
vibe-coded apps has an exploitable authorization hole.

## The non-negotiable checklist

Whatever you pick, verify all six before shipping:

1. **Every query filters by the current user or tenant**, server-side. Not in the component.
2. **Role checks happen on the server.** A hidden button is not access control.
3. **Session tokens are httpOnly cookies**, not `localStorage`.
4. **Service-role and admin keys never reach the client bundle.** Grep the build output.
5. **Auth is checked on write and delete routes**, not only on read.
6. **Password reset and email-change flows expire and are single-use.**

### Better Auth
**Bun:** full · **Docs:** https://better-auth.com · **Teaches:** sessions, oauth, rbac, multi-tenancy, row-level-authorization
Self-hosted TypeScript auth that owns its tables in your database, with plugins for organizations,
2FA, passkeys and magic links.
**Use when** — the default for new TypeScript apps · you want auth data in your own database · you
need organizations or teams without paying per seat.
**Don't use when** — you need SAML and enterprise SSO on day one (see WorkOS).
**Pairs with:** Drizzle, Prisma, Postgres, Next.js, Hono · **Adopt:** ~2h · **Remove later:** days

### Auth.js (NextAuth)
**Bun:** partial · **Docs:** https://authjs.dev · **Teaches:** oauth, sessions, adapters
The long-standing Next.js answer, adapter-based, huge provider list.
**Use when** — an existing project already uses it · you want the most tutorials and StackOverflow
answers.
**Don't use when** — greenfield with complex authorization needs. Better Auth handles organizations
and roles far more directly.
**Gotcha:** it gives you a session, not authorization. The row-level checks are still yours.

### Clerk
**Bun:** full · **Docs:** https://clerk.com/docs · **Teaches:** managed-auth, jwt, webhooks
Managed auth with prebuilt UI, organizations and user management.
**Use when** — you want auth solved in an hour and priced per user · a non-engineer needs a user
admin panel.
**Don't use when** — cost at scale matters, or user data must stay in your database.
**Adopt:** ~1h · **Remove later:** ~a week — user records live elsewhere
**Gotcha:** sync users into your own table via webhook from day one. Foreign keys to a remote user
id you do not store will hurt.

### Supabase Auth
**Docs:** https://supabase.com/docs/guides/auth · **Teaches:** rls, jwt, postgres-policies, row-level-authorization
**Use when** — you are already on Supabase.
**Don't use when** — you are not. Adopting Supabase for auth alone brings the whole platform.
**Gotcha:** **RLS is the whole security model, and it is off until you turn it on.** Every table
needs a policy. This is the single most common critical hole in vibe-coded apps, and the failure is
silent — it looks like it works.

### WorkOS
**Docs:** https://workos.com/docs · **Use when** — enterprise customers require SAML, SCIM or
directory sync. **Don't use when** — B2C or early-stage B2B.

### Keycloak / Ory / Zitadel
**Docs:** https://keycloak.org/documentation · **Teaches:** oidc, identity-providers
**Use when** — self-hosted enterprise identity, or compliance requires on-prem.
**Don't use when** — a small team. The operational cost is substantial.

### Hand-rolled JWT
**Guidance — not an option to choose between.**
**Don't.** It is the most common source of authentication vulnerabilities in AI-generated code:
unverified signatures, `alg: none`, no expiry, secrets in the repo, no revocation path. If a
requirement seems to demand it, re-read the requirement.
