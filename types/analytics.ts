export type AnalyticsEventType =
  | "proposal_view"
  | "proposal_section_view"
  | "proposal_time"
  | "proposal_accept"
  | "proposal_decline";

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  proposalId: string;
  /** Viewer session or anonymous id from public viewer. */
  visitorKey?: string;
  sectionId?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
  createdAtMs: number;
}
