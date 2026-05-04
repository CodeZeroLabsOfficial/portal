"use client";

import * as React from "react";
import Link from "next/link";
import { OPPORTUNITY_STAGES, opportunityStageLabel } from "@/lib/crm/opportunity-stages";
import type { OpportunityRecord, OpportunityStage } from "@/types/opportunity";
import { useOpportunityStageMutation } from "@/hooks/use-opportunity-stage-mutation";
import { cn } from "@/lib/utils";

export interface OpportunitiesListProps {
  opportunities: OpportunityRecord[];
}

export function OpportunitiesList({ opportunities }: OpportunitiesListProps) {
  const { moveStage, pendingId } = useOpportunityStageMutation();

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Opportunity</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Value</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
              <th className="w-24 px-4 py-2.5 font-medium text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {opportunities.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No opportunities yet. Convert a lead or create deals from the customer profile.
                </td>
              </tr>
            ) : (
              opportunities.map((opp) => (
                <tr key={opp.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 align-middle">
                    <div className="font-medium">{opp.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Customer id ·{" "}
                      <Link
                        href={`/admin/customers/${opp.customerId}`}
                        className="font-mono text-primary underline-offset-4 hover:underline"
                      >
                        {opp.customerId.slice(0, 10)}…
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <select
                      value={opp.stage}
                      disabled={pendingId === opp.id}
                      onChange={(e) => {
                        const next = e.target.value as OpportunityStage;
                        if (next !== opp.stage) void moveStage(opp.id, next);
                      }}
                      className={cn(
                        "h-9 max-w-[160px] rounded-md border border-border/80 bg-background px-2 text-[13px]",
                        pendingId === opp.id && "opacity-60",
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
                  <td className="px-4 py-3 text-right align-middle">
                    <Link
                      href={`/admin/opportunities/${opp.id}`}
                      className="text-[13px] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
