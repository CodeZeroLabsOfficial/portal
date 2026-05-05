import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminProposalRecord } from "@/server/firestore/portal-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

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
      description="Draft proposal"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="space-y-6">
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
              Created from the opportunity flow or dashboard. Open the public link to preview what your customer sees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              <span className="text-muted-foreground">Blocks · </span>
              {blockCount} sections in the document builder payload.
            </p>
            {proposal.customerId ? (
              <p>
                <span className="text-muted-foreground">Customer · </span>
                <Link href={`/admin/customers/${proposal.customerId}`} className="text-primary hover:underline">
                  {proposal.customerId}
                </Link>
              </p>
            ) : null}
            {proposal.opportunityId ? (
              <p>
                <span className="text-muted-foreground">Opportunity · </span>
                <Link href={`/admin/opportunities/${proposal.opportunityId}`} className="text-primary hover:underline">
                  Open pipeline record
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
      </div>
    </WorkspaceShell>
  );
}
