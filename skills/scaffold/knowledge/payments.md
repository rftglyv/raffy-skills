# Layer: Payments

**Three things AI-generated payment code gets wrong by default**, and all three are checked before
this layer ships:

1. **Webhook signature verification.** Unverified webhooks let anyone mark an invoice paid.
2. **Idempotency.** Webhooks are delivered more than once. Store the event id, ignore duplicates.
   A retried "grant subscription" must not grant two.
3. **The database, not the client, is the source of truth.** Never unlock a feature because the
   browser returned from a checkout redirect. Unlock it when the webhook lands.

Also: prices belong on the server. A client-supplied amount is a free-shopping vulnerability.

### Stripe
**Bun:** full · **Docs:** https://docs.stripe.com · **Teaches:** webhooks, webhook-idempotency, subscriptions, pci-scope
The default. Checkout, subscriptions, invoicing, marketplaces, the best test mode and docs.
**Use when** — almost always, if Stripe supports your country and you are willing to handle sales
tax and VAT yourself or via Stripe Tax.
**Don't use when** — you want a merchant of record to own global tax and compliance for you.
**Adopt:** ~a day for subscriptions · **Remove later:** ~a week
**Gotcha:** use Checkout or Elements. Card details must never touch your server — that is what keeps
you out of PCI scope.

### Polar
**Docs:** https://docs.polar.sh · **Teaches:** merchant-of-record, digital-goods
Merchant of record built for developers selling software and digital products; handles global tax.
**Use when** — selling SaaS or digital goods internationally and you do not want to manage VAT.
**Don't use when** — you need marketplace payouts or complex custom flows.

### Lemon Squeezy · Paddle
**Docs:** https://docs.lemonsqueezy.com · https://developer.paddle.com
**Teaches:** merchant-of-record, tax-compliance
Merchant of record: they sell to the customer, you sell to them, they own the tax problem.
**Use when** — global digital sales and tax compliance is the thing you want to avoid. Paddle suits
larger B2B SaaS; Lemon Squeezy suits indie and small products.
**Don't use when** — physical goods, or you need fine-grained control over the payment flow.
**Gotcha:** higher percentage than Stripe. That difference is the price of not doing tax.

### Regional and alternative rails
**Guidance — not an option to choose between.**
**Teaches:** local-payment-methods
Some markets need a local processor — iyzico or PayTR in Turkey, Razorpay in India, Mercado Pago in
Latin America, Adyen for enterprise multi-region, and Coinbase Commerce for crypto. **Ask where the
customers are before assuming Stripe.** Fetch that provider's docs; the three rules above still
apply unchanged.
