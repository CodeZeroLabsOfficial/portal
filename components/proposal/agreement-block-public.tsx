"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Download, Menu, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AgreementSignatureForm } from "@/components/proposal/agreement-signature-form";
import type {
  AgreementBlock,
  PackagesBlock,
  PackagesPublicSelection,
  ProposalAgreementChildBlock,
  ProposalBlock,
  ProposalCustomerSignerPrefill,
  ProposalPublicSelections,
  ProposalStatus,
} from "@/types/proposal";
import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import { readableForeground, resolveAgreementButtonColor } from "@/lib/block-style";
import { formatCurrencyAmount } from "@/lib/format";
import { effectiveCatalogAddonUnitAmount } from "@/lib/catalog-service-tier";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import { resolveProposalAddonBillingKind } from "@/lib/proposal-addon-billing";
import type { CatalogServicePickerOption } from "@/types/catalog-service";
import {
  packageMonthlyTotalMinor,
  packageOneOffAddonsTotalMinor,
  packageTierUpfrontMinor,
  packagesAddonsSectionActive,
  packagesSelectionTermLabel,
} from "@/lib/proposal-packages-totals";
import { injectAgreementLegalHeadingIds } from "@/lib/agreement-legal-headings";
import { PROPOSAL_EDITOR_SECTION_INNER_PAD_CLASSES } from "@/lib/proposal-public-layout";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";
import { isDocumentPackageSelectionComplete } from "@/lib/proposal-package-selection";
import type { ProposalPublicSubscriptionUi } from "@/server/proposal/public-proposal-subscription-ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { printAgreementDocument, useAgreementPrintMode } from "@/hooks/use-agreement-print-mode";
import { toast } from "sonner";

export interface AgreementBlockPublicProps {
  block: AgreementBlock;
  /** All top-level blocks — used to summarise the buyer's plan + add-on selection. */
  allBlocks: ProposalBlock[];
  shareToken?: string;
  publicSelections?: ProposalPublicSelections;
  /** Document title used as the proposal reference shown in the modal header. */
  proposalTitle?: string;
  /** Current proposal status — drives the “accepted” state in the modal footer. */
  proposalStatus?: ProposalStatus;
  acceptedByName?: string;
  /** Captured e-signature image (data URL) after acceptance — used for print/PDF. */
  acceptedSignatureDataUrl?: string;
  /** Server acceptance timestamp (ms). */
  acceptedAt?: number;
  /** Staff locality IANA zone — signing UI default date and typed-signature label use this. */
  localityTimeZone?: string;
  /** When set after acceptance, buyer can complete the same subscription flow as admin (prefilled). */
  publicSubscriptionUi?: ProposalPublicSubscriptionUi | null;
  /** CRM-linked customer fields for agreement pre-fill (public page only). */
  customerSignerPrefill?: ProposalCustomerSignerPrefill | null;
  /** Active catalogue services — classifies recurring vs one-off add-ons in the summary. */
  catalogServices?: readonly CatalogServicePickerOption[];
  /** When false (editor / preview) the CTA is disabled and the sign form is read-only. */
  interactive?: boolean;
  /** Renders nested blocks above the sign button (same pipeline as the public document viewer). */
  renderAgreementChild: (child: ProposalAgreementChildBlock) => React.ReactNode;
}

const DEFAULT_BUTTON_LABEL = "View Agreement";
const DEFAULT_AGREEMENT_TITLE = "Services Agreement";
/** Small inset from the top of the modal scroll pane (header is outside this pane). */
const AGREEMENT_SCROLL_PADDING_PX = 12;

function scrollAgreementContainerToElement(
  container: HTMLElement,
  target: HTMLElement,
  behavior: ScrollBehavior = "smooth",
) {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const nextTop = targetRect.top - containerRect.top + container.scrollTop - AGREEMENT_SCROLL_PADDING_PX;
  container.scrollTo({ top: Math.max(0, nextTop), behavior });
}

