import type { CustomerSubscriptionRollup } from "@/types/customer";
import type { SubscriptionStatus } from "@/types/subscription";

/** Shared fill badge colours for subscription status across hub and customer list. */
export function getSubscriptionStatusBadgeDisplay(
  status: SubscriptionStatus | CustomerSubscriptionRollup,
): { label: string; className: string } {
  if (status === "none") {
    return { label: "No subscription", className: "bg-muted text-muted-foreground" };
  }
  if (status === "active" || status === "trialing") {
    return {
      label: status === "trialing" ? "Trialing" : "Active",
      className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    };
  }
  if (status === "scheduled") {
    return {
      label: "Scheduled",
      className: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    };
  }
  if (status === "past_due" || status === "unpaid") {
    return {
      label: status === "past_due" ? "Past due" : "Unpaid",
      className: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }
  if (status === "canceled") {
    return { label: "Canceled", className: "bg-muted/50 text-muted-foreground" };
  }
  if (status === "paused") {
    return { label: "Paused", className: "bg-muted/40 text-muted-foreground" };
  }
  return {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "bg-muted/40 text-muted-foreground",
  };
}
