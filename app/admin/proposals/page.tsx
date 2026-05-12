import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { listProposalTemplatesForOrg } from "@/server/firestore/proposal-templates";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ProposalTemplatesListPanel } from "@/components/portal/proposal-templates-list-panel";

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

  const templates = await listProposalTemplatesForOrg(user);

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
      <ProposalTemplatesListPanel templates={templates} />
    </WorkspaceShell>
  );
}
