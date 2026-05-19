"use client";

import { CreditCard, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import type { CatalogServiceRecord, CatalogServiceStatus } from "@/types/catalog-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function stripeLinked(service: CatalogServiceRecord): boolean {
  return Boolean(service.stripeProductId?.trim());
}

function stripeStatusLabel(service: CatalogServiceRecord): string {
  if (!stripeLinked(service)) return "Not synced";
  if (service.stripeSyncedAt) return "Synced";
  return "Linked";
}

export interface CatalogServiceStripeIntegrationsCardProps {
  service: CatalogServiceRecord;
  busy: boolean;
  readOnly: boolean;
  onActivateSync?: () => void;
  onResync?: () => void;
  className?: string;
}

export function CatalogServiceStripeIntegrationsCard({
  service,
  busy,
  readOnly,
  onActivateSync,
  onResync,
  className,
}: CatalogServiceStripeIntegrationsCardProps) {
  const linked = stripeLinked(service);
  const status = service.status as CatalogServiceStatus;

  return (
    <Card className={cn("border-border/80 bg-card/80 shadow-sm", className)}>
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden />
          Integrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 text-sm">
        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <span className="text-muted-foreground">Stripe</span>
              {service.stripeSyncedAt ? (
                <p className="text-xs text-muted-foreground">
                  Last synced{" "}
                  {new Date(service.stripeSyncedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : !linked ? (
                <p className="text-xs text-muted-foreground">
                  Activate or re-sync to create the product and prices in Stripe.
                </p>
              ) : null}
            </div>
            {linked ? (
              <Badge variant="outline" className="shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                {stripeStatusLabel(service)}
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                Not synced
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {service.stripeProductId?.trim() ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5"
              disabled={busy}
              onClick={() =>
                window.open(`https://dashboard.stripe.com/products/${service.stripeProductId}`, "_blank")
              }
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              Open in Stripe
            </Button>
          ) : null}
          {status === "draft" && onActivateSync ? (
            <Button
              type="button"
              size="sm"
              className="w-full justify-center gap-1.5"
              disabled={busy || readOnly}
              onClick={onActivateSync}
            >
              {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              Activate & sync
            </Button>
          ) : null}
          {status === "active" && onResync ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-center gap-1.5"
              disabled={busy || readOnly}
              onClick={onResync}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
              )}
              Re-sync Stripe
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
