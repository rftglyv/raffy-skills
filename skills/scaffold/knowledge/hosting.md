# Layer: Hosting & deployment

**The real question is who operates this at 2am.** A solo non-engineer should be on a platform. A
team that knows Docker should weigh the cost difference seriously — it is often 10x.

Whatever you pick: **secrets in the platform's secret store, never in the repo**; a staging
environment separate from production; and a deploy you can roll back in one command.

### Docker + a VPS (Hetzner · DigitalOcean · OVH)
**Bun:** full · **Docs:** https://docs.docker.com · **Teaches:** containers, reverse-proxy, tls, systemd, backups, secret-exposure
**Use when** — cost matters · you want full portability with no vendor to migrate off · you run
services a PaaS cannot host well (databases, queues, ClickHouse).
**Don't use when** — nobody on the project wants to be responsible for an operating system.
**Pairs with:** GitHub Actions, Caddy or Traefik for automatic TLS
**Adopt:** ~a day · **Remove later:** ~a day
**Gotcha:** **test the restore, not the backup.** An untested backup is a hope. Also set up
automatic security updates on day one.

### Coolify · Dokploy
**Docs:** https://coolify.io/docs · **Teaches:** self-hosted-paas, git-deploys
A self-hosted PaaS on your own VPS: git push to deploy, TLS, databases, previews.
**Use when** — you want the platform experience at VPS prices and are willing to run one more thing.
**Don't use when** — you want zero operational responsibility.

### Vercel
**Bun:** partial — builds and runs on Node · **Docs:** https://vercel.com/docs
**Teaches:** serverless, edge-functions, preview-deploys, cold-starts
**Use when** — a Next.js app and you want the best possible deploy experience with zero operations.
Preview deploys per PR are genuinely excellent.
**Don't use when** — you need long-running processes, WebSockets, or heavy background work · the
bill at scale matters.
**Gotcha:** serverless plus a non-pooled database connection string exhausts the pool. Use the
pooled URL. This is the most common production failure on this platform.

### Cloudflare Workers / Pages
**Bun:** partial — the Workers runtime is neither Node nor bun
**Docs:** https://developers.cloudflare.com/workers
**Teaches:** edge-computing, isolates, runtime-constraints, kv
**Use when** — global low latency, near-zero cost at low traffic, static frontends · pairs
naturally with Hono. R2's free egress is a real advantage.
**Don't use when** — you need Node APIs, long-running processes, or persistent connections. Verify
every dependency runs there.

### Fly.io · Railway · Render
**Docs:** https://fly.io/docs · https://docs.railway.com
**Teaches:** container-hosting, regions, volumes
Run containers without running servers. Fly for multi-region and persistent volumes; Railway for
the smoothest developer experience; Render as the middle ground.
**Use when** — you want Docker's portability without operating a VPS.
**Don't use when** — cost at scale is the priority; a VPS is far cheaper.

### AWS · GCP · Azure
**Docs:** https://docs.aws.amazon.com · **Teaches:** iam, vpc, managed-services, cloud-cost
**Use when** — enterprise or compliance requirements, an existing commitment, or you genuinely need
a specific managed service.
**Don't use when** — a small team without cloud experience. The complexity is real and the bill is
easy to get wrong.

### CI/CD — GitHub Actions
**Docs:** https://docs.github.com/actions · **Teaches:** pipelines, caching, secrets, environments
**Use when** — always. On every PR: install, typecheck, test, build. On merge: deploy.
**Gotcha:** cache the bun install step. And **never echo a secret into logs** — including in a
debugging step you meant to remove.
**Don't use when** — your code is not on GitHub; use the host's native CI instead.
