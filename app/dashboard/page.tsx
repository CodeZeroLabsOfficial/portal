import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { SiteHeader } from "@/components/site-header";
import { APP_NAME, DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrencyAmount } from "@/lib/format";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDashboardData } from "@/server/firestore/portal-data";

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const data = await getDashboardData(user);
  const mrr = formatCurrencyAmount(data.mrrMinorUnits);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <Badge variant="secondary">{APP_NAME}</Badge>
            <Badge variant="outline">{user.role}</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Signed in as {user.email || user.uid}. Metrics are fetched from Firestore mirrors with{" "}
            {DEFAULT_CURRENCY.toUpperCase()} as the default billing currency.
          </p>
          <div className="pt-2">
            <LogoutButton />
          </div>
        </div>

        <Separator className="my-8" />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active subscriptions</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{data.activeSubscriptions}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Synced from Stripe webhook mirror records.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>MRR</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{mrr}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Australian dollars · Stripe invoices + subscriptions
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open proposals</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{data.openProposals}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Draft, sent, and viewed proposals.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversion</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{data.conversionRatePercent}%</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Accepted proposals over closed proposals.
            </CardContent>
          </Card>
        </section>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>
              Feed will aggregate proposal events, invoices, and subscription changes from Firestore.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.recentActivity.length === 0 ? (
              <p className="text-muted-foreground">No activity available yet.</p>
            ) : (
              data.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.timestampMs > 0
                      ? new Date(item.timestampMs).toLocaleDateString("en-AU")
                      : "—"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Link href="/admin" className="underline underline-offset-4">
            Admin console
          </Link>
          {" · "}
          <Link href="/customer" className="underline underline-offset-4">
            Customer portal preview
          </Link>
        </p>
      </main>
    </div>
  );
}
