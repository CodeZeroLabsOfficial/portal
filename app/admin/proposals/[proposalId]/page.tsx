import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminProposalRecord } from "@/server/firestore/portal-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalDocumentEditorLazy } from "@/components/proposal/proposal-document-editor-lazy";
import { ProposalStripeActions } from "@/components/proposal/proposal-stripe-actions";
import { ProposalShareSettings } from "@/components/proposal/proposal-share-settings";
import { getServerEnv } from "@/lib/env/server";
import { isStripeApiConfigured } from "@/lib/stripe/server";
import type { PackagesBlock } from "@/types/proposal";

interface PageProps {
  params: Promise<{ proposalId: string }>;
  searchParams: Promise<{ customer?: string | string[] }>;
}

function firstQueryString(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export default async function AdminProposalDetailPage({ params, searchParams }: PageProps) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  const { proposalId } = await params;
  const proposal = await getAdminProposalRecord(user, proposalId);
  if (!proposal) {
    notFound();
  }

  const sp = await searchParams;
  const customerBackId = proposal.customerId?.trim() || firstQueryString(sp.customer);

  const blockCount = proposal.document.blocks?.length ?? 0;

  const stripeReady = isStripeApiConfigured();
  let defaultSubscriptionPriceId: string | null = null;
  try {
    defaultSubscriptionPriceId = getServerEnv().STRIPE_DEFAULT_SUBSCRIPTION_PRICE_ID ?? null;
  } catch {
    defaultSubscriptionPriceId = null;
  }

  return (
    <WorkspaceShell
      title={proposal.title}
      description="Proposal builder — tied to CRM contacts and opportunities."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          {customerBackId ? (
            <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
              <Link href={`/admin/customers/${encodeURIComponent(customerBackId)}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to customer
              </Link>
            </Button>
          ) : null}
          <Badge variant="outline" className="capitalize">
            {proposal.status}
          </Badge>
          {proposal.recipientEmail ? (
            <span className="text-sm text-muted-foreground">To · {proposal.recipientEmail}</span>
          ) : null}
        </div>

        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription>
              Created from the opportunity flow or dashboard. Publish when ready — that stages linked deals and unlocks
              analytics on the public link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              <span className="text-muted-foreground">Blocks · </span>
              {blockCount} sections.
            </p>
            {typeof proposal.viewCount === "number" ? (
              <p>
                <span className="text-muted-foreground">Public opens · </span>
                {proposal.viewCount}
              </p>
            ) : null}
            {typeof proposal.totalEngagementSeconds === "number" ? (
              <p>
                <span className="text-muted-foreground">Approx. engagement · </span>
                {Math.max(0, Math.round(proposal.totalEngagementSeconds / 60))} minutes on page
              </p>
            ) : null}
            {proposal.publicSelections && Object.keys(proposal.publicSelections).length > 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Buyer selection (public link)
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {Object.entries(proposal.publicSelections).map(([blockId, sel]) => {
                    if (sel.kind !== "packages") return null;
                    const blk = proposal.document.blocks.find((b) => b.id === blockId);
                    const pb: PackagesBlock | undefined = blk?.type === "packages" ? blk : undefined;
                    const tierName =
                      pb?.tiers?.find((t) => t.id === sel.tierId)?.name ?? `${sel.tierId.slice(0, 6)}…`;
                    const termLabel =
                      sel.term === "12_months" ? "12 months" : sel.term === "24_months" ? "24 months" : "Term";
                    return (
                      <li key={blockId}>
                        <span className="font-medium text-foreground">{tierName}</span> · {termLabel}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {proposal.sourceTemplateId ? (
              <p>
                <span className="text-muted-foreground">Created from template · </span>
                <Link
                  href={`/admin/proposals/templates/${proposal.sourceTemplateId}`}
                  className="text-primary hover:underline"
                >
                  Open template
                </Link>
              </p>
            ) : null}
            {proposal.customerId ? (
              <p>
                <span className="text-muted-foreground">Customer · </span>
                <Link href={`/admin/customers/${proposal.customerId}`} className="text-primary hover:underline">
                  Open CRM profile
                </Link>
              </p>
            ) : null}
            {proposal.opportunityId ? (
              <p>
                <span className="text-muted-foreground">Opportunity · </span>
                <Link href={`/admin/opportunities/${proposal.opportunityId}`} className="text-primary hover:underline">
                  Pipeline record
                </Link>
              </p>
            ) : null}
            {proposal.shareToken ? (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link href={`/p/${proposal.shareToken}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Open public viewer
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <ProposalStripeActions
          proposalId={proposal.id}
          stripeReady={stripeReady}
          customerLinked={Boolean(proposal.customerId?.trim())}
          defaultSubscriptionPriceId={defaultSubscriptionPriceId}
        />

        <ProposalShareSettings proposalId={proposal.id} hasPassword={Boolean(proposal.sharePasswordHash)} />

        <ProposalDocumentEditorLazy
          proposalId={proposal.id}
          initialTitle={proposal.document.title || proposal.title}
          initialDocument={proposal.document}
          initialStatus={proposal.status}
        />
      </div>
    </WorkspaceShell>
  );
}
