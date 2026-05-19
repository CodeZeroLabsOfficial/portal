import type { CatalogServicePickerOption } from "@/types/catalog-service";
import type { PackagesBlock, ProposalRecord } from "@/types/proposal";
import { resolveProposalAddonBillingKind } from "@/lib/proposal-addon-billing";
import { effectiveCatalogAddonUnitAmount } from "@/lib/catalog-service-tier";
import { findFirstAgreementBlock, iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import {
  packageMonthlyTotalMinor,
  packageOneOffAddonsTotalMinor,
  packageTierUpfrontMinor,
  packagesAddonsSectionActive,
  packagesSelectionTermLabel,
} from "@/lib/proposal-packages-totals";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import { formatCurrencyAmount } from "@/lib/format";
import { sanitizeProposalHtmlServer } from "@/lib/sanitize-proposal-html-server";

const FULL_AGREEMENT_TEXT_MAX = 120_000;

const DEFAULT_LEGAL_SNAPSHOT = [
  "1. Parties — Service provider and customer as identified on the proposal.",
  "2. Scope — Products, services, and deliverables in the proposal including selected plan and add-ons.",
  "3. Pricing & Payment — Fees per proposal schedule; invoices due within 14 days unless stated.",
  "4. Term — Begins on signature; renews per proposal commitment unless non-renewal notice.",
  "5. Termination — Material breach with cure period; fees accrued through termination date.",
  "6. Confidentiality — Non-public information treated as confidential.",
  "7. Warranties & Liability — As stated in proposal; capped liability.",
  "8. Governing Law — Provider jurisdiction.",
].join("\n\n");

export interface SignedAgreementAddonSnapshot {
  label: string;
  quantity: number;
  unitAmountMinor: number;
  lineTotalMinor: number;
  currency: string;
  packageBlockTitle?: string;
  billingKind: "recurring" | "one_off";
}

export interface SignedAgreementCommerceSnapshot {
  selectedPlan: string;
  addons: SignedAgreementAddonSnapshot[];
  upfrontOneOffMinor: number;
  oneOffAddonsTotalMinor: number;
  totalAmount: {
    currency: string;
    monthlyTotalMinor: number;
    formatted: string;
  };
}

/** Plain-ish snapshot for audit (truncated HTML or default section summary). */
export function buildFullAgreementTextSnapshot(proposal: ProposalRecord): string | undefined {
  const agreement = findFirstAgreementBlock(proposal.document.blocks);
  if (!agreement) return undefined;
  const chunks: string[] = [];
  if (agreement.introHtml?.trim()) {
    chunks.push(sanitizeProposalHtmlServer(agreement.introHtml.trim()));
  }
  if (agreement.legalHtml?.trim()) {
    chunks.push(sanitizeProposalHtmlServer(agreement.legalHtml.trim()));
  } else {
    chunks.push(DEFAULT_LEGAL_SNAPSHOT);
  }
  const out = chunks.join("\n\n");
  if (out.length <= FULL_AGREEMENT_TEXT_MAX) return out;
  return `${out.slice(0, FULL_AGREEMENT_TEXT_MAX)}\n…`;
}

export function buildSignedAgreementCommerceSnapshot(
  proposal: ProposalRecord,
  catalogServices: readonly CatalogServicePickerOption[] = [],
): SignedAgreementCommerceSnapshot {
  const blocks = proposal.document.blocks;
  const selections = proposal.publicSelections;
  const planParts: string[] = [];
  const addons: SignedAgreementAddonSnapshot[] = [];
  let sumMonthly = 0;
  let upfrontOneOffMinor = 0;
  let oneOffAddonsTotalMinor = 0;
  let currency = "AUD";

  for (const block of iterateProposalContentBlocks(blocks)) {
    if (block.type !== "packages") continue;
    const pb = block as PackagesBlock;
    const sel = selections?.[pb.id];
    if (!sel) continue;
    const tier = pb.tiers.find((t) => t.id === sel.tierId);
    if (!tier) continue;
    const cur = (pb.currency || "aud").toUpperCase();
    currency = cur;
    const monthly =
      sel.term === "24_months"
        ? (tier.monthlyCost24Minor ?? 0)
        : (tier.monthlyCost12Minor ?? 0);
    const monthlyTotal = packageMonthlyTotalMinor(pb, sel, undefined, undefined, catalogServices);
    sumMonthly += monthlyTotal;
    upfrontOneOffMinor += packageTierUpfrontMinor(pb, sel);
    oneOffAddonsTotalMinor += packageOneOffAddonsTotalMinor(pb, sel, undefined, undefined, catalogServices);
    const blockTitle = pb.title?.trim() || "Plan";
    planParts.push(
      `${blockTitle}: ${tier.name?.trim() || "Plan"} — ${packagesSelectionTermLabel(pb, sel.term)} (${formatCurrencyAmount(monthly, cur)}/mo)`,
    );
    if (packagesAddonsSectionActive(pb)) {
      for (const li of pb.addonLineItems ?? []) {
        const rawQ = sel.addonQuantities?.[li.id];
        const quantity =
          typeof rawQ === "number" && Number.isFinite(rawQ) && rawQ >= 0
            ? Math.floor(rawQ)
            : effectivePricingLineQuantity(li);
        if (quantity <= 0) continue;
        const billingKind = resolveProposalAddonBillingKind(li, catalogServices);
        const unitAmountMinor = effectiveCatalogAddonUnitAmount(li, sel.term);
        const lineTotal = Math.round(unitAmountMinor * quantity);
        addons.push({
          label: li.label?.trim() || "Add-on",
          quantity,
          unitAmountMinor,
          lineTotalMinor: lineTotal,
          currency: cur,
          packageBlockTitle: blockTitle,
          billingKind: billingKind === "one_off" ? "one_off" : "recurring",
        });
      }
    }
  }

  const selectedPlan =
    planParts.length > 0 ? planParts.join(" | ") : "No package selection recorded";

  return {
    selectedPlan,
    addons,
    upfrontOneOffMinor,
    oneOffAddonsTotalMinor,
    totalAmount: {
      currency,
      monthlyTotalMinor: sumMonthly,
      formatted: formatCurrencyAmount(sumMonthly, currency),
    },
  };
}
