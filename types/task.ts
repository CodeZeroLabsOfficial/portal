/** Internal / operational task row (optional `tasks` collection in Firestore). */
export interface TaskRecord {
  id: string;
  organizationId?: string;
  /** When set, task is scoped to a CRM customer profile. */
  customerId?: string;
  title: string;
  status: string;
  dueAtMs?: number;
  updatedAtMs: number;
}
