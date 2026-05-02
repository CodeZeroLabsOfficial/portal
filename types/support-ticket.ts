export type SupportTicketUrgency = "critical" | "high" | "medium" | "low";

/** Support ticket row (optional `support_tickets` collection in Firestore). */
export interface SupportTicketRecord {
  id: string;
  organizationId?: string;
  status: string;
  urgency: SupportTicketUrgency;
  updatedAtMs: number;
}
