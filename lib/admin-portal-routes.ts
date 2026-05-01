export interface AdminPortalNavItem {
  id: "dashboard" | "customers" | "billing" | "tasks";
  href: "/admin" | "/admin/customers" | "/admin/billing" | "/admin/tasks";
  label: string;
}

export const ADMIN_PORTAL_NAV: AdminPortalNavItem[] = [
  { id: "dashboard", href: "/admin", label: "Dashboard" },
  { id: "customers", href: "/admin/customers", label: "Customers" },
  { id: "billing", href: "/admin/billing", label: "Billing" },
  { id: "tasks", href: "/admin/tasks", label: "Tasks" },
];

export function isAdminNavActive(href: AdminPortalNavItem["href"], pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (href === "/admin") {
    return normalized === "/admin";
  }
  return normalized === href || normalized.startsWith(`${href}/`);
}
