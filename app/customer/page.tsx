import { redirect } from "next/navigation";
import { CreditCard, ReceiptText } from "lucide-react";
import { formatCurrencyAmount } from "@/lib/format";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getCustomerPortalData } from "@/server/firestore/portal-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function CustomerPortalPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/customer");
  }

  const data = await getCustomerPortalData(user);

  return (
    <WorkspaceShell
      title="Customer Portal"
      description="Self-serve billing and proposal visibility."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <h1 className="text-2xl font-semibold tracking-tight">Account workspace</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Self-service subscriptions, invoices, payment methods, and shared proposals. Data is
            scoped to the signed-in customer and Stripe customer id.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
                Billing
              </CardTitle>
              <CardDescription>Stripe Customer Portal entry point and invoice downloads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Active subscriptions: {data.subscriptions.length}</p>
              <p>Invoices: {data.invoices.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ReceiptText className="h-4 w-4 text-muted-foreground" aria-hidden />
                Proposals
              </CardTitle>
              <CardDescription>Proposals shared with this customer and acceptance status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Total proposals: {data.proposals.length}</p>
              <p>
                Awaiting response:{" "}
                {
                  data.proposals.filter(
                    (proposal) => proposal.status === "sent" || proposal.status === "viewed",
                  ).length
                }
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Latest invoices</CardTitle>
            <CardDescription>Download links and payment status from Firestore invoice mirrors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.invoices.length === 0 ? (
              <p className="text-muted-foreground">No invoices found for this account.</p>
            ) : (
              data.invoices.slice(0, 8).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2.5"
                >
                  <div>
                    <p className="font-medium">{invoice.stripeInvoiceId}</p>
                    <p className="text-xs text-muted-foreground">{invoice.status}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrencyAmount(invoice.amountDue, invoice.currency)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
