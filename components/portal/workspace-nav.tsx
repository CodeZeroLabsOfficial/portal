"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  ListTodo,
  Mail,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ADMIN_PORTAL_NAV,
  ADMIN_PORTAL_NAV_FOOTER,
  isAdminFooterNavActive,
  isAdminNavActive,
} from "@/lib/admin-portal-routes";
import { cn } from "@/lib/utils";
import { PORTAL_ROUTE_DEFINITIONS, type PortalRouteDefinition } from "@/lib/portal-routes";

const routeIcons: Record<PortalRouteDefinition["id"], LucideIcon> = {
  dashboard: LayoutDashboard,
  admin: Settings2,
  customer: LifeBuoy,
};

const adminNavIcons: Record<(typeof ADMIN_PORTAL_NAV)[number]["id"], LucideIcon> = {
  dashboard: LayoutDashboard,
  customers: Users,
  billing: CreditCard,
  tasks: ListTodo,
};

const adminFooterIcons: Record<(typeof ADMIN_PORTAL_NAV_FOOTER)[number]["id"], LucideIcon> = {
  settings: Settings2,
  contact: Mail,
};

const sectionLabels = {
  workspace: "Workspace",
  operations: "Operations",
  support: "Support",
} as const;

interface WorkspaceNavProps {
  collapsed?: boolean;
  /** When `admin` or `team`, the admin sidebar is shown on every route (not only under `/admin`). */
  userRole?: string;
}

function isStaffRole(role: string | undefined): boolean {
  return role === "admin" || role === "team";
}

export function WorkspaceNav({ collapsed = false, userRole }: WorkspaceNavProps) {
  const pathname = usePathname();
  const showAdminSidebar = isStaffRole(userRole);

  if (showAdminSidebar) {
    return (
      <nav aria-label="Admin portal navigation" className="flex h-full min-h-0 flex-1 flex-col">
        {!collapsed ? (
          <p className="mb-2.5 shrink-0 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            Admin
          </p>
        ) : null}
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {ADMIN_PORTAL_NAV.map((item) => {
            const Icon = adminNavIcons[item.id];
            const isActive = isAdminNavActive(item.href, pathname);
            return (
              <NavRow
                key={item.href}
                href={item.href}
                label={item.label}
                collapsed={collapsed}
                isActive={isActive}
                badge={
                  item.badge && !collapsed ? (
                    <Badge className="ml-auto h-5 shrink-0 border-0 bg-primary px-2 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                      {item.badge}
                    </Badge>
                  ) : null
                }
              >
                <Icon className={iconClassName(isActive)} aria-hidden />
              </NavRow>
            );
          })}
        </div>

        <div className={cn("mt-8 shrink-0 space-y-0.5 border-t border-white/[0.06] pt-4", collapsed && "mt-4 pt-3")}>
          {ADMIN_PORTAL_NAV_FOOTER.map((item) => {
            const Icon = adminFooterIcons[item.id];
            const isActive = item.external ? false : isAdminFooterNavActive(item.href, pathname);
            if (item.external) {
              return (
                <NavRowExternal
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  collapsed={collapsed}
                  isActive={false}
                >
                  <Icon className={iconClassName(false)} aria-hidden />
                </NavRowExternal>
              );
            }
            return (
              <NavRow
                key={item.href}
                href={item.href}
                label={item.label}
                collapsed={collapsed}
                isActive={isActive}
              >
                <Icon className={iconClassName(isActive)} aria-hidden />
              </NavRow>
            );
          })}
        </div>
      </nav>
    );
  }

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
              return (
                <NavRow
                  key={route.href}
                  href={route.href}
                  label={route.label}
                  collapsed={collapsed}
                  isActive={isActive}
                >
                  <Icon className={iconClassName(isActive)} aria-hidden />
                </NavRow>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function iconClassName(isActive: boolean) {
  return cn(
    "h-[18px] w-[18px] shrink-0 stroke-[1.5]",
    isActive ? "text-primary" : "text-current",
  );
}

function NavRow({
  href,
  label,
  collapsed,
  isActive,
  badge,
  children,
}: {
  href: string;
  label: string;
  collapsed: boolean;
  isActive: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const linkClass = cn(
    "group flex min-h-[40px] w-full items-center gap-3 rounded-lg py-2 transition-colors",
    collapsed ? "justify-center px-2" : "px-3",
    isActive ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
  );

  const linkInner = (
    <>
      {children}
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-none">{label}</span>
          {badge}
        </>
      ) : null}
    </>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} className={linkClass} aria-current={isActive ? "page" : undefined}>
            {linkInner}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="border-white/[0.08] bg-[#1e1e1e] text-white">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={href} className={linkClass} aria-current={isActive ? "page" : undefined}>
      {linkInner}
    </Link>
  );
}

function NavRowExternal({
  href,
  label,
  collapsed,
  isActive,
  children,
}: {
  href: string;
  label: string;
  collapsed: boolean;
  isActive: boolean;
  children: ReactNode;
}) {
  const linkClass = cn(
    "group flex min-h-[40px] w-full items-center gap-3 rounded-lg py-2 transition-colors",
    collapsed ? "justify-center px-2" : "px-3",
    isActive ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
  );

  const linkInner = (
    <>
      {children}
      {!collapsed ? <span className="truncate text-[14px] font-medium leading-none">{label}</span> : null}
    </>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
            {linkInner}
          </a>
        </TooltipTrigger>
        <TooltipContent side="right" className="border-white/[0.08] bg-[#1e1e1e] text-white">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
      {linkInner}
    </a>
  );
}
