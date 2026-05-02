import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminReportsPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/reports");
  }

  return (
    <WorkspaceShell
      title="Reports"
      description="Operational metrics, exports, and scheduled summaries."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Build and share reporting views for revenue, usage, and customer health. Saved reports
            and exports will appear here as they are connected.
          </p>
        </section>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
              No reports yet
            </CardTitle>
            <CardDescription>
              Connect data sources or choose a template to generate your first report.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Use the dashboard and customer directory for live views until report scheduling is enabled.</p>
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
