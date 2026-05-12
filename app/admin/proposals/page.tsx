import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { listProposalsForStaffOrg } from "@/server/firestore/portal-data";
import { listProposalTemplatesForOrg } from "@/server/firestore/proposal-templates";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalsListPanel } from "@/components/portal/proposals-list-panel";
import { ProposalTemplatesListPanel } from "@/components/portal/proposal-templates-list-panel";
import { NewProposalTemplateButton } from "@/components/proposal/new-proposal-template-button";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Proposals</h1>
            <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>
              Create, send, and track dynamic digital proposals.
            </p>
          </div>
          <NewProposalTemplateButton />
        </div>

        <ProposalsListPanel proposals={proposals} />
        <ProposalTemplatesListPanel templates={templates} />
      </div>
    </WorkspaceShell>
  );
}
