import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminPortalData } from "@/server/firestore/portal-data";
import { AdminHomeDashboard, AdminHomeRightAside } from "@/components/portal/admin-home-dashboard";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminHomePage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  const data = await getAdminPortalData(user);

  return (
    <WorkspaceShell
      title="Dashboard"
      description="High-level metrics across customers, billing, and proposals."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      contentClassName="max-w-[1200px]"
      rightAside={<AdminHomeRightAside data={data} />}
    >
      <AdminHomeDashboard
        data={data}
        displayName={user.displayName ?? ""}
        userLabel={user.email || user.uid}
      />
    </WorkspaceShell>
  );
}
