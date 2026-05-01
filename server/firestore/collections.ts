/**
 * Firestore collection names — single source of truth for paths and query helpers.
 *
 * Security rules (high level — implement in Firebase console):
 * - `users`: user can read/write own doc; admins can read org members via custom claims or backend checks.
 * - `subscriptions`, `invoices`: customer sees own via stripeCustomerId match; staff via organizationId.
 * - `proposals`, `proposal_templates`: org-scoped; public reads only via dedicated share token rules or Cloud Function proxy.
 * - `analytics_events`: insert from authenticated viewer session or validated public token; reads restricted to proposal owners.
 */
export const COLLECTIONS = {
  users: "users",
  subscriptions: "subscriptions",
  invoices: "invoices",
  proposals: "proposals",
  proposalTemplates: "proposal_templates",
  analyticsEvents: "analytics_events",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
