"use client";

import * as React from "react";
import type { ProposalTemplateRecord } from "@/types/proposal-template";

/** Keeps the selected template id aligned with the available template list (by stable id-set key). */
export function useProposalTemplatePickerState(templates: ProposalTemplateRecord[]) {
  const [proposalTemplateId, setProposalTemplateId] = React.useState(
    () => templates[0]?.id ?? "",
  );
  const proposalTemplateIdsKey = templates.map((t) => t.id).join(",");

  React.useEffect(() => {
    const list = templates;
    if (list.length === 0) {
      setProposalTemplateId("");
      return;
    }
    setProposalTemplateId((prev) =>
      prev && list.some((t) => t.id === prev) ? prev : list[0].id,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when template *set* changes, not array identity
  }, [proposalTemplateIdsKey]);

  return { proposalTemplateId, setProposalTemplateId };
}
