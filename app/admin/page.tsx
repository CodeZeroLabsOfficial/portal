import { redirect } from "next/navigation";
import { BarChart3, FolderKanban, Users } from "lucide-react";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminPortalData } from "@/server/firestore/portal-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminHomePage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  const data = await getAdminPortalData(user);
  const acceptedCount = data.proposals.filter((proposal) => proposal.status === "accepted").length;

  return (
    <WorkspaceShell
      title="Dashboard"
      description="High-level metrics across customers, billing, and proposals."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Snapshot of the admin workspace. Open Customers for the full directory, or Billing and
            Tasks as those modules go live.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
                At a glance
              </CardTitle>
              <CardDescription>Live counts from Firestore and Stripe mirrors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Customers: {data.customers.length}</p>
              <p>Subscriptions: {data.subscriptions.length}</p>
              <p>Proposals: {data.proposals.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                Customers
              </CardTitle>
              <CardDescription>Manage accounts and plans in the Customers area.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Use the sidebar link for the full customer list and roles.</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden />
                Proposals
              </CardTitle>
              <CardDescription>Pipeline health from proposal records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Total: {data.proposals.length}</p>
              <p>Accepted: {acceptedCount}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}
