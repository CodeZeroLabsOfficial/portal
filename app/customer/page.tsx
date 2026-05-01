import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomerPortalPage() {
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Billing</CardTitle>
              <CardDescription>Stripe Customer Portal entry point and invoice downloads.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Wire portal session API next.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proposals</CardTitle>
              <CardDescription>Proposals shared with this customer and acceptance status.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Coming in the next iteration.</CardContent>
          </Card>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Link href="/" className="underline underline-offset-4">
            Home
          </Link>
        </p>
      </main>
    </div>
  );
}
