import { redirect } from "next/navigation";
import { ArrowUpRight, BarChart3, CircleCheck, FileText, WalletCards } from "lucide-react";
import { APP_NAME, DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrencyAmount } from "@/lib/format";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/server/firestore/portal-data";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const data = await getDashboardData(user);
  const mrr = formatCurrencyAmount(data.mrrMinorUnits);

  return (
    <WorkspaceShell
      title="CSM Dashboard"
      description="Unified billing, proposal, and activity monitoring."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Signed in as {user.email || user.uid}. Workspace metrics are mirrored from Firestore
                with {DEFAULT_CURRENCY.toUpperCase()} as the billing currency baseline.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{APP_NAME}</Badge>
              <Badge variant="outline">Live data sync</Badge>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 bg-card/90">
            <CardHeader className="pb-2">
              <WalletCards className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardDescription>Active subscriptions</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{data.activeSubscriptions}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Synced from Stripe webhook mirror records.
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader className="pb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardDescription>MRR</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{mrr}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Australian dollars · Stripe invoices + subscriptions
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader className="pb-2">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardDescription>Open proposals</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{data.openProposals}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Draft, sent, and viewed proposals.
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader className="pb-2">
              <CircleCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardDescription>Conversion</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{data.conversionRatePercent}%</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Accepted proposals over closed proposals.
            </CardContent>
          </Card>
        </section>

        <Card className="border-border/70 bg-card/90">
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
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2.5"
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
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-base">Workflow posture</CardTitle>
              <CardDescription>
                Balanced between revenue tracking and proposal execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Pipeline is hydrated from subscriptions, invoices, and proposals in one timeline.</p>
              <p>Use Operations to manage customers and Customer Portal for account-specific billing.</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Next actions
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardTitle>
              <CardDescription>Suggested cadence from this dashboard state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Review open proposals with stale activity first to improve conversion velocity.</p>
              <p>Validate subscription statuses against Stripe webhook mirrors before finance close.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </WorkspaceShell>
  );
}
