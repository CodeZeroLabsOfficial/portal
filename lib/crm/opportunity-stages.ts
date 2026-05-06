import type { OpportunityStage } from "@/types/opportunity";

/** Ordered pipeline stages — Kanban columns and detail-view stepper follow this order. */
export const OPPORTUNITY_STAGES: readonly OpportunityStage[] = [
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "awaiting_signature",
  "closed_won",
  "closed_lost",
  "onboarding",
];

/** Maps legacy stored `stage` values from earlier pipeline schemas to the current stage set. */
const LEGACY_OPPORTUNITY_STAGE: Record<string, OpportunityStage | undefined> = {
  new: "qualification",
  lead_in: "qualification",
  qualified: "discovery",
  contacted: "discovery",
  proposal_sent: "awaiting_signature",
  won: "closed_won",
  lost: "closed_lost",
};

export function isOpportunityStage(value: string): value is OpportunityStage {
  return (OPPORTUNITY_STAGES as readonly string[]).includes(value);
}

export function normalizeOpportunityStage(value: unknown): OpportunityStage {
  if (typeof value !== "string") return "qualification";
  if (isOpportunityStage(value)) return value;
  const mapped = LEGACY_OPPORTUNITY_STAGE[value];
  return mapped ?? "qualification";
}

const stageLabels: Record<OpportunityStage, string> = {
  qualification: "Qualification",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  awaiting_signature: "Awaiting Signature",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
  onboarding: "Onboarding",
};

export function opportunityStageLabel(stage: OpportunityStage): string {
  return stageLabels[stage] ?? stage;
}
