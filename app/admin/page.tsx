import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { getAdminPortalData } from "@/server/firestore/portal-data";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminHomePage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!hasRole(user, ["admin", "team"])) {
    redirect("/dashboard");
  }

  const data = await getAdminPortalData(user);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage customers, proposals, templates, and analytics. Gate this area by{" "}
            <span className="font-medium text-foreground">admin</span> or{" "}
            <span className="font-medium text-foreground">team</span> roles from Firestore / custom
            claims.
          </p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customers &amp; subscriptions</CardTitle>
              <CardDescription>List organisations, plans, and Stripe Customer Portal links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Customers: {data.customers.length}</p>
              <p>Subscriptions: {data.subscriptions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proposals</CardTitle>
              <CardDescription>Template library, builder, and engagement reporting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Total proposals: {data.proposals.length}</p>
              <p>
                Accepted: {data.proposals.filter((proposal) => proposal.status === "accepted").length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Recent customers</CardTitle>
            <CardDescription>Fetched from `users` collection scoped by organisation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.customers.length === 0 ? (
              <p className="text-muted-foreground">No customer records found.</p>
            ) : (
              data.customers.slice(0, 8).map((customer) => (
                <div
                  key={customer.uid}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <p className="font-medium">{customer.displayName || customer.email || customer.uid}</p>
                  <p className="text-xs text-muted-foreground">{customer.role}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Link href="/dashboard" className="underline underline-offset-4">
            Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
