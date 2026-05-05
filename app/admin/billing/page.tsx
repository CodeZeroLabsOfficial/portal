import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminBillingPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/billing");
  }

  return (
    <WorkspaceShell
      title="Billing"
      description="Invoices, subscriptions, and payment management."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Centralise subscription health, invoice status, and payment method visibility. Detailed
            billing tools will connect here next.
          </p>
        </section>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
              Coming soon
            </CardTitle>
            <CardDescription>Stripe mirrors and finance workflows will surface in this view.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Use the dashboard and customers views for live counts until this section is wired up.</p>
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
