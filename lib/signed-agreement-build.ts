import type {
  AgreementBlock,
  PackagesBlock,
  PackagesPublicSelection,
  ProposalBlock,
  ProposalRecord,
} from "@/types/proposal";
import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import {
  packageAddonsTotalMinor,
  packageMonthlyTotalMinor,
  packagesAddonsSectionActive,
} from "@/lib/proposal-packages-totals";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import { formatCurrencyAmount } from "@/lib/format";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";

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

function termLabel(block: PackagesBlock, term: PackagesPublicSelection["term"]): string {
  if (term === "24_months") return block.plan24Label?.trim() || "24 months";
  return block.plan12Label?.trim() || "12 months";
}

export interface SignedAgreementAddonSnapshot {
  label: string;
  quantity: number;
  unitAmountMinor: number;
  lineTotalMinor: number;
  currency: string;
  packageBlockTitle?: string;
}

export interface SignedAgreementCommerceSnapshot {
  selectedPlan: string;
  addons: SignedAgreementAddonSnapshot[];
  totalAmount: {
    currency: string;
    monthlyTotalMinor: number;
    formatted: string;
  };
}

function firstAgreementBlock(blocks: ProposalBlock[]): AgreementBlock | null {
  for (const b of iterateProposalContentBlocks(blocks)) {
    if (b.type === "agreement") return b;
  }
  return null;
}

/** Plain-ish snapshot for audit (truncated HTML or default section summary). */
export function buildFullAgreementTextSnapshot(proposal: ProposalRecord): string | undefined {
  const agreement = firstAgreementBlock(proposal.document.blocks);
  if (!agreement) return undefined;
  const chunks: string[] = [];
  if (agreement.introHtml?.trim()) {
    chunks.push(sanitizeProposalHtml(agreement.introHtml.trim()));
  }
  if (agreement.legalHtml?.trim()) {
    chunks.push(sanitizeProposalHtml(agreement.legalHtml.trim()));
  } else {
    chunks.push(DEFAULT_LEGAL_SNAPSHOT);
  }
  const out = chunks.join("\n\n");
  if (out.length <= FULL_AGREEMENT_TEXT_MAX) return out;
  return `${out.slice(0, FULL_AGREEMENT_TEXT_MAX)}\n…`;
}

export function buildSignedAgreementCommerceSnapshot(
  proposal: ProposalRecord,
): SignedAgreementCommerceSnapshot {
  const blocks = proposal.document.blocks;
  const selections = proposal.publicSelections;
  const planParts: string[] = [];
  const addons: SignedAgreementAddonSnapshot[] = [];
  let sumMonthly = 0;
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
    const monthlyTotal = packageMonthlyTotalMinor(pb, sel);
    sumMonthly += monthlyTotal;
    const blockTitle = pb.title?.trim() || "Plan";
    planParts.push(
      `${blockTitle}: ${tier.name?.trim() || "Plan"} — ${termLabel(pb, sel.term)} (${formatCurrencyAmount(monthly, cur)}/mo)`,
    );
    if (packagesAddonsSectionActive(pb)) {
      for (const li of pb.addonLineItems ?? []) {
        if (li.optional && sel.addonOptionalOff?.[li.id]) continue;
        const rawQ = sel.addonQuantities?.[li.id];
        const quantity =
          typeof rawQ === "number" && Number.isFinite(rawQ) && rawQ >= 0
            ? Math.floor(rawQ)
            : effectivePricingLineQuantity(li);
        if (quantity <= 0) continue;
        const lineTotal = Math.round(li.unitAmountMinor * quantity);
        addons.push({
          label: li.label?.trim() || "Add-on",
          quantity,
          unitAmountMinor: li.unitAmountMinor,
          lineTotalMinor: lineTotal,
          currency: cur,
          packageBlockTitle: blockTitle,
        });
      }
    }
  }

  const selectedPlan =
    planParts.length > 0 ? planParts.join(" | ") : "No package selection recorded";

  return {
    selectedPlan,
    addons,
    totalAmount: {
      currency,
      monthlyTotalMinor: sumMonthly,
      formatted: formatCurrencyAmount(sumMonthly, currency),
    },
  };
}
