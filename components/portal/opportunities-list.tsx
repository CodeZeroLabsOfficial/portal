"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, EllipsisVertical, StickyNote } from "lucide-react";
import { OPPORTUNITY_STAGES, opportunityStageLabel } from "@/lib/crm/opportunity-stages";
import type { OpportunityBoardCard, OpportunityStage } from "@/types/opportunity";
import { useOpportunityStageMutation } from "@/hooks/use-opportunity-stage-mutation";
import { deleteOpportunityAction } from "@/server/actions/opportunities-crm";
import { initialsFromName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface OpportunitiesListProps {
  opportunities: OpportunityBoardCard[];
}

export function OpportunitiesList({ opportunities }: OpportunitiesListProps) {
  const router = useRouter();
  const { moveStage, pendingId } = useOpportunityStageMutation();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(opp: OpportunityBoardCard) {
    const ok = window.confirm("Delete this pipeline deal and its notes/activities? This cannot be undone.");
    if (!ok) return;
    setDeletingId(opp.id);
    const res = await deleteOpportunityAction({ opportunityId: opp.id });
    setDeletingId(null);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Deal</th>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Value</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
              <th className="w-28 px-4 py-2.5 font-medium text-center">Notes</th>
              <th className="w-28 px-4 py-2.5 font-medium text-center">Activities</th>
              <th className="w-12 px-2 py-2.5 font-medium text-right" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="text-foreground">
            {opportunities.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No opportunities yet. Convert a lead or create deals from the customer profile.
                </td>
              </tr>
            ) : (
              opportunities.map((opp) => {
                const rowDisabled = pendingId === opp.id || deletingId === opp.id;
                const hasAssignee = Boolean(opp.assigneeUid?.trim());
                const photo = opp.assigneePhotoUrl?.trim();
                const assigneeLabel = hasAssignee ? opp.assigneeDisplayName?.trim() || "Team member" : "Unassigned";
                const initialsSource = hasAssignee ? opp.assigneeDisplayName?.trim() || assigneeLabel : "";

                return (
                  <tr key={opp.id} className={cn("border-b border-border/60 last:border-0", rowDisabled && "opacity-60")}>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <div
                          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted"
                          title={assigneeLabel}
                        >
                          {photo ? (
                            <Image src={photo} alt="" width={32} height={32} className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted-foreground">
                              {hasAssignee ? initialsFromName(initialsSource) : "?"}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{opp.name}</div>
                          <Link
                            href={`/admin/opportunities/${opp.id}`}
                            className="text-[11px] font-medium text-primary underline-offset-4 hover:underline"
                          >
                            Open detail
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 align-middle">
                      <div className="truncate">{opp.accountCompanyName}</div>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 align-middle">
                      <div className="truncate text-muted-foreground">{opp.leadContactName}</div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <select
                        value={opp.stage}
                        disabled={rowDisabled}
                        onChange={(e) => {
                          const next = e.target.value as OpportunityStage;
                          if (next !== opp.stage) void moveStage(opp.id, next);
                        }}
                        className={cn(
                          "h-9 max-w-[160px] rounded-md border border-border/80 bg-background px-2 text-[13px]",
                          rowDisabled && "opacity-60",
                        )}
                        aria-label={`Stage for ${opp.name}`}
                      >
                        {OPPORTUNITY_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {opportunityStageLabel(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground tabular-nums">
                      {typeof opp.amountMinor === "number"
                        ? (opp.amountMinor / 100).toLocaleString(undefined, {
                            style: "currency",
                            currency: opp.currency.toUpperCase(),
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {opp.updatedAtMs
                        ? new Date(opp.updatedAtMs).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center align-middle tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center justify-center gap-1">
                        <StickyNote className="h-3.5 w-3.5" aria-hidden />
                        {opp.opportunityNoteCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center align-middle tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center justify-center gap-1">
                        <Activity className="h-3.5 w-3.5" aria-hidden />
                        {opp.opportunityActivityCount ?? 0}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${opp.name}`}>
                            <EllipsisVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/admin/opportunities/${opp.id}`}>Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onSelect={() => void handleDelete(opp)}
                          >
                            Delete deal
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/customers/${opp.customerId}`}>Open account</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
