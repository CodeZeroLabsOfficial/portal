"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, LayoutDashboard, Settings2, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PORTAL_ROUTE_DEFINITIONS, type PortalRouteDefinition } from "@/lib/portal-routes";

const routeIcons: Record<PortalRouteDefinition["id"], LucideIcon> = {
  dashboard: LayoutDashboard,
  admin: Settings2,
  customer: LifeBuoy,
};

const sectionLabels = {
  workspace: "Workspace",
  operations: "Operations",
  support: "Support",
} as const;

export function WorkspaceNav() {
  const pathname = usePathname();

  const sectionedRoutes = PORTAL_ROUTE_DEFINITIONS.reduce<
    Record<PortalRouteDefinition["section"], PortalRouteDefinition[]>
  >(
    (accumulator, route) => {
      accumulator[route.section].push(route);
      return accumulator;
    },
    {
      workspace: [],
      operations: [],
      support: [],
    },
  );

  return (
    <nav aria-label="Portal navigation" className="space-y-5">
      {Object.entries(sectionedRoutes).map(([section, routes]) => (
        <div key={section} className="space-y-2">
          <p className="px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {sectionLabels[section as PortalRouteDefinition["section"]]}
          </p>
          <div className="space-y-1">
            {routes.map((route) => {
              const Icon = routeIcons[route.id];
              const isActive = pathname === route.href;
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={cn(
                    "block rounded-lg border px-3 py-3 transition-colors",
                    isActive
                      ? "border-border bg-accent text-accent-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-background text-muted-foreground">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{route.label}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{route.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {route.previewMetrics.map((metric) => (
                          <Badge key={`${route.id}-${metric.label}`} variant="outline" className="text-[10px]">
                            {metric.label}: {metric.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
