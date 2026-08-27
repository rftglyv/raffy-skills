# Layer: Observability

**Rung 1 is mandatory, not earned.** You cannot supervise what you cannot see, and an AI-built app
fails in ways nobody anticipated by definition. This is the layer that turns "it's broken" into a
stack trace with a user id attached.

The minimum, on day one: **structured logs, error tracking, and an uptime check.** All three are
free or nearly free.

### Structured logging (Pino · `console` + JSON)
**Bun:** full · **Docs:** https://getpino.io · **Teaches:** structured-logging, log-levels, correlation-ids
JSON logs, not string concatenation — so they can be filtered and searched later.
**Use when** — always. **Adopt:** ~1h
**Gotcha:** attach a **request id** to every log line and return it to the client on errors. "Error
ref 8f3a" turns an unreproducible bug report into a single query. And **never log secrets, tokens,
passwords or full request bodies** — this is a leak that looks like diligence.

### Sentry
**Bun:** full · **Docs:** https://docs.sentry.io · **Teaches:** error-tracking, source-maps, release-health
Exceptions with stack traces, breadcrumbs, release tracking, and session replay.
**Use when** — day one, every project. The free tier covers a small product entirely.
**Don't use when** — nothing. This is the highest value-per-minute integration in the stack.
**Adopt:** ~30min · **Remove later:** minutes
**Gotcha:** upload source maps or your production stack traces are unreadable minified noise.

### Uptime monitoring — BetterStack · UptimeRobot · Cron-based
**Docs:** https://betterstack.com/docs · **Teaches:** health-checks, alerting, slo
**Use when** — anything with users. Expose a `/health` endpoint that actually checks the database,
not one that returns `200` unconditionally.

### OpenTelemetry
**Bun:** full · **Docs:** https://opentelemetry.io/docs · **Teaches:** tracing, spans, context-propagation
Vendor-neutral traces, metrics and logs. One instrumentation, any backend.
**Use when** — more than one service, or a latency problem you cannot locate from logs alone.
**Don't use when** — a single small app where Sentry already answers the question.
**Adopt:** ~a day · **Remove later:** ~a day — the point of the standard is that backends swap
**Gotcha:** it is the right APM path on bun, where Node-internal agents do not work reliably.

### Grafana + Tempo + Loki + Prometheus
**Docs:** https://grafana.com/docs · **Teaches:** dashboards, metrics, retention, promql
The self-hosted stack: metrics, traces and logs with dashboards you own.
**Use when** — you run your own infrastructure and need retention and dashboards without per-seat
pricing.
**Don't use when** — a solo builder. That is four services to operate; use a hosted backend.

### Hosted backends — Axiom · Datadog · Honeycomb · BetterStack
**Docs:** https://axiom.co/docs · **Use when** — you want OTel data queryable without running the
storage. **Don't use when** — the volume-based bill outgrows the value; watch this one.

### Product analytics — PostHog · Plausible · Umami
**Docs:** https://posthog.com/docs · **Teaches:** funnels, retention, feature-flags, session-replay
**Use when** — you need to know what users actually do, not just what errored. PostHog also brings
feature flags and A/B tests, which is often the real reason to adopt it.
**Don't use when** — a marketing site; Plausible or Umami are lighter and privacy-friendly.
**Gotcha:** decide what you will do with each event before you instrument it. Analytics nobody reads
is a privacy liability with no upside.