type AgreementJumpLink = { kind: "link"; id: string; label: string };
type AgreementJumpGroup = {
  kind: "group";
  id: string;
  label: string;
  children: Array<{ id: string; label: string }>;
};
type AgreementJumpItem = AgreementJumpLink | AgreementJumpGroup;

/** Sensible placeholder body used when the editor hasn't supplied custom legal text. */
const DEFAULT_LEGAL_SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: "1. Parties",
    body: "This Services Agreement (this “Agreement”) is entered into between the service provider issuing this proposal (the “Provider”) and the customer identified on the proposal cover (the “Client”). Capitalised terms used herein have the meanings ascribed to them throughout this document.",
  },
  {
    heading: "2. Scope of Services",
    body: "The Provider agrees to deliver the products, services, and deliverables described in the proposal above, including any selected plan, add-ons, and statements of work. Changes to the scope require written agreement from both parties.",
  },
  {
    heading: "3. Pricing & Payment",
    body: "Fees are payable in the amounts and on the schedule described in the proposal, including any monthly recurring subscription fees and one-time upfront amounts. Invoices are due within fourteen (14) days of issue unless otherwise specified. Overdue amounts may accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law.",
  },
  {
    heading: "4. Term",
    body: "The initial term begins on the date this Agreement is signed by the Client and continues for the commitment period selected in the proposal. The Agreement renews automatically for successive periods of the same length unless either party gives written notice of non-renewal at least thirty (30) days prior to the end of the then-current term.",
  },
  {
    heading: "5. Termination",
    body: "Either party may terminate this Agreement for material breach if the other party fails to cure such breach within thirty (30) days of written notice. Upon termination, the Client remains responsible for all fees accrued through the effective date of termination.",
  },
  {
    heading: "6. Confidentiality",
    body: "Each party will treat the other party's non-public information as confidential and use it solely to perform its obligations under this Agreement. This obligation survives termination for a period of three (3) years.",
  },
  {
    heading: "7. Warranties & Liability",
    body: "The services are provided on an “as is” basis except where expressly warranted in the proposal. Neither party will be liable for indirect, incidental, or consequential damages. Each party's aggregate liability arising out of this Agreement will not exceed the fees paid by the Client in the twelve (12) months preceding the claim.",
  },
  {
    heading: "8. Governing Law",
    body: "This Agreement is governed by the laws of the jurisdiction in which the Provider is established, without regard to its conflict of laws principles. The parties consent to the exclusive jurisdiction of the courts in that jurisdiction for any dispute arising out of this Agreement.",
  },
];

interface PackageSelectionSummary {
  blockId: string;
  blockTitle: string;
  currency: string;
  tierName: string;
  termLabel: string;
  monthlyMinor: number;
  monthlyTotalMinor: number;
  upfrontMinor: number;
  oneOffAddonsMinor: number;
  addonLines: Array<{
    id: string;
    label: string;
    quantity: number;
    unitAmountMinor: number;
    lineTotalMinor: number;
    billingKind: "recurring" | "one_off";
  }>;
  /** When set, public subscription checkout can use this Stripe Price id. */
  stripePriceId?: string;
}

function packagesBlocksFromDocument(blocks: ProposalBlock[]): PackagesBlock[] {
  const out: PackagesBlock[] = [];
  for (const b of iterateProposalContentBlocks(blocks)) {
    if (b.type === "packages") out.push(b);
  }
  return out;
}

