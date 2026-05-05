/**
 * Firestore collection names — single source of truth for paths and query helpers.
 *
 * Security rules (high level — implement in Firebase console):
 * - `users`: user can read/write own doc; admins can read org members via custom claims or backend checks.
 * - `subscriptions`, `invoices`: customer sees own via stripeCustomerId match; staff via organizationId.
 * - `opportunities`: staff-only reads/writes (Admin SDK in this app); add rules matching `customers` if exposed to clients.
 * - `proposals`, `proposal_templates`: org-scoped; public reads only via dedicated share token rules or Cloud Function proxy.
 * - `analytics_events`: insert from authenticated viewer session or validated public token; reads restricted to proposal owners.
 */
export const COLLECTIONS = {
  users: "users",
  /** CRM customer profiles (single-tenant); optional `portalUserId` links `users/{uid}`. */
  customers: "customers",
  /** Sales opportunities — `customerId` references `customers`. */
  opportunities: "opportunities",
  /** Timeline entries (created, note added, Stripe sync, etc.) — keyed by `customerId`. */
  customerActivities: "customer_activities",
  /** Internal notes, calls, emails — keyed by `customerId`. */
  customerNotes: "customer_notes",
  subscriptions: "subscriptions",
  invoices: "invoices",
  /** PaymentIntent mirrors — synced from Stripe webhooks (`payment_intent.*`). */
  payments: "payments",
  /** Stripe Customer objects mirrored by id (`cus_…`). */
  stripeCustomers: "stripe_customers",
  /** Processed Stripe event ids — webhook idempotency (`evt_…`). */
  stripeWebhookEvents: "stripe_webhook_events",
  proposals: "proposals",
  proposalTemplates: "proposal_templates",
  analyticsEvents: "analytics_events",
  /** Optional — admin dashboard aggregates when present. */
  tasks: "tasks",
  supportTickets: "support_tickets",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
