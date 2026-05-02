import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminSettingsPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/settings");
  }

  return (
    <WorkspaceShell
      title="Settings"
      description="Workspace preferences and integrations."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <p className="text-sm text-muted-foreground">
        Additional workspace settings will appear here as they ship.
      </p>
    </WorkspaceShell>
  );
}
