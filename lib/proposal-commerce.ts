import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import {
  addonQuantityForSelection,
  catalogServiceForAddonLine,
  resolveCatalogAddonStripePriceId,
  resolveProposalAddonBillingKind,
} from "@/lib/proposal-addon-billing";
import { effectiveCatalogAddonUnitAmount } from "@/lib/catalog-service-tier";
import {
  packagesTermToDurationMonths,
  resolveFirstPackageSubscriptionFromProposal,
  resolveStripePriceIdFromTierForBilling,
  type ResolvedPackageSubscriptionPick,
} from "@/lib/proposal-subscription-from-catalog";
import {
  packageMonthlyTotalMinor,
  packageOneOffAddonsTotalMinor,
  packageRecurringAddonsTotalMinor,
  packageTierUpfrontMinor,
  packagesAddonsSectionActive,
} from "@/lib/proposal-packages-totals";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { SubscriptionProductOption } from "@/types/subscription-product";
import type {
  PackagesBlock,
  PackagesPublicSelection,
  ProposalBlock,
  ProposalRecord,
} from "@/types/proposal";

export interface ProposalStripeSubscriptionItem {
  priceId: string;
  quantity: number;
  label: string;
}

/** One-time charge — Stripe Price when synced, else ad-hoc amount on an invoice. */
export interface ProposalStripeOneOffItem {
  priceId?: string;
  amountMinor?: number;
  quantity: number;
  currency: string;
  description: string;
}

export interface ResolvedProposalCommerce {
  pick: ResolvedPackageSubscriptionPick | null;
  subscriptionItems: ProposalStripeSubscriptionItem[];
  oneOffItems: ProposalStripeOneOffItem[];
  /** Recurring plan + add-ons per month (excludes one-off add-ons and upfront). */
  recurringMonthlyTotalMinor: number;
  oneOffTotalMinor: number;
  currency: string;
  /** Blocking issues when Stripe billing was requested (missing prices, manual add-ons). */
  billingErrors: string[];
}

