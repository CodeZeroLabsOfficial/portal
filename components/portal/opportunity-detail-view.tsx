"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { CustomerRecord } from "@/types/customer";
import type { OpportunityRecord, OpportunityStage } from "@/types/opportunity";
import { OPPORTUNITY_STAGES, opportunityStageLabel } from "@/lib/crm/opportunity-stages";
import { useOpportunityStageMutation } from "@/hooks/use-opportunity-stage-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WORKSPACE_DETAIL_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS,
} from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";

export interface OpportunityDetailViewProps {
  opportunity: OpportunityRecord;
  customer: CustomerRecord;
}

const CHEVRON_CLIP =
  "[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%,14px_50%)]";
const CHEVRON_CLIP_FIRST =
  "[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%)]";

function stageVariantClasses(
  stage: OpportunityStage,
  variant: "active" | "completed" | "upcoming",
): string {
  if (variant === "active") {
    if (stage === "closed_lost") return "bg-destructive/15 text-destructive";
    if (stage === "closed_won" || stage === "onboarding") return "bg-emerald-500/15 text-emerald-500";
    return "bg-primary/15 text-primary";
  }
  if (variant === "completed") {
    return "bg-muted text-foreground/80";
  }
  return "bg-muted/40 text-muted-foreground";
}

interface OpportunityStageProgressProps {
  opportunity: OpportunityRecord;
}

function OpportunityStageProgress({ opportunity }: OpportunityStageProgressProps) {
  const { moveStage, pendingId } = useOpportunityStageMutation();
  const busy = pendingId === opportunity.id;
  const currentIndex = OPPORTUNITY_STAGES.indexOf(opportunity.stage);

  const startDate = opportunity.createdAtMs
    ? new Date(opportunity.createdAtMs).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 px-4 py-4 shadow-sm sm:px-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Start
          </p>
          {startDate ? (
            <p className="text-[13px] tabular-nums text-foreground">{startDate}</p>
          ) : (
            <p className="text-[13px] text-muted-foreground">—</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Current stage
          </p>
          <p className="text-[13px] font-medium text-foreground">
            {opportunityStageLabel(opportunity.stage)}
          </p>
        </div>
      </div>

      <div className="-mx-4 flex items-stretch overflow-x-auto px-4 pb-1 pt-1 sm:-mx-6 sm:px-6">
        {OPPORTUNITY_STAGES.map((stage, i) => {
          const active = stage === opportunity.stage;
          const completed = i < currentIndex;
          const variant: "active" | "completed" | "upcoming" = active
            ? "active"
            : completed
              ? "completed"
              : "upcoming";
          return (
            <button
              key={stage}
              type="button"
              disabled={busy || active}
              onClick={() => {
                if (stage !== opportunity.stage) void moveStage(opportunity.id, stage);
              }}
              aria-current={active ? "step" : undefined}
              aria-label={`Move stage to ${opportunityStageLabel(stage)}`}
              className={cn(
                "relative h-10 shrink-0 whitespace-nowrap px-6 text-[12px] font-semibold transition-colors",
                "min-w-[140px] sm:min-w-[160px]",
                i === 0 ? CHEVRON_CLIP_FIRST : cn("-ml-[14px]", CHEVRON_CLIP),
                stageVariantClasses(stage, variant),
                !active && !busy && "hover:brightness-110",
                busy && "opacity-60",
              )}
            >
              {opportunityStageLabel(stage)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OpportunityDetailView({ opportunity, customer }: OpportunityDetailViewProps) {
  const cfEntries = Object.entries({
    ...customer.customFields,
    ...opportunity.customFieldsSnapshot,
  }).filter(([k]) => k.trim());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/opportunities">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Pipeline
          </Link>
        </Button>
      </div>

      <OpportunityStageProgress opportunity={opportunity} />

      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-6 shadow-sm backdrop-blur-sm md:p-8"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={WORKSPACE_DETAIL_PAGE_TITLE_CLASS}>{opportunity.name}</h1>
              <Badge variant="outline" className="font-normal">
                {opportunityStageLabel(opportunity.stage)}
              </Badge>
            </div>
            <p className={WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS}>
              Linked contact ·{" "}
              <Link href={`/admin/customers/${customer.id}`} className="font-medium text-primary hover:underline">
                {customer.name || customer.email}
              </Link>
            </p>
            {typeof opportunity.amountMinor === "number" ? (
              <p className="text-lg tabular-nums text-foreground">
                {(opportunity.amountMinor / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: opportunity.currency.toUpperCase(),
                })}
              </p>
            ) : null}
          </div>
        </div>
      </motion.header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
            <CardDescription>Billing and CRM profile linked to this opportunity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Email · </span>
              {customer.email}
            </p>
            {customer.company ? (
              <p>
                <span className="text-muted-foreground">Company · </span>
                {customer.company}
              </p>
            ) : null}
            {customer.phone ? (
              <p>
                <span className="text-muted-foreground">Phone · </span>
                {customer.phone}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Merged fields</CardTitle>
            <CardDescription>Customer custom fields merged with the opportunity snapshot.</CardDescription>
          </CardHeader>
          <CardContent>
            {cfEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom fields yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {cfEntries.map(([k, v]) => (
                  <li key={k} className="flex flex-col rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                    <span className="text-foreground">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {opportunity.notes?.trim() ? (
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Opportunity notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{opportunity.notes.trim()}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