function buildPackageSelectionSummary(
  block: PackagesBlock,
  selection: PackagesPublicSelection,
  catalogServices: readonly CatalogServicePickerOption[] = [],
): PackageSelectionSummary | null {
  const tier = block.tiers.find((t) => t.id === selection.tierId);
  if (!tier) return null;

  const monthly =
    selection.term === "24_months"
      ? (tier.monthlyCost24Minor ?? 0)
      : (tier.monthlyCost12Minor ?? 0);
  const monthlyTotal = packageMonthlyTotalMinor(block, selection, undefined, undefined, catalogServices);
  const upfrontMinor = packageTierUpfrontMinor(block, selection);
  const oneOffAddonsMinor = packageOneOffAddonsTotalMinor(
    block,
    selection,
    undefined,
    undefined,
    catalogServices,
  );

  const addonLines: PackageSelectionSummary["addonLines"] = [];
  if (packagesAddonsSectionActive(block)) {
    const lines = block.addonLineItems ?? [];
    for (const li of lines) {
      const rawQ = selection.addonQuantities?.[li.id];
      const quantity =
        typeof rawQ === "number" && Number.isFinite(rawQ) && rawQ >= 0
          ? Math.floor(rawQ)
          : effectivePricingLineQuantity(li);
      if (quantity <= 0) continue;
      const billingKind = resolveProposalAddonBillingKind(li, catalogServices);
      const unitAmountMinor = effectiveCatalogAddonUnitAmount(li, selection.term);
      addonLines.push({
        id: li.id,
        label: li.label?.trim() || "Add-on",
        quantity,
        unitAmountMinor,
        lineTotalMinor: Math.round(unitAmountMinor * quantity),
        billingKind: billingKind === "one_off" ? "one_off" : "recurring",
      });
    }
  }

  return {
    blockId: block.id,
    blockTitle: block.title?.trim() || "Plan",
    currency: (block.currency || "aud").toUpperCase(),
    tierName: tier.name?.trim() || "Plan",
    termLabel: packagesSelectionTermLabel(block, selection.term),
    monthlyMinor: monthly,
    monthlyTotalMinor: monthlyTotal,
    upfrontMinor,
    oneOffAddonsMinor,
    addonLines,
    stripePriceId: tier.stripePriceId?.trim() || undefined,
  };
}

