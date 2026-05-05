import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminProposalRecord } from "@/server/firestore/portal-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalDocumentEditor } from "@/components/proposal/proposal-document-editor";
import { ProposalShareSettings } from "@/components/proposal/proposal-share-settings";
import type { PackagesBlock } from "@/types/proposal";

interface PageProps {
  params: Promise<{ proposalId: string }>;
}

export default async function AdminProposalDetailPage({ params }: PageProps) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  const { proposalId } = await params;
  const proposal = await getAdminProposalRecord(user, proposalId);
  if (!proposal) {
    notFound();
  }

  const blockCount = proposal.document.blocks?.length ?? 0;

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
                    const tierName = pb?.tiers.find((t) => t.id === sel.tierId)?.name ?? `${sel.tierId.slice(0, 6)}…`;
                    const termLabel = sel.term === "12_months" ? "12 months" : "24 months";
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

        <ProposalShareSettings proposalId={proposal.id} hasPassword={Boolean(proposal.sharePasswordHash)} />

        <ProposalDocumentEditor
          proposalId={proposal.id}
          initialTitle={proposal.document.title || proposal.title}
          initialDocument={proposal.document}
          initialStatus={proposal.status}
        />
      </div>
    </WorkspaceShell>
  );
}
