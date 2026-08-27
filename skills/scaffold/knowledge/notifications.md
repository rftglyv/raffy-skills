# Layer: Email & notifications

Almost every app sends email — verification, password reset, receipts, digests. **Every one of
these is slow and can fail, so it belongs behind the job boundary** even at rung 0. Sending email
inline in a request handler is a latency bug and a reliability bug at once.

### Resend
**Bun:** full · **Docs:** https://resend.com/docs · **Teaches:** transactional-email, deliverability, dns
Developer-first transactional email, pairs with React Email for templates as components.
**Use when** — the default for new apps. Clean API, good DX, sensible free tier.
**Don't use when** — you need heavy marketing-campaign features.
**Adopt:** ~1h · **Remove later:** ~2h — swapping providers is a small surface
**Gotcha:** **deliverability is DNS, not code.** SPF, DKIM and DMARC on a real sending domain. Mail
from a domain you do not own goes to spam, and this is the thing people discover after launch.

### Postmark · SendGrid · SES
**Docs:** https://postmarkapp.com/developer · https://docs.aws.amazon.com/ses
**Use when** — Postmark for best-in-class transactional deliverability · SES when already on AWS
and cost matters at volume · SendGrid for mixed transactional and marketing.
**Don't use when** — Resend covers it and you want less configuration.

### React Email
**Docs:** https://react.email · **Teaches:** email-html, templating
Email templates as React components, with a preview server.
**Use when** — any React project sending styled email. Hand-writing table-based email HTML in 2026
is not a good use of anyone's time.

### Twilio (SMS) · WhatsApp Business
**Docs:** https://twilio.com/docs · **Teaches:** sms, delivery-receipts, e164
**Use when** — the audience is phone-first, or you need OTP where email is too slow.
**Don't use when** — email works. SMS is expensive, regulated, and needs opt-in handling.

### Web push · in-app notifications
**Docs:** https://developer.mozilla.org/docs/Web/API/Push_API
**Teaches:** service-workers, subscriptions, permissions
**Use when** — re-engagement matters and users opted in.
**Gotcha:** ask for permission *after* the user has done something meaningful, never on page load.

### Novu · Knock
**Docs:** https://docs.novu.co · **Teaches:** notification-orchestration, preferences, digests
Orchestration across email, SMS, push and in-app, with user preferences and digesting.
**Use when** — several channels and per-user preferences, and you are tired of writing that logic.
**Don't use when** — one channel. Direct provider calls are simpler.