function PackageSummaryCard({ summary }: { summary: PackageSelectionSummary }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {summary.blockTitle}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
            {summary.tierName}
          </p>
          <p className="text-sm text-zinc-500">Term: {summary.termLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Monthly subscription
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {formatCurrencyAmount(summary.monthlyMinor, summary.currency)}
          </p>
        </div>
      </div>

      {summary.addonLines.length > 0 ? (
        <div className="mt-5 border-t border-zinc-200 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Add-ons
          </p>
          <ul className="mt-2 space-y-2">
            {summary.addonLines.map((line) => (
              <li
                key={line.id}
                className="flex items-baseline justify-between gap-3 text-sm text-zinc-900"
              >
                <span>
                  {line.label}
                  {line.quantity > 1 ? (
                    <span className="text-zinc-500"> × {line.quantity}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-zinc-900">
                  {formatCurrencyAmount(line.lineTotalMinor, summary.currency)}
                  {line.billingKind === "one_off" ? (
                    <span className="text-zinc-500"> one-time</span>
                  ) : (
                    <span className="text-zinc-500">/mo</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.upfrontMinor > 0 ? (
        <div className="mt-5 flex items-baseline justify-between border-t border-zinc-200 pt-4 text-sm">
          <span className="font-medium text-zinc-900">Upfront fee</span>
          <span className="tabular-nums font-semibold text-zinc-900">
            {formatCurrencyAmount(summary.upfrontMinor, summary.currency)}
            <span className="font-normal text-zinc-500"> one-time</span>
          </span>
        </div>
      ) : null}

      <div className="mt-5 flex items-baseline justify-between rounded-xl bg-zinc-100 px-4 py-3">
        <span className="text-sm font-semibold text-zinc-900">Monthly subscription</span>
        <span className="text-lg font-semibold tabular-nums text-zinc-900">
          {formatCurrencyAmount(summary.monthlyTotalMinor, summary.currency)}
        </span>
      </div>
      {summary.oneOffAddonsMinor > 0 ? (
        <p className="mt-2 text-right text-xs text-zinc-500">
          Plus {formatCurrencyAmount(summary.oneOffAddonsMinor, summary.currency)} in one-time add-ons due at
          signing.
        </p>
      ) : null}
    </div>
  );
}

function NoPackageSelectionCard() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">
      No plan selected yet. Choose a plan in the proposal above before signing —
      your selection will appear here automatically.
    </div>
  );
}

function LegalSections({ legalHtmlWithIds }: { legalHtmlWithIds?: string }) {
  const sanitizedHtml = React.useMemo(() => {
    if (!legalHtmlWithIds?.trim()) return null;
    return sanitizeProposalHtml(legalHtmlWithIds);
  }, [legalHtmlWithIds]);

  if (sanitizedHtml) {
    return (
      <div
        className={cn(
          "proposal-rich-text max-w-none text-[15px] leading-relaxed text-zinc-700",
          "[&_h1]:mt-10 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-zinc-900",
          "[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900",
          "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900",
          "[&_p]:mb-4 [&_p:last-child]:mb-0",
          "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-zinc-900 [&_a]:underline",
          "[&_.proposal-agreement-spacer]:m-0 [&_.proposal-agreement-spacer]:block [&_.proposal-agreement-spacer]:shrink-0 [&_.proposal-agreement-spacer]:overflow-hidden [&_.proposal-agreement-spacer]:p-0",
        )}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }
  return (
    <div className="space-y-8">
      {DEFAULT_LEGAL_SECTIONS.map((s, i) => (
        <section
          key={s.heading}
          id={`agreement-section-${i}`}
          className="space-y-2"
        >
          <h3 className="text-base font-semibold tracking-tight text-zinc-900">
            {s.heading}
          </h3>
          <p className="text-[15px] leading-relaxed text-zinc-700">{s.body}</p>
        </section>
      ))}
    </div>
  );
}

export function AgreementBlockPublic({
  block,
  allBlocks,
  shareToken,
  publicSelections,
  proposalTitle,
  proposalStatus,
  acceptedByName,
  acceptedSignatureDataUrl,
  acceptedAt,
  localityTimeZone,
  interactive = true,
  publicSubscriptionUi = null,
  customerSignerPrefill = null,
  catalogServices = [],
  renderAgreementChild,
}: AgreementBlockPublicProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localAcceptedName, setLocalAcceptedName] = React.useState<string | null>(null);
  const [localSignatureDataUrl, setLocalSignatureDataUrl] = React.useState<string | null>(null);
  const [localDone, setLocalDone] = React.useState(proposalStatus === "accepted");

  React.useEffect(() => {
    setLocalDone(proposalStatus === "accepted");
  }, [proposalStatus]);

  const buttonLabel = block.buttonLabel?.trim() || DEFAULT_BUTTON_LABEL;
  const buttonAlign = block.buttonAlign ?? "center";
  const agreementTitle = block.agreementTitle?.trim() || DEFAULT_AGREEMENT_TITLE;
  const eSignaturesEnabled = block.eSignaturesEnabled !== false;
  const electronicSignatureDisclaimerEnabled = block.electronicSignatureDisclaimerEnabled !== false;
  const termsReadDisclaimerEnabled = block.termsReadDisclaimerEnabled !== false;
  const requireAcceptTerms = block.requireAcceptTerms !== false;
  const ctaColor = resolveAgreementButtonColor(block.style);
  const ctaForeground = readableForeground(ctaColor);

  const packageSummaries = React.useMemo(() => {
    const blocks = packagesBlocksFromDocument(allBlocks);
    const out: PackageSelectionSummary[] = [];
    for (const pb of blocks) {
      const sel = publicSelections?.[pb.id];
      if (!sel) continue;
      const built = buildPackageSelectionSummary(pb, sel, catalogServices);
      if (built) out.push(built);
    }
    return out;
  }, [allBlocks, publicSelections, catalogServices]);

  const planSelectionComplete = React.useMemo(
    () => isDocumentPackageSelectionComplete(allBlocks, publicSelections),
    [allBlocks, publicSelections],
  );

  const subscriptionMonthly = React.useMemo(() => {
    if (packageSummaries.length === 0) return null;
    const total = packageSummaries.reduce((acc, s) => acc + s.monthlyTotalMinor, 0);
    const currency = packageSummaries[0]?.currency ?? "AUD";
    return { total, currency };
  }, [packageSummaries]);

  const accepted = localDone || proposalStatus === "accepted";
  const hasCustomLegal = Boolean(block.legalHtml?.trim());

  const introWithHeadingIds = React.useMemo(() => {
    if (!block.introHtml?.trim()) return { html: "", headings: [] };
    return injectAgreementLegalHeadingIds(block.introHtml.trim(), { idPrefix: "agreement-intro" });
  }, [block.introHtml]);

  const legalWithHeadingIds = React.useMemo(() => {
    if (!block.legalHtml?.trim()) return { html: "", headings: [] };
    return injectAgreementLegalHeadingIds(block.legalHtml.trim());
  }, [block.legalHtml]);

  const agreementLegalChildren = React.useMemo(() => {
    const intro = introWithHeadingIds.headings.map((h) => ({ id: h.id, label: h.label }));
    const legal = hasCustomLegal
      ? legalWithHeadingIds.headings.map((h) => ({ id: h.id, label: h.label }))
      : DEFAULT_LEGAL_SECTIONS.map((s, i) => ({
          id: `agreement-section-${i}`,
          label: s.heading,
        }));
    return [...intro, ...legal];
  }, [hasCustomLegal, introWithHeadingIds.headings, legalWithHeadingIds.headings]);

  const jumpNavItems = React.useMemo((): AgreementJumpItem[] => {
    const items: AgreementJumpItem[] = [
      { kind: "link", id: "agreement-top", label: "Top of agreement" },
    ];
    if (packageSummaries.length > 0) {
      items.push({ kind: "link", id: "agreement-plan", label: "Selected plan & add-ons" });
    }
    items.push({
      kind: "group",
      id: "agreement-legal",
      label: agreementTitle,
      children: agreementLegalChildren,
    });
    items.push({
      kind: "link",
      id: "agreement-sign",
      label: accepted ? "Signature" : "Sign agreement",
    });
    return items;
  }, [packageSummaries.length, agreementTitle, agreementLegalChildren, accepted]);
  const displayName = localAcceptedName ?? acceptedByName;
  const signatureDataUrl = localSignatureDataUrl ?? acceptedSignatureDataUrl ?? null;
  const signedAtMs = accepted ? (acceptedAt ?? null) : null;
  const blockAgreementUntilPlanPicked = interactive && !accepted && !planSelectionComplete;
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const signRef = React.useRef<HTMLDivElement | null>(null);
  const [sectionsSidebarOpen, setSectionsSidebarOpen] = React.useState(false);

  useAgreementPrintMode();

  React.useEffect(() => {
    if (!open) setSectionsSidebarOpen(false);
  }, [open]);

  function jumpToSection(id: string) {
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector(`#${CSS.escape(id)}`);
    if (el instanceof HTMLElement) {
      scrollAgreementContainerToElement(container, el);
    }
  }

  function scrollToRef(ref: React.RefObject<HTMLDivElement | null>) {
    const container = scrollRef.current;
    const el = ref.current;
    if (container && el) {
      scrollAgreementContainerToElement(container, el);
    }
  }

  function onDownload() {
    printAgreementDocument({ documentTitle: agreementTitle });
  }

  async function onSign(
    payload: {
      signerName: string;
      signerEmail: string;
      signerOrganization?: string;
      signatureDataUrl?: string;
      signatureMethod?: "draw" | "type" | "upload";
      clientSignedAt: number;
    },
    meta?: { subscriptionError?: string | null },
  ) {
    if (!shareToken || !interactive) return;
    setError(null);
    setLocalAcceptedName(payload.signerName);
    if (payload.signatureDataUrl) {
      setLocalSignatureDataUrl(payload.signatureDataUrl);
    }
    setLocalDone(true);
    if (meta?.subscriptionError) {
      toast.error(meta.subscriptionError);
      toast.success("Agreement signed.");
    } else {
      toast.success("Agreement signed. Thank you.");
    }
    router.refresh();
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          "mx-auto flex w-full max-w-2xl flex-col gap-6",
          PROPOSAL_EDITOR_SECTION_INNER_PAD_CLASSES,
        )}
      >
        <div className="flex w-full min-w-0 flex-col gap-0 text-left">
          {(block.children ?? []).map((child) => (
            <div key={child.id} className="w-full min-w-0">
              {renderAgreementChild(child)}
            </div>
          ))}
        </div>
        <div
          className={cn(
            "flex flex-col gap-4",
            buttonAlign === "start" ? "items-stretch text-left" : "items-center text-center",
          )}
        >
          {blockAgreementUntilPlanPicked ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex max-w-full",
                      buttonAlign === "start" ? "justify-start" : "justify-center",
                    )}
                  >
                    <Button
                      type="button"
                      size="lg"
                      disabled
                      className="h-12 max-w-full rounded-xl px-8 text-base font-semibold shadow-md"
                      style={{ backgroundColor: ctaColor, color: ctaForeground }}
                    >
                      {buttonLabel}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left text-sm leading-snug">
                  Select a plan in the proposal above first. Your choice appears in the agreement
                  automatically.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={() => setOpen(true)}
              disabled={!interactive}
              className="h-12 rounded-xl px-8 text-base font-semibold shadow-md transition-colors hover:opacity-95"
              style={{ backgroundColor: ctaColor, color: ctaForeground }}
            >
              {buttonLabel}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onEscapeKeyDown={(e) => {
            if (sectionsSidebarOpen) {
              e.preventDefault();
              setSectionsSidebarOpen(false);
            }
          }}
          className={cn(
            "z-50 grid gap-0 overflow-hidden border-0 bg-white p-0 text-zinc-900 shadow-2xl",
            // Mobile: fills viewport, no rounding.
            "h-[100dvh] w-screen max-w-none left-0 top-0 translate-x-0 translate-y-0 rounded-none",
            // Desktop: near-full-screen with subtle rounding to match Qwilr's modal proportions.
            "sm:left-1/2 sm:top-1/2 sm:h-[min(96dvh,960px)] sm:max-h-[96dvh]",
            "sm:w-[min(1536px,calc(100vw-3rem))] sm:max-w-[min(1536px,calc(100vw-3rem))]",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            "print:static print:inset-auto print:h-auto print:max-h-none print:w-full print:max-w-none",
            "print:translate-x-0 print:translate-y-0 print:rounded-none print:shadow-none print:overflow-visible",
            "grid-rows-[auto,1fr] print:grid-rows-1",
            // Hide the shadcn auto-render close X — our top bar renders its own.
            "[&>button[aria-label='Close']]:hidden",
            "pt-[max(0px,env(safe-area-inset-top))] sm:pt-0",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6 print:hidden">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                aria-label={sectionsSidebarOpen ? "Close agreement sections" : "Open agreement sections"}
                aria-expanded={sectionsSidebarOpen}
                aria-controls="agreement-sections-sidebar"
                onClick={() => setSectionsSidebarOpen((v) => !v)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
              <DialogTitle className="truncate text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
                {agreementTitle}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDownload}
                className="hidden h-9 gap-1.5 border-zinc-200 bg-white px-3 text-zinc-900 hover:bg-zinc-50 sm:inline-flex"
              >
                <Download className="h-4 w-4" aria-hidden />
                Download
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => scrollToRef(signRef)}
                className="h-9 gap-1.5 rounded-md px-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: ctaColor, color: ctaForeground }}
                disabled={accepted}
              >
                {accepted ? "Signed" : "Agree"}
                {!accepted ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
              </Button>
              <DialogClose
                aria-label="Close agreement"
                className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <X className="h-5 w-5" aria-hidden />
              </DialogClose>
            </div>
          </div>

          <div className="flex h-full min-h-0 flex-1 overflow-hidden print:block print:h-auto print:min-h-0 print:overflow-visible">
            <aside
              id="agreement-sections-sidebar"
              aria-hidden={!sectionsSidebarOpen}
              inert={!sectionsSidebarOpen ? true : undefined}
              className={cn(
                "flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r bg-white motion-reduce:transition-none print:hidden",
                "transition-[width] duration-300 ease-out",
                sectionsSidebarOpen
                  ? "w-[min(18rem,88vw)] border-zinc-200 shadow-[4px_0_16px_-8px_rgba(0,0,0,0.08)]"
                  : "w-0 border-transparent",
              )}
            >
              <div className="flex h-full min-h-0 w-[min(18rem,88vw)] flex-col">
                <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Jump to
                  </p>
                </div>
                <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Agreement sections">
                  <ul className="space-y-0.5">
                    {jumpNavItems.map((item) =>
                      item.kind === "link" ? (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                            onClick={() => jumpToSection(item.id)}
                          >
                            {item.label}
                          </button>
                        </li>
                      ) : (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                            onClick={() => jumpToSection(item.id)}
                          >
                            {item.label}
                          </button>
                          {item.children.length > 0 ? (
                            <ul className="mt-0.5 space-y-0.5 border-l border-zinc-200 ml-3 pl-1">
                              {item.children.map((child) => (
                                <li key={child.id}>
                                  <button
                                    type="button"
                                    className="w-full rounded-lg py-2 pl-4 pr-3 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                    onClick={() => jumpToSection(child.id)}
                                  >
                                    {child.label}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ),
                    )}
                  </ul>
                </nav>
              </div>
            </aside>

            <div
              ref={scrollRef}
              className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white pb-[max(1rem,env(safe-area-inset-bottom))] print:overflow-visible print:pb-0"
            >
            <div
              data-agreement-print-target=""
              className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-10 sm:py-16"
            >
              <div id="agreement-top" aria-hidden />

              <header className="text-center">
                <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
                  {agreementTitle}
                </h1>
              </header>

              {introWithHeadingIds.html ? (
                <section className="mx-auto mt-10 max-w-2xl">
                  <div
                    className={cn(
                      "proposal-rich-text max-w-none text-[15px] leading-relaxed text-zinc-600",
                      "[&_a]:text-zinc-900 [&_a]:underline",
                      "[&_p]:mb-4 [&_p:last-child]:mb-0",
                      "[&_em]:italic",
                      "[&_.proposal-agreement-spacer]:m-0 [&_.proposal-agreement-spacer]:block [&_.proposal-agreement-spacer]:shrink-0 [&_.proposal-agreement-spacer]:overflow-hidden [&_.proposal-agreement-spacer]:p-0",
                    )}
                    dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(introWithHeadingIds.html) }}
                  />
                </section>
              ) : null}

              {packageSummaries.length > 0 ? (
                <section
                  id="agreement-plan"
                  data-agreement-print-exclude=""
                  className="mt-12 space-y-4 print:hidden"
                >
                  <SectionLabel>Your selection</SectionLabel>
                  <div className="space-y-4">
                    {packageSummaries.map((summary) => (
                      <PackageSummaryCard key={summary.blockId} summary={summary} />
                    ))}
                  </div>
                </section>
              ) : null}

              <section data-agreement-print-exclude="" className="mt-12 space-y-2 print:hidden">
                {!packageSummaries.length && !block.legalHtml?.trim() ? (
                  <NoPackageSelectionCard />
                ) : null}
              </section>

              <section id="agreement-legal" className="mt-12">
                <SectionLabel>The agreement</SectionLabel>
                <div className="mt-6">
                  <LegalSections legalHtmlWithIds={legalWithHeadingIds.html} />
                </div>
              </section>

              {accepted ? (
                <AgreementPrintSignatureBlock
                  signatureSrc={signatureDataUrl}
                  signerName={displayName}
                  signedAt={signedAtMs}
                />
              ) : null}

              <section
                ref={signRef}
                id="agreement-sign"
                data-agreement-print-exclude=""
                className="mt-16 print:hidden"
              >
                {accepted ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center sm:px-8">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
                      <CheckCircle2 className="h-6 w-6" aria-hidden />
                    </span>
                    <p className="mt-4 text-xl font-semibold tracking-tight text-emerald-950">
                      Agreement Signed
                    </p>
                    <p className="mt-2 text-sm text-emerald-900/85">
                      {displayName ? (
                        <>
                          Thank you, <span className="font-semibold text-emerald-950">{displayName}</span>.
                          Your signature has been recorded.
                        </>
                      ) : (
                        <>Thank you — your signature has been recorded.</>
                      )}
                    </p>
                    <p className="mt-2 text-sm text-emerald-900/75">
                      We&apos;ll follow up with next steps shortly.
                    </p>
                    <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 border-emerald-300/80 bg-white text-emerald-950 hover:bg-emerald-100/50"
                        onClick={onDownload}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        Download PDF
                      </Button>
                      <DialogClose asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          className="bg-emerald-900/10 text-emerald-950 hover:bg-emerald-900/15"
                        >
                          Close
                        </Button>
                      </DialogClose>
                    </div>
                  </div>
                ) : (
                  <AgreementSignatureForm
                    disabled={!interactive || !shareToken}
                    busy={false}
                    eSignaturesEnabled={eSignaturesEnabled}
                    electronicSignatureDisclaimerEnabled={electronicSignatureDisclaimerEnabled}
                    termsReadDisclaimerEnabled={termsReadDisclaimerEnabled}
                    requireAcceptTerms={requireAcceptTerms}
                    prefillSignerNameEnabled={Boolean(block.prefillSignerNameEnabled)}
                    prefillSignerEmailEnabled={Boolean(block.prefillSignerEmailEnabled)}
                    prefillSignerOrganizationEnabled={Boolean(block.prefillSignerOrganizationEnabled)}
                    prefillSignerName={block.prefillSignerName}
                    prefillSignerEmail={block.prefillSignerEmail}
                    prefillSignerOrganization={block.prefillSignerOrganization}
                    customerSignerPrefill={customerSignerPrefill}
                    agreementTitle={agreementTitle}
                    proposalTitle={proposalTitle}
                    ctaColor={ctaColor}
                    ctaForeground={ctaForeground}
                    localityTimeZone={localityTimeZone}
                    shareToken={shareToken}
                    publicSubscriptionUi={publicSubscriptionUi}
                    paymentDetailsSectionEnabled={block.paymentDetailsSectionEnabled !== false}
                    monthlyTotalMinor={subscriptionMonthly?.total}
                    monthlyCurrency={subscriptionMonthly?.currency}
                    error={error}
                    onDismissError={() => setError(null)}
                    onSubmit={onSign}
                  />
                )}
              </section>
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
      {children}
    </p>
  );
}

/** Shown only in print/PDF after the agreement is signed — mirrors the e-signature capture. */
export function AgreementPrintSignatureBlock({
  signatureSrc,
  signerName,
  signedAt,
}: {
  signatureSrc: string | null | undefined;
  signerName?: string | null;
  signedAt?: number | null;
}) {
  if (!signatureSrc?.trim()) return null;

  const signedLabel =
    signedAt && signedAt > 0
      ? new Date(signedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  return (
    <section className="mt-12 hidden print:block">
      <SectionLabel>Signature</SectionLabel>
      <div className="mt-6 border-t border-zinc-200 pt-8">
        {signerName?.trim() ? (
          <p className="text-sm font-semibold text-zinc-900">{signerName.trim()}</p>
        ) : null}
        {signedLabel ? <p className="mt-1 text-xs text-zinc-500">Signed {signedLabel}</p> : null}
        <div className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureSrc}
            alt={signerName?.trim() ? `Signature of ${signerName.trim()}` : "Signature"}
            className="max-h-36 max-w-full object-contain object-left"
          />
        </div>
      </div>
    </section>
  );
}

