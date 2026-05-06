import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { SettingsSubnav } from "@/components/portal/settings-subnav";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminSettingsLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/settings");
  }

  return (
    <WorkspaceShell
      title="Settings"
      description="Workspace preferences"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
      secondaryNav={<SettingsSubnav />}
    >
      {children}
    </WorkspaceShell>
  );
}
