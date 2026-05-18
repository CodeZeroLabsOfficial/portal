import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { listProposalTemplatesForOrg } from "@/server/firestore/proposal-templates";
import { listContractTemplatesForOrg } from "@/server/firestore/contract-templates";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalTemplatesListPanel } from "@/components/portal/proposal-templates-list-panel";
import { TemplatesHubPageIntro } from "@/components/portal/templates-hub-page-intro";
import { NewProposalTemplateButton } from "@/components/proposal/new-proposal-template-button";
import { NewContractTemplateButton } from "@/components/portal/new-contract-template-button";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesHubPage() {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/templates");
  }
  if (!isStaff(user)) {
    redirect("/dashboard");
  }

  const templates = await listProposalTemplatesForOrg(user);
  const contractTemplates = await listContractTemplatesForOrg(user);

  return (
    <WorkspaceShell
      title="Templates"
      description="Create, send, and track dynamic digital proposals."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="space-y-10">
        <TemplatesHubPageIntro
          actions={
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <NewProposalTemplateButton />
              <NewContractTemplateButton />
            </div>
          }
        />

        <ProposalTemplatesListPanel
          proposalTemplates={templates}
          contractTemplates={contractTemplates}
          localityTimeZone={user.timeZone?.trim() || undefined}
        />
      </div>
    </WorkspaceShell>
  );
}
