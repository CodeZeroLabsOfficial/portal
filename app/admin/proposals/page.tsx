import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { listProposalsHubRowsForStaffOrg } from "@/server/firestore/portal-data";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalsListPanel } from "@/components/portal/proposals-list-panel";
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

  const proposals = await listProposalsHubRowsForStaffOrg(user);

  return (
    <WorkspaceShell
      title="Proposals"
      description="Publish, track opens and acceptance of submitted proposals."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="space-y-10">
        <div>
          <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Proposals</h1>
          <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>
            Publish, track opens and acceptance of submitted proposals.
          </p>
        </div>

        <ProposalsListPanel proposals={proposals} localityTimeZone={user.timeZone?.trim() || undefined} />
      </div>
    </WorkspaceShell>
  );
}
