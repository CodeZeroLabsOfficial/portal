export type UserRole = "admin" | "team" | "customer";

/** Mirrors `users/{uid}` in Firestore — align fields with your iOS app where possible. */
export interface PortalUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  /** Owning organisation or tenant id for team/admin scoping. */
  organizationId?: string;
  /** Stripe Customer id for billing portal and invoices. */
  stripeCustomerId?: string;
  createdAtMs: number;
  updatedAtMs: number;
}
