import { resolveStripePriceIdFromTier } from "@/lib/catalog-service-resolve";
import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import type {
  PackageTier,
  PackagesBlock,
  PackagesPublicSelection,
  ProposalBlock,
} from "@/types/proposal";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { SubscriptionProductOption } from "@/types/subscription-product";

/** Map proposal package term to commitment length (matches Add subscription “Duration”). */
export function packagesTermToDurationMonths(term: PackagesPublicSelection["term"]): 12 | 24 {
  return term === "24_months" ? 24 : 12;
}

/**
 * Resolves Stripe `price_…` from a tier using the same catalog as the admin
 * “Add subscription” modal: optional legacy `stripePriceId`, otherwise
 * `stripeProductId` + term months → matching recurring price on that product.
 */
export function resolveStripePriceIdFromTierWithCatalog(
  tier: PackageTier | undefined,
  term: PackagesPublicSelection["term"],
  catalog: SubscriptionProductOption[],
): string | null {
  if (!tier) return null;
  const legacy = tier.stripePriceId?.trim();
  if (legacy?.startsWith("price_")) return legacy;

  const productId = tier.stripeProductId?.trim();
  if (!productId || catalog.length === 0) return null;

  const product = catalog.find((p) => p.productId === productId);
  if (!product) return null;

  const months = packagesTermToDurationMonths(term);
  const duration = product.durations.find((d) => d.months === months);
  const pid = duration?.priceId?.trim();
  return pid?.startsWith("price_") ? pid : null;
}

export function resolveStripePriceIdFromTierForBilling(
  tier: PackageTier | undefined,
  term: PackagesPublicSelection["term"],
  catalogServices: CatalogServicePickerOption[],
  stripeProductCatalog: SubscriptionProductOption[] = [],
): string | null {
  return resolveStripePriceIdFromTier(tier, term, catalogServices, stripeProductCatalog);
}

export interface ResolvedPackageSubscriptionPick {
  priceId: string;
  durationMonths: 12 | 24;
  productName: string;
  tierName: string;
  blockTitle: string;
}

/** First packages block with a valid selection and resolvable Stripe price. */
export function resolveFirstPackageSubscriptionFromProposal(
  proposal: { document: { blocks: ProposalBlock[] }; publicSelections?: Record<string, PackagesPublicSelection> },
  catalogServices: CatalogServicePickerOption[],
  stripeProductCatalog: SubscriptionProductOption[] = [],
): ResolvedPackageSubscriptionPick | null {
  const selections = proposal.publicSelections ?? {};
  for (const block of iterateProposalContentBlocks(proposal.document.blocks)) {
    if (block.type !== "packages") continue;
    const pb = block as PackagesBlock;
    const sel = selections[pb.id];
    if (!sel || sel.kind !== "packages") continue;
    const tier = pb.tiers.find((t) => t.id === sel.tierId);
    const priceId = resolveStripePriceIdFromTierForBilling(
      tier,
      sel.term,
      catalogServices,
      stripeProductCatalog,
    );
    if (!priceId) continue;
    const serviceId = tier?.serviceId?.trim();
    const productName =
      (serviceId && catalogServices.find((s) => s.serviceId === serviceId)?.serviceName) ||
      (tier?.stripeProductId &&
        stripeProductCatalog.find((p) => p.productId === tier.stripeProductId)?.productName) ||
      tier?.name?.trim() ||
      "Plan";
    return {
      priceId,
      durationMonths: packagesTermToDurationMonths(sel.term),
      productName,
      tierName: tier?.name?.trim() || "Plan",
      blockTitle: pb.title?.trim() || "Plans",
    };
  }
  return null;
}
