import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { listOpportunitiesForStaff } from "@/server/firestore/crm-opportunities";
import { OpportunitiesPanel } from "@/components/portal/opportunities-panel";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export const dynamic = "force-dynamic";

export default async function AdminOpportunitiesPage() {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/opportunities");
  }

  const opportunities = await listOpportunitiesForStaff(user);

  return (
    <WorkspaceShell
      title="Pipeline"
      description="Opportunity stages and deal flow."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
      contentClassName="max-w-[1400px]"
    >
      <OpportunitiesPanel opportunities={opportunities} />
    </WorkspaceShell>
  );
}
