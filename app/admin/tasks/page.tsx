import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { listTasksForStaff } from "@/server/firestore/crm-tasks";
import { TasksPanel } from "@/components/portal/tasks-panel";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/tasks");
  }

  const tasks = await listTasksForStaff(user);

  return (
    <WorkspaceShell
      title="Tasks"
      description="Stay on top of assignments and deadlines."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <TasksPanel tasks={tasks} viewerUid={user.uid} organizationId={user.organizationId} />
    </WorkspaceShell>
  );
}
