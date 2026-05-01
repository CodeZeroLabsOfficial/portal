import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { formatCurrencyAmount } from "@/lib/format";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getCustomerPortalData } from "@/server/firestore/portal-data";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomerPortalPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/customer");
  }

  const data = await getCustomerPortalData(user);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Customer portal</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Self-service subscriptions, invoices, payment methods, and shared proposals. Scope data
            by signed-in customer and Stripe customer id.
          </p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Billing</CardTitle>
              <CardDescription>Stripe Customer Portal entry point and invoice downloads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Active subscriptions: {data.subscriptions.length}</p>
              <p>Invoices: {data.invoices.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proposals</CardTitle>
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

        <Card className="mt-6">
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
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
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

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Link href="/" className="underline underline-offset-4">
            Home
          </Link>
        </p>
      </main>
    </div>
  );
}
