import type {
  PackagesBlock,
  PackagesPublicSelection,
  PricingLineItem,
  ProposalBlock,
  ProposalPublicSelections,
} from "@/types/proposal";
import { effectiveCatalogAddonUnitAmount } from "@/lib/catalog-service-tier";
import {
  addonQuantityForSelection,
  resolveProposalAddonBillingKind,
} from "@/lib/proposal-addon-billing";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import type { CatalogServicePickerOption } from "@/types/catalog-service";

/** Whether add-ons contribute to UI and billing for this block. */
export function packagesAddonsSectionActive(block: PackagesBlock): boolean {
  if (block.addonsSectionEnabled === true) return true;
  if (block.addonsSectionEnabled === false) return false;
  return (block.addonLineItems ?? []).length > 0;
}

export function packageTermMonths(sel: Pick<PackagesPublicSelection, "term">): number {
  return sel.term === "24_months" ? 24 : 12;
}

/** Human label for the selected billing term (uses block copy or generic “12/24 months”). */
export function packagesSelectionTermLabel(
  block: PackagesBlock,
  term: PackagesPublicSelection["term"],
): string {
  if (term === "24_months") return block.plan24Label?.trim() || "24 months";
  return block.plan12Label?.trim() || "12 months";
}

/** One-time upfront on the 12-month plan term only. */
export function packageTierUpfrontMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  if (sel.term !== "12_months") return 0;
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  if (!tier || typeof tier.upfrontCost12Minor !== "number" || tier.upfrontCost12Minor <= 0) {
    return 0;
  }
  return Math.round(tier.upfrontCost12Minor);
}

/** Contract-style plan total (months × tier monthly rate). */
export function packagePlanContractMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  if (!tier) return 0;
  const months = packageTermMonths(sel);
  const monthly =
    sel.term === "24_months" ? (tier.monthlyCost24Minor ?? 0) : (tier.monthlyCost12Minor ?? 0);
  return monthly * months;
}

function addonLineTotal(
  li: PricingLineItem,
  qtyMap: Record<string, number> | undefined,
  term: PackagesPublicSelection["term"] | undefined,
  catalogServices?: readonly CatalogServicePickerOption[],
  billingFilter?: "recurring" | "one_off",
): number {
  const kind = resolveProposalAddonBillingKind(li, catalogServices);
  if (billingFilter === "recurring" && kind === "one_off") return 0;
  if (billingFilter === "one_off" && kind !== "one_off") return 0;

  const raw = qtyMap?.[li.id];
  const q =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0
      ? Math.floor(raw)
      : effectivePricingLineQuantity(li);
  const unit = effectiveCatalogAddonUnitAmount(li, term);
  const lineTotal = Math.round(unit * q);
  if (billingFilter === "one_off") return lineTotal;
  return lineTotal;
}

/** Recurring add-on lines only (per month). */
export function packageRecurringAddonsTotalMinor(
  block: PackagesBlock,
  sel: Pick<PackagesPublicSelection, "addonQuantities" | "term"> | undefined,
  liveQty?: Record<string, number>,
  liveTerm?: PackagesPublicSelection["term"],
  catalogServices?: readonly CatalogServicePickerOption[],
): number {
  if (!packagesAddonsSectionActive(block)) return 0;
  const items = block.addonLineItems ?? [];
  const qtyMap = { ...sel?.addonQuantities, ...liveQty };
  const term = liveTerm ?? sel?.term;
  let sum = 0;
  for (const li of items) {
    sum += addonLineTotal(li, qtyMap, term, catalogServices, "recurring");
  }
  return sum;
}

/** One-off catalogue add-ons (charged once, not × term). */
export function packageOneOffAddonsTotalMinor(
  block: PackagesBlock,
  sel: Pick<PackagesPublicSelection, "addonQuantities" | "term"> | undefined,
  liveQty?: Record<string, number>,
  liveTerm?: PackagesPublicSelection["term"],
  catalogServices?: readonly CatalogServicePickerOption[],
): number {
  if (!packagesAddonsSectionActive(block)) return 0;
  const items = block.addonLineItems ?? [];
  const qtyMap = { ...sel?.addonQuantities, ...liveQty };
  const term = liveTerm ?? sel?.term;
  let sum = 0;
  for (const li of items) {
    sum += addonLineTotal(li, qtyMap, term, catalogServices, "one_off");
  }
  return sum;
}

