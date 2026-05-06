import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

export default async function Loading() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/tasks");
  }

  return (
    <WorkspaceShell
      title="Tasks"
      description="Loading tasks…"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="animate-pulse space-y-4 rounded-xl border border-border/60 bg-muted/20 p-8">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-32 rounded-lg bg-muted/80" />
      </div>
    </WorkspaceShell>
  );
}
