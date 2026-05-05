"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import type { CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type { ProposalTemplateRecord } from "@/types/proposal-template";
import { opportunityStageLabel } from "@/lib/crm/opportunity-stages";
import { createDraftProposalFromOpportunityAction } from "@/server/actions/proposals-crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WORKSPACE_DETAIL_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS,
} from "@/lib/workspace-page-typography";

export interface OpportunityDetailViewProps {
  opportunity: OpportunityRecord;
  customer: CustomerRecord;
  proposalTemplates: ProposalTemplateRecord[];
}

export function OpportunityDetailView({ opportunity, customer, proposalTemplates }: OpportunityDetailViewProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [templateId, setTemplateId] = React.useState<string>("");

  async function createProposal() {
    setBusy(true);
    try {
      const res = await createDraftProposalFromOpportunityAction(
        opportunity.id,
        templateId.trim() ? templateId.trim() : undefined,
      );
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.push(`/admin/proposals/${res.proposalId}`);
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not create proposal. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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
        <div className="flex max-w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {proposalTemplates.length > 0 ? (
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:max-w-[220px]">
              Template
              <select
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal normal-case text-foreground"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={busy}
              >
                <option value="">Standard (auto-filled)</option>
                {proposalTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="gap-2 shadow-md sm:self-end"
            disabled={busy}
            onClick={() => void createProposal()}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileText className="h-5 w-5" aria-hidden />}
            Create proposal
          </Button>
        </div>
      </div>

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
            <CardDescription>Billing and CRM profile used when generating the proposal.</CardDescription>
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

      <p className="text-center text-[13px] text-muted-foreground">
        Draft proposals include header and text blocks pre-filled from this screen.{" "}
        <Link href={`/admin/customers/${customer.id}`} className="text-primary underline-offset-4 hover:underline">
          Edit customer fields
        </Link>{" "}
        before creating a proposal if needed.
      </p>
    </div>
  );
}
