"use client";

import Link from "next/link";
import type { CatalogServiceRecord } from "@/types/catalog-service";
import { formatCurrencyAmount } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";

const STATUS_BADGE: Record<CatalogServiceRecord["status"], string> = {
  draft: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  archived: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
};

function termMinor(service: CatalogServiceRecord, months: 12 | 24): number {
  return service.terms.find((t) => t.months === months)?.monthlyAmountMinor ?? 0;
}

export interface CatalogServicesListPanelProps {
  services: CatalogServiceRecord[];
}

export function CatalogServicesListPanel({ services }: CatalogServicesListPanelProps) {
  const visible = services.filter((s) => s.status !== "archived");

  return (
    <div className="space-y-6">
      <div>
        <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Services</h1>
        <p className={cn(WORKSPACE_PAGE_DESCRIPTION_CLASS, "mt-1 max-w-2xl")}>
          Define sellable plans here. Activate a service to create Stripe Products and Prices; link them in
          proposal Plans blocks and subscriptions.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services yet. Create one to get started.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">12 mo / mo</th>
                <th className="px-4 py-3 font-medium">24 mo / mo</th>
                <th className="px-4 py-3 font-medium">Stripe</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((service) => (
                <tr key={service.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/services/${service.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {service.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn(STATUS_BADGE[service.status])}>
                      {service.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCurrencyAmount(termMinor(service, 12), service.currency)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCurrencyAmount(termMinor(service, 24), service.currency)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {service.stripeProductId ? "Synced" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
