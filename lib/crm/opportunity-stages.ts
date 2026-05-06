import type { OpportunityStage } from "@/types/opportunity";

/** Ordered pipeline stages — Kanban columns follow this order. */
export const OPPORTUNITY_STAGES: readonly OpportunityStage[] = [
  "lead_in",
  "contacted",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
];

/** Maps legacy stored `stage` values from before the pipeline rename. */
const LEGACY_OPPORTUNITY_STAGE: Record<string, OpportunityStage | undefined> = {
  new: "lead_in",
  qualified: "contacted",
  proposal: "proposal_sent",
};

export function isOpportunityStage(value: string): value is OpportunityStage {
  return (OPPORTUNITY_STAGES as readonly string[]).includes(value);
}

export function normalizeOpportunityStage(value: unknown): OpportunityStage {
  if (typeof value !== "string") return "lead_in";
  if (isOpportunityStage(value)) return value;
  const mapped = LEGACY_OPPORTUNITY_STAGE[value];
  return mapped ?? "lead_in";
}

const stageLabels: Record<OpportunityStage, string> = {
  lead_in: "Lead in",
  contacted: "Contacted",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export function opportunityStageLabel(stage: OpportunityStage): string {
  return stageLabels[stage] ?? stage;
}
