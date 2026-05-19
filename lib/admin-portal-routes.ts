export interface AdminPortalNavItem {
  id:
    | "dashboard"
    | "customers"
    | "opportunities"
    | "accounts"
    | "subscriptions"
    | "services"
    | "tasks"
    | "reports"
    | "proposals"
    | "Templates";
  href:
    | "/admin"
    | "/admin/customers"
    | "/admin/opportunities"
    | "/admin/accounts"
    | "/admin/subscriptions"
    | "/admin/services"
    | "/admin/tasks"
    | "/admin/reports"
    | "/admin/proposals"
    | "/admin/templates";
  label: string;
}

export interface AdminPortalNavFooterItem {
  id: "settings";
  href: "/admin/settings";
  label: string;
}

export const ADMIN_PORTAL_NAV: AdminPortalNavItem[] = [
  { id: "dashboard", href: "/admin", label: "Dashboard" },
  { id: "accounts", href: "/admin/accounts", label: "Accounts" },
  { id: "customers", href: "/admin/customers", label: "Customers" },
  { id: "opportunities", href: "/admin/opportunities", label: "Pipeline" },
  { id: "proposals", href: "/admin/proposals", label: "Proposals" },
  { id: "subscriptions", href: "/admin/subscriptions", label: "Subscriptions" },
  { id: "services", href: "/admin/services", label: "Services" },
  { id: "tasks", href: "/admin/tasks", label: "Tasks" },
  { id: "Templates", href: "/admin/templates", label: "Templates" },
  { id: "reports", href: "/admin/reports", label: "Reports" },
];

export const ADMIN_PORTAL_NAV_FOOTER: AdminPortalNavFooterItem[] = [
  { id: "settings", href: "/admin/settings", label: "Settings" },
];

export function isAdminNavActive(item: AdminPortalNavItem, pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const { href, id } = item;
  if (href === "/admin") {
    return normalized === "/admin";
  }
  if (id === "proposals") {
    if (normalized === "/admin/proposals") return true;
    if (!normalized.startsWith("/admin/proposals/")) return false;
    if (normalized.startsWith("/admin/proposals/templates")) return false;
    return true;
  }
  return normalized === href || normalized.startsWith(`${href}/`);
}

export function isAdminFooterNavActive(href: string, pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return normalized === href || normalized.startsWith(`${href}/`);
}
