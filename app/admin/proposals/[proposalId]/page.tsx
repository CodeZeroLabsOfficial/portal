import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleDot, Clock, Eye, FileText, Mail } from "lucide-react";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminProposalRecord } from "@/server/firestore/portal-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalDocumentEditorLazy } from "@/components/proposal/proposal-document-editor-lazy";
import { ProposalShareSettings } from "@/components/proposal/proposal-share-settings";
import { findProposalBlockById } from "@/lib/proposal-blocks";
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

  const recipient = proposal.recipientEmail?.trim() || null;

  const proposalDetailsSlot = (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="border-border/80 bg-card/80 shadow-sm lg:col-span-2">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
            Proposal details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6 text-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <CircleDot className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Status
              </dt>
              <dd>
                <Badge variant="outline" className="capitalize">
                  {proposal.status}
                </Badge>
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Eye className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Public opens
              </dt>
              <dd className="tabular-nums text-foreground">
                {typeof proposal.viewCount === "number" ? proposal.viewCount : "Not recorded"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Approx. engagement
              </dt>
              <dd className="text-foreground">
                {typeof proposal.totalEngagementSeconds === "number" ? (
                  <>
                    {Math.max(0, Math.round(proposal.totalEngagementSeconds / 60))} minutes on page
                  </>
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Recipient
              </dt>
              <dd className="text-foreground">{recipient ?? "—"}</dd>
            </div>
          </dl>

          {proposal.publicSelections && Object.keys(proposal.publicSelections).length > 0 ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Buyer selection (public link)
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {Object.entries(proposal.publicSelections).map(([blockId, sel]) => {
                  if (sel.kind !== "packages") return null;
                  const blk = findProposalBlockById(proposal.document.blocks, blockId);
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

          {(proposal.sourceTemplateId || proposal.customerId || proposal.opportunityId) && (
            <div className="space-y-3 border-t border-border/60 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked records</p>
              <ul className="space-y-2">
                {proposal.sourceTemplateId ? (
                  <li>
                    <span className="text-muted-foreground">Template · </span>
                    <Link
                      href={`/admin/proposals/templates/${proposal.sourceTemplateId}`}
                      className="text-primary hover:underline"
                    >
                      Open template
                    </Link>
                  </li>
                ) : null}
                {proposal.customerId ? (
                  <li>
                    <span className="text-muted-foreground">Customer · </span>
                    <Link href={`/admin/customers/${proposal.customerId}`} className="text-primary hover:underline">
                      Open CRM profile
                    </Link>
                  </li>
                ) : null}
                {proposal.opportunityId ? (
                  <li>
                    <span className="text-muted-foreground">Opportunity · </span>
                    <Link href={`/admin/opportunities/${proposal.opportunityId}`} className="text-primary hover:underline">
                      Pipeline record
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <ProposalShareSettings proposalId={proposal.id} hasPassword={Boolean(proposal.sharePasswordHash)} />
    </div>
  );

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
      <ProposalDocumentEditorLazy
        proposalId={proposal.id}
        initialDocument={proposal.document}
        initialStatus={proposal.status}
        proposalEditShellToolbar={{
          customerBackHref: customerBackId ? `/admin/customers/${encodeURIComponent(customerBackId)}` : null,
          recipientEmail: recipient,
          shareToken: proposal.shareToken?.trim() || null,
        }}
        proposalEditMiddleSlot={proposalDetailsSlot}
      />
    </WorkspaceShell>
  );
}
