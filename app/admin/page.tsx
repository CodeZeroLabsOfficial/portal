import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminHomePage() {
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customers &amp; subscriptions</CardTitle>
              <CardDescription>List organisations, plans, and Stripe Customer Portal links.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Coming in the next iteration.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proposals</CardTitle>
              <CardDescription>Template library, builder, and engagement reporting.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Coming in the next iteration.</CardContent>
          </Card>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Link href="/dashboard" className="underline underline-offset-4">
            Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
