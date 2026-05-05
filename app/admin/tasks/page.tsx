import { redirect } from "next/navigation";
import { ListTodo } from "lucide-react";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";

export default async function AdminTasksPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/tasks");
  }

  return (
    <WorkspaceShell
      title="Tasks"
      description="Stay on top of assignments and deadlines."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Tasks</h1>
          <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>
            Track internal work items tied to customers and billing. Task lists will appear here as
            they are implemented.
          </p>
        </section>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4 text-muted-foreground" aria-hidden />
              No open tasks yet
            </CardTitle>
            <CardDescription>Operational tasks and reminders will list in this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Check back after task sync is enabled, or use the customer directory for manual follow-ups.</p>
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
