import type { ProposalRecord } from "@/types/proposal";

export type ProposalLifecyclePhase = "draft" | "published" | "viewed";

export type ProposalStageBadgeKey =
  | ProposalLifecyclePhase
  | "accepted"
  | "declined"
  | "expired";

/** Shared fill badge colours for proposal status across hub, customer detail, and proposal editor. */
export const PROPOSAL_STAGE_BADGE_CLASS: Record<ProposalStageBadgeKey, string> = {
  draft: "bg-amber-500/10 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  published: "bg-sky-500/10 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
  viewed: "bg-violet-500/10 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200",
  accepted: "bg-emerald-500/15 text-emerald-400",
  declined: "bg-destructive/10 text-destructive dark:text-destructive",
  expired: "bg-muted/50 text-muted-foreground",
};

/** CRM proposal rows: viewed wins over published over draft. */
export function proposalLifecyclePhase(p: ProposalRecord): ProposalLifecyclePhase {
  const viewed =
    p.status === "viewed" ||
    p.status === "accepted" ||
    p.status === "declined" ||
    (typeof p.viewCount === "number" && p.viewCount > 0) ||
    (typeof p.lastViewedAt === "number" && p.lastViewedAt > 0);
  if (viewed) return "viewed";
  if (p.status !== "draft") return "published";
  return "draft";
}

export function getProposalStageBadgeDisplay(p: ProposalRecord): {
  label: string;
  title: string;
  badgeKey: ProposalStageBadgeKey;
  className: string;
} {
  if (p.status === "accepted") {
    return {
      label: "Accepted",
      title: "The client accepted this proposal on the public page.",
      badgeKey: "accepted",
      className: PROPOSAL_STAGE_BADGE_CLASS.accepted,
    };
  }
  if (p.status === "declined") {
    return {
      label: "Declined",
      title: "The client declined this proposal.",
      badgeKey: "declined",
      className: PROPOSAL_STAGE_BADGE_CLASS.declined,
    };
  }
  if (p.status === "expired") {
    return {
      label: "Expired",
      title: "This proposal is no longer active.",
      badgeKey: "expired",
      className: PROPOSAL_STAGE_BADGE_CLASS.expired,
    };
  }
  const phase = proposalLifecyclePhase(p);
  if (phase === "draft") {
    return {
      label: "Draft",
      title: "Draft — not published to a public link yet. Use Publish in the editor when ready.",
      badgeKey: "draft",
      className: PROPOSAL_STAGE_BADGE_CLASS.draft,
    };
  }
  if (phase === "published") {
    return {
      label: "Published",
      title: "Published — public proposal is ready to view; no recorded opens yet.",
      badgeKey: "published",
      className: PROPOSAL_STAGE_BADGE_CLASS.published,
    };
  }
  return {
    label: "Viewed",
    title: "Viewed — recipient has viewed or acted on the public proposal.",
    badgeKey: "viewed",
    className: PROPOSAL_STAGE_BADGE_CLASS.viewed,
  };
}
