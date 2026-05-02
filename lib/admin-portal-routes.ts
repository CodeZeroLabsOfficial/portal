export interface AdminPortalNavItem {
  id: "dashboard" | "customers" | "billing" | "tasks";
  href: "/admin" | "/admin/customers" | "/admin/billing" | "/admin/tasks";
  label: string;
  /** Pill shown next to the label (e.g. Beta). */
  badge?: string;
}

export interface AdminPortalNavFooterItem {
  id: "settings" | "contact";
  href: string;
  label: string;
  external?: boolean;
}

export const ADMIN_PORTAL_NAV: AdminPortalNavItem[] = [
  { id: "dashboard", href: "/admin", label: "Dashboard", badge: "Beta" },
  { id: "customers", href: "/admin/customers", label: "Customers" },
  { id: "billing", href: "/admin/billing", label: "Billing" },
  { id: "tasks", href: "/admin/tasks", label: "Tasks" },
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
