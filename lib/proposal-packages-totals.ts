import type {
  PackagesBlock,
  PackagesPublicSelection,
  PricingLineItem,
  ProposalBlock,
  ProposalPublicSelections,
} from "@/types/proposal";
import { effectiveCatalogAddonUnitAmount } from "@/lib/catalog-service-tier";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";

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

/** Contract-style plan total (months × tier monthly rate). */
export function packagePlanContractMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  if (!tier) return 0;
  const months = packageTermMonths(sel);
  const monthly =
    sel.term === "24_months" ? (tier.monthlyCost24Minor ?? 0) : (tier.monthlyCost12Minor ?? 0);
  return monthly * months;
}

/** Per-month recurring total: tier rate plus add-on line totals (each line is a monthly amount). */
export function packageMonthlyTotalMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  if (!tier) return 0;
  const monthly =
    sel.term === "24_months" ? (tier.monthlyCost24Minor ?? 0) : (tier.monthlyCost12Minor ?? 0);
  return monthly + packageAddonsTotalMinor(block, sel);
}

/** Full contract value: plan commitment plus add-ons billed each month for the term. */
export function packageCommitmentTotalMinor(block: PackagesBlock, sel: PackagesPublicSelection): number {
  return packagePlanContractMinor(block, sel) + packageAddonsTotalMinor(block, sel) * packageTermMonths(sel);
}

function addonLineTotal(
  li: PricingLineItem,
  qtyMap: Record<string, number> | undefined,
  term: PackagesPublicSelection["term"] | undefined,
): number {
  const raw = qtyMap?.[li.id];
  const q =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0
      ? Math.floor(raw)
      : effectivePricingLineQuantity(li);
  const unit = effectiveCatalogAddonUnitAmount(li, term);
  return Math.round(unit * q);
}

export interface ProposalDealValueSummary {
  totalMinor: number;
  currency: string;
}

/**
 * Summarise the headline deal value for a proposal: the first packages block's
 * commitment total (tier × term + monthly add-ons × term) from the buyer's
 * persisted public selection only (no tier fallback).
 */
export function computeProposalDealValue(
  blocks: ProposalBlock[],
  selections: ProposalPublicSelections | undefined,
): ProposalDealValueSummary | null {
  for (const block of iterateProposalContentBlocks(blocks)) {
    if (block.type !== "packages") continue;
    if (!block.tiers || block.tiers.length === 0) continue;

    const persisted = selections?.[block.id];
    if (!persisted || persisted.kind !== "packages" || !persisted.tierId) continue;
    const tier = block.tiers.find((t) => t.id === persisted.tierId);
    if (!tier) continue;

    return {
      totalMinor: packageCommitmentTotalMinor(block, persisted),
      currency: block.currency || "aud",
    };
  }
  return null;
}

/** Sum of add-on line totals (per month) using persisted selection and/or live viewer maps. */
export function packageAddonsTotalMinor(
  block: PackagesBlock,
  sel: Pick<PackagesPublicSelection, "addonQuantities" | "term"> | undefined,
  liveQty?: Record<string, number>,
  liveTerm?: PackagesPublicSelection["term"],
): number {
  if (!packagesAddonsSectionActive(block)) return 0;
  const items = block.addonLineItems ?? [];
  const qtyMap = { ...sel?.addonQuantities, ...liveQty };
  const term = liveTerm ?? sel?.term;
  let sum = 0;
  for (const li of items) {
    sum += addonLineTotal(li, qtyMap, term);
  }
  return sum;
}

const LEGACY_PACKAGES_TOTAL_HEADING = /^monthly total$/i;

/** Shown in the packages bottom summary bar when the block has no custom heading. */
export const DEFAULT_PACKAGES_TOTAL_SECTION_LABEL = "Total";

/** Heading for the coloured total bar (legacy “Monthly total” → “Total”). */
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
