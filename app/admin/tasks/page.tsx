import { redirect } from "next/navigation";
import { ListTodo } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminTasksPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/tasks");
  }

  return (
    <WorkspaceShell
      title="Tasks"
      description="Follow-ups, approvals, and operational checklists."
      roleLabel={user.role}
      userLabel={user.email || user.uid}
      actions={<LogoutButton />}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
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
