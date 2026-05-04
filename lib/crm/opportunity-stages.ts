import type { OpportunityStage } from "@/types/opportunity";

/** Ordered pipeline stages — Kanban columns follow this order. */
export const OPPORTUNITY_STAGES: readonly OpportunityStage[] = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export function isOpportunityStage(value: string): value is OpportunityStage {
  return (OPPORTUNITY_STAGES as readonly string[]).includes(value);
}

export function normalizeOpportunityStage(value: unknown): OpportunityStage {
  if (typeof value === "string" && isOpportunityStage(value)) return value;
  return "new";
}

const stageLabels: Record<OpportunityStage, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export function opportunityStageLabel(stage: OpportunityStage): string {
  return stageLabels[stage] ?? stage;
}
