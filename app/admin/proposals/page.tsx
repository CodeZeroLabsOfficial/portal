import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { listProposalsForStaffOrg } from "@/server/firestore/portal-data";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalsListPanel } from "@/components/portal/proposals-list-panel";
import { Button } from "@/components/ui/button";
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

  const proposals = await listProposalsForStaffOrg(user);

  return (
    <WorkspaceShell
      title="Proposals"
      description="Create, send, and track proposals assigned to customers."
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
              Proposals linked to CRM customers — publish, track opens, and collect acceptance.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href="/admin/proposals/templates">Proposal templates</Link>
          </Button>
        </div>

        <ProposalsListPanel proposals={proposals} />
      </div>
    </WorkspaceShell>
  );
}
