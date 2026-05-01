import Link from "next/link";
import { ArrowRight, LineChart, Shield, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { APP_NAME, DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrencyAmount } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const sampleMrr = formatCurrencyAmount(128_400_00);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">
              Australia · {DEFAULT_CURRENCY.toUpperCase()} billing
            </Badge>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
              Subscriptions and proposals, unified.
            </h1>
            <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">
              {APP_NAME} brings Stripe-backed billing, Firestore-backed collaboration, and
              Qwilr-style interactive proposals into one fast, accessible web experience for your
              team and customers.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Open console <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard">View dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-3">
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <Sparkles className="mb-2 h-5 w-5 text-primary" aria-hidden />
                <CardTitle className="text-base">Live proposals</CardTitle>
                <CardDescription>
                  Branded web proposals with dynamic pricing, signatures, and in-flow payments.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <LineChart className="mb-2 h-5 w-5 text-primary" aria-hidden />
                <CardTitle className="text-base">Engagement analytics</CardTitle>
                <CardDescription>
                  Track views, time on page, and section-level engagement to improve conversion.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/60">
              <CardHeader>
                <Shield className="mb-2 h-5 w-5 text-primary" aria-hidden />
                <CardTitle className="text-base">Roles &amp; access</CardTitle>
                <CardDescription>
                  Admin, team, and customer portals with Firebase Auth aligned to your iOS app.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Card className="mx-auto mt-10 max-w-3xl border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Sample metric</CardTitle>
              <CardDescription>
                Currency formatting defaults to Australian dollars in the product shell (
                {sampleMrr} indicative MRR placeholder).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Next steps: connect Firebase env vars, exchange ID tokens for session cookies, and
                wire Stripe webhooks to Firestore mirrors.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Code Zero Labs. Internal and customer-facing portal.
      </footer>
    </div>
  );
}
