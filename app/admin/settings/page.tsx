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
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configure workspace preferences, integrations, and account details. Additional controls will appear here as
            they ship.
          </p>
        </section>
      </div>
    </WorkspaceShell>
  );
}
