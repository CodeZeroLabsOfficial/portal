export interface AdminPortalNavItem {
  id: "dashboard" | "customers" | "opportunities" | "accounts" | "billing" | "tasks" | "reports" | "proposals";
  href:
    | "/admin"
    | "/admin/customers"
    | "/admin/opportunities"
    | "/admin/accounts"
    | "/admin/billing"
    | "/admin/tasks"
    | "/admin/reports"
    | "/admin/proposals";
  label: string;
}

export interface AdminPortalNavFooterItem {
  id: "settings" | "contact";
  href: string;
  label: string;
  external?: boolean;
}

export const ADMIN_PORTAL_NAV: AdminPortalNavItem[] = [
  { id: "dashboard", href: "/admin", label: "Dashboard" },
  { id: "customers", href: "/admin/customers", label: "Customers" },
  { id: "opportunities", href: "/admin/opportunities", label: "Pipeline" },
  { id: "proposals", href: "/admin/proposals", label: "Proposals" },
  { id: "accounts", href: "/admin/accounts", label: "Accounts" },
  { id: "billing", href: "/admin/billing", label: "Billing" },
  { id: "tasks", href: "/admin/tasks", label: "Tasks" },
  { id: "reports", href: "/admin/reports", label: "Reports" },
];

export const ADMIN_PORTAL_NAV_FOOTER: AdminPortalNavFooterItem[] = [
  { id: "settings", href: "/admin/settings", label: "Settings" },
  {
    id: "contact",
    href: "https://codezerolabs.com.au",
    label: "Contact",
    external: true,
  },
];

export function isAdminNavActive(href: AdminPortalNavItem["href"], pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (href === "/admin") {
    return normalized === "/admin";
  }
  return normalized === href || normalized.startsWith(`${href}/`);
}

export function isAdminFooterNavActive(href: string, pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (href === "/admin/settings") {
    return normalized === "/admin/settings";
  }
  return false;
}
