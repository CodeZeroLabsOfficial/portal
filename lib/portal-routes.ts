export type PortalRouteSection = "workspace" | "operations" | "support";

export interface PortalRouteMetric {
  label: string;
  value: string;
}

export interface PortalRouteDefinition {
  id: "dashboard" | "admin" | "customer";
  href: "/dashboard" | "/admin" | "/customer";
  label: string;
  description: string;
  section: PortalRouteSection;
  previewMetrics: PortalRouteMetric[];
}

export const PORTAL_ROUTE_DEFINITIONS: PortalRouteDefinition[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Overview",
    description: "Shared success metrics, health, and activity.",
    section: "workspace",
    previewMetrics: [
      { label: "MRR", value: "Live" },
      { label: "Activity", value: "8 recent" },
    ],
  },
  {
    id: "admin",
    href: "/admin",
    label: "Operations",
    description: "Manage customers, subscriptions, and proposals.",
    section: "operations",
    previewMetrics: [
      { label: "Customers", value: "Segmented" },
      { label: "Proposals", value: "Pipeline" },
    ],
  },
  {
    id: "customer",
    href: "/customer",
    label: "Customer Portal",
    description: "Account billing and proposal visibility.",
    section: "support",
    previewMetrics: [
      { label: "Invoices", value: "Latest first" },
      { label: "Billing", value: "Self-serve" },
    ],
  },
];

export function getPortalRouteByHref(href: string): PortalRouteDefinition | undefined {
  return PORTAL_ROUTE_DEFINITIONS.find((route) => route.href === href);
}
