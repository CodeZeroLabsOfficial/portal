"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, LayoutDashboard, Settings2, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

interface WorkspaceNavProps {
  collapsed?: boolean;
}

export function WorkspaceNav({ collapsed = false }: WorkspaceNavProps) {
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
    <nav aria-label="Portal navigation" className="space-y-6">
      {Object.entries(sectionedRoutes).map(([section, routes]) => (
        <div key={section} className="space-y-1">
          {!collapsed ? (
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              {sectionLabels[section as PortalRouteDefinition["section"]]}
            </p>
          ) : null}
          <div className="space-y-1">
            {routes.map((route) => {
              const Icon = routeIcons[route.id];
              const isActive = pathname === route.href;

              const linkClass = cn(
                "group flex items-center gap-3 rounded-lg py-2.5 transition-colors",
                collapsed ? "justify-center px-2" : "px-3",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
              );

              const iconClass = cn(
                "h-[22px] w-[22px] shrink-0 stroke-[1.75]",
                isActive ? "text-[#4db6ac]" : "text-current",
              );

              const linkInner = (
                <>
                  <Icon className={iconClass} aria-hidden />
                  {!collapsed ? (
                    <span className="truncate text-sm font-medium">{route.label}</span>
                  ) : null}
                </>
              );

              if (collapsed) {
                return (
                  <Tooltip key={route.href}>
                    <TooltipTrigger asChild>
                      <Link href={route.href} className={linkClass} aria-current={isActive ? "page" : undefined}>
                        {linkInner}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="border-white/[0.08] bg-[#1e1e1e] text-white">
                      {route.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={linkClass}
                  aria-current={isActive ? "page" : undefined}
                >
                  {linkInner}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
