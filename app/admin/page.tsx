import { redirect } from "next/navigation";
import { FolderKanban, Users } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { getAdminPortalData } from "@/server/firestore/portal-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminHomePage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!hasRole(user, ["admin", "team"])) {
    redirect("/dashboard");
  }

  const data = await getAdminPortalData(user);
  const acceptedCount = data.proposals.filter((proposal) => proposal.status === "accepted").length;

  return (
    <WorkspaceShell
      title="Operations Console"
      description="Customer, subscription, and proposal administration."
      roleLabel={user.role}
      userLabel={user.email || user.uid}
      actions={<LogoutButton />}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <h1 className="text-2xl font-semibold tracking-tight">Admin workspace</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage customers, proposals, templates, and analytics. Access is restricted to{" "}
            <span className="font-medium text-foreground">admin</span> and{" "}
            <span className="font-medium text-foreground">team</span> roles from Firestore claims.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                Customers &amp; subscriptions
              </CardTitle>
              <CardDescription>List organisations, plans, and Stripe Portal links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Customers: {data.customers.length}</p>
              <p>Subscriptions: {data.subscriptions.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden />
                Proposals
              </CardTitle>
              <CardDescription>Template library, builder, and engagement reporting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Total proposals: {data.proposals.length}</p>
              <p>Accepted: {acceptedCount}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Recent customers</CardTitle>
            <CardDescription>Fetched from the `users` collection and scoped by organisation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.customers.length === 0 ? (
              <p className="text-muted-foreground">No customer records found.</p>
            ) : (
              data.customers.slice(0, 8).map((customer) => (
                <div
                  key={customer.uid}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2.5"
                >
                  <p className="font-medium">{customer.displayName || customer.email || customer.uid}</p>
                  <p className="text-xs text-muted-foreground">{customer.role}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