/** @deprecated Use {@link packageRecurringAddonsTotalMinor} — sums all add-ons as monthly when catalogue omitted. */
export function packageAddonsTotalMinor(
  block: PackagesBlock,
  sel: Pick<PackagesPublicSelection, "addonQuantities" | "term"> | undefined,
  liveQty?: Record<string, number>,
  liveTerm?: PackagesPublicSelection["term"],
  catalogServices?: readonly CatalogServicePickerOption[],
): number {
  return (
    packageRecurringAddonsTotalMinor(block, sel, liveQty, liveTerm, catalogServices) +
    packageOneOffAddonsTotalMinor(block, sel, liveQty, liveTerm, catalogServices)
  );
}

/** Per-month recurring total: tier rate plus recurring add-ons only. */
export function packageMonthlyTotalMinor(
  block: PackagesBlock,
  sel: PackagesPublicSelection,
  liveQty?: Record<string, number>,
  liveTerm?: PackagesPublicSelection["term"],
  catalogServices?: readonly CatalogServicePickerOption[],
): number {
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  if (!tier) return 0;
  const monthly =
    sel.term === "24_months" ? (tier.monthlyCost24Minor ?? 0) : (tier.monthlyCost12Minor ?? 0);
  return monthly + packageRecurringAddonsTotalMinor(block, sel, liveQty, liveTerm, catalogServices);
}

/** Full contract value including recurring commitment, one-off add-ons, and upfront. */
export function packageCommitmentTotalMinor(
  block: PackagesBlock,
  sel: PackagesPublicSelection,
  catalogServices?: readonly CatalogServicePickerOption[],
): number {
  const months = packageTermMonths(sel);
  return (
    packagePlanContractMinor(block, sel) +
    packageRecurringAddonsTotalMinor(block, sel, undefined, undefined, catalogServices) * months +
    packageOneOffAddonsTotalMinor(block, sel, undefined, undefined, catalogServices) +
    packageTierUpfrontMinor(block, sel)
  );
}

export interface ProposalDealValueSummary {
  totalMinor: number;
  currency: string;
}

/**
 * Summarise the headline deal value for a proposal: the first packages block's
 * commitment total from the buyer's persisted public selection only.
 */
export function computeProposalDealValue(
  blocks: ProposalBlock[],
  selections: ProposalPublicSelections | undefined,
  catalogServices?: readonly CatalogServicePickerOption[],
): ProposalDealValueSummary | null {
  for (const block of iterateProposalContentBlocks(blocks)) {
    if (block.type !== "packages") continue;
    if (!block.tiers || block.tiers.length === 0) continue;

    const persisted = selections?.[block.id];
    if (!persisted || persisted.kind !== "packages" || !persisted.tierId) continue;
    const tier = block.tiers.find((t) => t.id === persisted.tierId);
    if (!tier) continue;

    return {
      totalMinor: packageCommitmentTotalMinor(block, persisted, catalogServices),
      currency: block.currency || "aud",
    };
  }
  return null;
}

const LEGACY_PACKAGES_TOTAL_HEADING = /^monthly total$/i;

/** Shown in the packages bottom summary bar when the block has no custom heading. */
export const DEFAULT_PACKAGES_TOTAL_SECTION_LABEL = "Total";

/** Heading for the coloured total summary bar (legacy “Monthly total” → “Total”). */
export function resolvePackagesTotalSectionLabel(raw: string | undefined | null): string {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t || LEGACY_PACKAGES_TOTAL_HEADING.test(t)) return DEFAULT_PACKAGES_TOTAL_SECTION_LABEL;
  return t;
}

/** Persisted `totalSectionLabel`: empty and legacy wording are stored as absent. */
export function normalizePackagesTotalSectionLabelForPersistence(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, 120);
  if (!t || LEGACY_PACKAGES_TOTAL_HEADING.test(t)) return undefined;
  return t;
}
