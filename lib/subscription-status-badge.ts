import type { CustomerSubscriptionRollup } from "@/types/customer";
import type { SubscriptionStatus } from "@/types/subscription";

/** Shared fill badge colours for subscription status (customer list, subscriptions hub). */
export function getSubscriptionStatusBadgeDisplay(
  status: SubscriptionStatus | CustomerSubscriptionRollup,
): { label: string; className: string } {
  if (status === "none") {
    return { label: "No subscription", className: "bg-muted text-muted-foreground" };
  }
  if (status === "active" || status === "trialing") {
    return {
      label: status === "trialing" ? "Trialing" : "Active",
      className: "bg-emerald-500/15 text-emerald-400",
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
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (status === "canceled") {
    return { label: "Canceled", className: "bg-muted text-muted-foreground" };
  }
  if (status === "paused") {
    return { label: "Paused", className: "bg-muted text-muted-foreground" };
  }
  return {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "bg-muted text-muted-foreground",
  };
}

/** Payment-collection pause — violet fill, subscriptions list only. */
export function getSubscriptionPausedBadgeDisplay(): { label: string; className: string } {
  return {
    label: "Paused",
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  };
}
