/** Internal / operational task row (optional `tasks` collection in Firestore). */
export interface TaskRecord {
  id: string;
  organizationId?: string;
  /** When set, task is scoped to a CRM customer profile. */
  customerId?: string;
  title: string;
  status: string;
  dueAtMs?: number;
  /** Optional schedule start (epoch ms) for board display. */
  startAtMs?: number;
  updatedAtMs: number;
  description?: string;
  priority?: string;
  category?: string;
  progressPercent?: number;
  commentCount?: number;
  attachmentCount?: number;
  assigneeCount?: number;
  /** When set, “My Tasks” can filter to the signed-in staff member. */
  assignedToUid?: string;
}
