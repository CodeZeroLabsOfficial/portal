"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { OpportunityStage } from "@/types/opportunity";
import { updateOpportunityStageAction } from "@/server/actions/opportunities-crm";

export function useOpportunityStageMutation() {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function moveStage(opportunityId: string, stage: OpportunityStage) {
    setPendingId(opportunityId);
    const res = await updateOpportunityStageAction({ opportunityId, stage });
    setPendingId(null);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.refresh();
  }

  return { moveStage, pendingId };
}
