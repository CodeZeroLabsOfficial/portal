"use client";

import type { OpportunityStage } from "@/types/opportunity";
import { updateOpportunityStageAction } from "@/server/actions/opportunities-crm";
import { useRowStatusMutation } from "@/hooks/use-row-status-mutation";

export function useOpportunityStageMutation() {
  const { run, pendingId } = useRowStatusMutation(updateOpportunityStageAction);
  function moveStage(opportunityId: string, stage: OpportunityStage) {
    return run(opportunityId, { opportunityId, stage });
  }
  return { moveStage, pendingId };
}
