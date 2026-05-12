import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { listProposalTemplatesForOrg } from "@/server/firestore/proposal-templates";
import { listProposalsForStaffOrg } from "@/server/firestore/portal-data";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalsListPanel } from "@/components/portal/proposals-list-panel";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";
import { CloneProposalTemplateButton } from "@/components/proposal/clone-proposal-template-button";
import { NewProposalTemplateButton } from "@/components/proposal/new-proposal-template-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminProposalsHubPage() {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/proposals");
  }
  if (!isStaff(user)) {
    redirect("/dashboard");
  }

  const [proposals, templates] = await Promise.all([
    listProposalsForStaffOrg(user),
    listProposalTemplatesForOrg(user),
  ]);

  return (
    <WorkspaceShell
      title="Proposals"
      description="Create, send, and track dynamic digital proposals."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="space-y-10">
        <ProposalsListPanel proposals={proposals} />

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Templates</h2>
              <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>
                Reusable layouts when creating a proposal from the CRM.
              </p>
            </div>
            <NewProposalTemplateButton />
          </div>

          {templates.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-muted/20">
              <CardHeader>
                <CardTitle className="text-base">No templates yet</CardTitle>
                <CardDescription>Create one to speed up proposals from the CRM.</CardDescription>
              </CardHeader>
              <CardContent>
                <NewProposalTemplateButton />
              </CardContent>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <li key={t.id}>
                  <Card className="border-border/80 bg-card/60 transition-colors hover:bg-card">
                    <CardHeader className="space-y-2 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2 text-base leading-snug">{t.name}</CardTitle>
                        <Badge variant="outline" className="shrink-0 font-normal capitalize">
                          Template
                        </Badge>
                      </div>
                      {t.description?.trim() ? (
                        <CardDescription className="line-clamp-2">{t.description.trim()}</CardDescription>
                      ) : (
                        <CardDescription className="italic text-muted-foreground/80">No description</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 pt-0">
                      <Button variant="secondary" size="sm" className="gap-1.5" asChild>
                        <Link href={`/admin/proposals/templates/${t.id}`}>
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </Link>
                      </Button>
                      <CloneProposalTemplateButton templateId={t.id} />
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
