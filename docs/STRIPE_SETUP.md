# Stripe integration

This portal syncs Stripe **Customers**, **Subscriptions**, **Invoices**, and **PaymentIntents** into Firestore via signed webhooks, exposes staff actions on **Proposals**, and lets end customers open the **Stripe Customer Billing Portal** on your own domain.

## 1. Stripe Dashboard

1. Create or open your [Stripe Dashboard](https://dashboard.stripe.com) account (test mode while integrating).
2. Under **Developers → API keys**, copy the **Secret key** (`sk_live_…` / `sk_test_…`).
3. Under **Developers → Webhooks → Add endpoint**, point to your deployed app:

   `https://<your-domain>/api/webhooks/stripe`

4. Select events (minimum set used by this codebase):

   - `customer.created`, `customer.updated`, `customer.deleted`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.created`, `invoice.updated`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`
   - `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`

5. After saving the endpoint, reveal the **Signing secret** (`whsec_…`).

## 2. Environment variables

Set these on your hosting provider (e.g. Vercel) or in `.env.local` for development:

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Server-side Stripe SDK — invoices, Checkout, Billing Portal |
| `STRIPE_WEBHOOK_SECRET` | Verifies `Stripe-Signature` on `/api/webhooks/stripe` |
| `STRIPE_DEFAULT_SUBSCRIPTION_PRICE_ID` | Optional `price_…` id for proposal “Checkout (subscription)” without prompting |
| `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` | Firebase Admin — required for Firestore writes |
| `NEXT_PUBLIC_APP_URL` | Optional fallback origin if reverse-proxy headers are missing |

Never expose secret keys to the browser; only `NEXT_PUBLIC_*` belongs in client bundles.

## 3. Firestore layout

Webhook handlers write to:

| Collection | Document id | Contents |
|------------|-------------|----------|
| `stripe_customers` | Stripe Customer id `cus_…` | Email, name, metadata mirror |
| `subscriptions` | Stripe Subscription id `sub_…` | Status, price, period end, optional `mrrAmount` |
| `invoices` | Stripe Invoice id `in_…` | Amount due, hosted/PDF URLs, status |
| `payments` | Stripe PaymentIntent id `pi_…` | Amount, status |
| `stripe_webhook_events` | Stripe Event id `evt_…` | Idempotency marker |

Rows include `customerId` (Stripe `cus_…`) and optional `organizationId` from Stripe metadata (`organization_id`).

### Linking CRM contacts

When a Stripe Customer includes an **email** that matches `customers/{id}.email` in Firestore, the sync attempts to set `stripeCustomerId` on those CRM rows so staff views stay aligned.

### Security rules

Webhook endpoints write with **Admin SDK** only. Client reads must go through rules that scope data by `organizationId` or the portal user’s `stripeCustomerId`. Tighten rules before production exposure.

## 4. Next.js routes

| Route | Role | Behavior |
|-------|------|----------|
| `POST /api/webhooks/stripe` | Stripe servers | Validates signature, applies `applyStripeWebhookEvent` |
| `POST /api/stripe/billing-portal` | Signed-in customer | Creates Billing Portal session; requires `users/{uid}.stripeCustomerId` |
| `POST /api/stripe/proposal-invoice` | Admin / team | Builds totals from proposal pricing + accepted packages; creates & finalizes a Stripe Invoice |
| `POST /api/stripe/proposal-checkout` | Admin / team | Creates Checkout Session — `mode: "payment"` uses computed totals; `mode: "subscription"` requires a `price_…` |

Staff UX lives on `/admin/proposals/[proposalId]` (Stripe billing card). Customers use `/customer` for portal entry, invoices list, and **Manage billing & invoices**.

## 5. Cloud Functions (optional)

The canonical webhook implementation ships with the Next.js app so Vercel (or any Node host) can verify signatures and write to Firestore in one deploy.

If you **must** terminate webhooks on Firebase Cloud Functions instead:

1. Add the same env vars as secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
2. Deploy an HTTPS function that reads the **raw body**, verifies with `stripe.webhooks.constructEvent`, then runs the same Firestore mirror logic as `server/stripe/stripe-sync.ts` (`applyStripeWebhookEvent`).
3. Point Stripe’s webhook URL at the function URL.

Keeping **one** implementation (either Next.js **or** Cloud Functions) avoids drift. If both are reachable, disable one endpoint to prevent duplicate processing.

### Official Firebase Extensions

Stripe maintains Firebase Extensions for specific workflows (e.g. catalog or payments helpers). This project already mirrors billing entities into first-party collections; only add extensions that do not conflict on the same document paths.

## 6. Operational checklist

- [ ] Stripe webhook URL reachable over HTTPS from Stripe’s IPs.
- [ ] Same webhook signing secret as `STRIPE_WEBHOOK_SECRET`.
- [ ] Firebase Admin credentials present on the server.
- [ ] Customer Portal branding configured under Stripe **Settings → Billing → Customer portal**.
- [ ] Test mode end-to-end: invoice from proposal → webhook rows appear → customer sees mirrors on `/customer`.