function resolvePackageCommerce(
  block: PackagesBlock,
  sel: PackagesPublicSelection,
  catalogServices: CatalogServicePickerOption[],
  stripeProductCatalog: SubscriptionProductOption[],
): Omit<ResolvedProposalCommerce, "pick"> & { pick: ResolvedPackageSubscriptionPick | null } {
  const currency = (block.currency || "aud").toLowerCase();
  const tier = block.tiers.find((t) => t.id === sel.tierId);
  const planPriceId = resolveStripePriceIdFromTierForBilling(
    tier,
    sel.term,
    catalogServices,
    stripeProductCatalog,
  );

  const serviceId = tier?.serviceId?.trim();
  const productName =
    (serviceId && catalogServices.find((s) => s.serviceId === serviceId)?.serviceName) ||
    (tier?.stripeProductId &&
      stripeProductCatalog.find((p) => p.productId === tier.stripeProductId)?.productName) ||
    tier?.name?.trim() ||
    "Plan";

  const pick: ResolvedPackageSubscriptionPick | null = planPriceId
    ? {
        priceId: planPriceId,
        durationMonths: packagesTermToDurationMonths(sel.term),
        productName,
        tierName: tier?.name?.trim() || "Plan",
        blockTitle: block.title?.trim() || "Plans",
      }
    : null;

  const subscriptionItems: ProposalStripeSubscriptionItem[] = [];
  const oneOffItems: ProposalStripeOneOffItem[] = [];
  const billingErrors: string[] = [];

  if (pick) {
    subscriptionItems.push({
      priceId: pick.priceId,
      quantity: 1,
      label: pick.tierName,
    });
  } else if (tier) {
    billingErrors.push(
      `Plan “${tier.name?.trim() || "Plan"}” is not linked to a synced catalogue service or Stripe price.`,
    );
  }

  const upfront = packageTierUpfrontMinor(block, sel);
  if (upfront > 0) {
    oneOffItems.push({
      amountMinor: upfront,
      quantity: 1,
      currency,
      description: `${tier?.name?.trim() || "Plan"} — upfront fee`,
    });
  }

  if (packagesAddonsSectionActive(block)) {
    for (const line of block.addonLineItems ?? []) {
      const quantity = addonQuantityForSelection(line, sel);
      if (quantity <= 0) continue;

      const label = line.label?.trim() || "Add-on";
      const kind = resolveProposalAddonBillingKind(line, catalogServices);
      const service = catalogServiceForAddonLine(line, catalogServices);

      if (kind === "one_off") {
        if (!service) {
          billingErrors.push(`Add-on “${label}” is not linked to the catalogue.`);
          continue;
        }
        const priceId = resolveCatalogAddonStripePriceId(service, sel.term);
        if (!priceId) {
          billingErrors.push(`Add-on “${label}” is not synced to Stripe. Activate it in Services.`);
          continue;
        }
        oneOffItems.push({ priceId, quantity, currency, description: label });
        continue;
      }

      if (kind === "recurring" && service) {
        const priceId = resolveCatalogAddonStripePriceId(service, sel.term);
        if (!priceId) {
          billingErrors.push(`Add-on “${label}” is not synced to Stripe. Activate it in Services.`);
          continue;
        }
        subscriptionItems.push({ priceId, quantity, label });
        continue;
      }

      if (kind === "manual_recurring") {
        const unit = effectiveCatalogAddonUnitAmount(line, sel.term);
        const amountMinor = Math.round(unit * quantity);
        if (amountMinor > 0) {
          billingErrors.push(
            `Add-on “${label}” is not catalogue-linked — sync a recurring add-on service or remove it before automated billing.`,
          );
        }
      }
    }
  }

  const recurringMonthlyTotalMinor = packageMonthlyTotalMinor(block, sel, undefined, undefined, catalogServices);
  const oneOffTotalMinor =
    packageTierUpfrontMinor(block, sel) +
    packageOneOffAddonsTotalMinor(block, sel, undefined, undefined, catalogServices);

  return {
    pick,
    subscriptionItems,
    oneOffItems,
    recurringMonthlyTotalMinor,
    oneOffTotalMinor,
    currency,
    billingErrors,
  };
}

/** Commerce for the first packages block with a buyer selection (matches subscription pick). */
export function resolveProposalCommerce(
  proposal: {
    document: { blocks: ProposalBlock[] };
    publicSelections?: Record<string, PackagesPublicSelection>;
  },
  catalogServices: CatalogServicePickerOption[],
  stripeProductCatalog: SubscriptionProductOption[] = [],
): ResolvedProposalCommerce | null {
  const selections = proposal.publicSelections ?? {};
  for (const block of iterateProposalContentBlocks(proposal.document.blocks)) {
    if (block.type !== "packages") continue;
    const pb = block as PackagesBlock;
    const sel = selections[pb.id];
    if (!sel || sel.kind !== "packages" || !sel.tierId) continue;
    const tier = pb.tiers.find((t) => t.id === sel.tierId);
    if (!tier) continue;
    return resolvePackageCommerce(pb, sel, catalogServices, stripeProductCatalog);
  }
  return null;
}

/** @deprecated Prefer {@link resolveProposalCommerce}; kept for callers that only need the plan price. */
export function resolveFirstPackageSubscriptionFromProposalWithCommerce(
  proposal: ProposalRecord,
  catalogServices: CatalogServicePickerOption[],
  stripeProductCatalog: SubscriptionProductOption[] = [],
): ResolvedPackageSubscriptionPick | null {
  return (
    resolveProposalCommerce(proposal, catalogServices, stripeProductCatalog)?.pick ??
    resolveFirstPackageSubscriptionFromProposal(proposal, catalogServices, stripeProductCatalog)
  );
}
