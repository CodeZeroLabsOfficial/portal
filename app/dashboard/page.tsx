import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { APP_NAME, DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrencyAmount } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
  const mrr = formatCurrencyAmount(84_200_00);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <Badge variant="secondary">{APP_NAME}</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Overview metrics load from Firestore and Stripe-backed mirrors. Currency defaults to{" "}
            {DEFAULT_CURRENCY.toUpperCase()}.
          </p>
        </div>

        <Separator className="my-8" />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active subscriptions</CardDescription>
              <CardTitle className="text-3xl tabular-nums">128</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Placeholder · sync via webhooks</CardContent>
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
              <CardTitle className="text-3xl tabular-nums">24</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Draft + sent awaiting response</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversion</CardDescription>
              <CardTitle className="text-3xl tabular-nums">38%</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Accepted ÷ viewed · analytics pipeline next
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
          <CardContent className="text-sm text-muted-foreground">
            No activity yet — connect Firebase reads and Stripe webhooks to populate this list.
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
