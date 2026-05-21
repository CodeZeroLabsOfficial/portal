import { Badge } from "@/components/ui/badge";
import { getProposalStageBadgeDisplay } from "@/lib/proposal-status-badge";
import { cn } from "@/lib/utils";
import type { ProposalRecord } from "@/types/proposal";

export function ProposalStageBadge({
  proposal,
  className,
}: {
  proposal: ProposalRecord;
  className?: string;
}) {
  const stage = getProposalStageBadgeDisplay(proposal);
  return (
    <Badge
      variant="outline"
      title={stage.title}
      className={cn("text-xs font-medium capitalize", stage.className, className)}
    >
      {stage.label}
    </Badge>
  );
}
