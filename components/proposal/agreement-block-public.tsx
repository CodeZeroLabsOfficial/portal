"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSignature, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AgreementBlock,
  PackagesBlock,
  PackagesPublicSelection,
  ProposalBlock,
  ProposalPublicSelections,
  ProposalStatus,
} from "@/types/proposal";
import { iterateProposalContentBlocks } from "@/lib/proposal-blocks";
import { readableForeground, resolveAgreementButtonColor } from "@/lib/block-style";
import { formatCurrencyAmount } from "@/lib/format";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import {
  packageAddonsTotalMinor,
  packageMonthlyTotalMinor,
  packagesAddonsSectionActive,
} from "@/lib/proposal-packages-totals";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";
import { acceptProposalPublicAction } from "@/server/actions/proposal-builder";
import { cn } from "@/lib/utils";

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
  /** When false (editor / preview) the CTA is disabled and the sign form is read-only. */
  interactive?: boolean;
}

const DEFAULT_HEADING = "Ready to get started?";
const DEFAULT_BUTTON_LABEL = "View Agreement";
const DEFAULT_AGREEMENT_TITLE = "Services Agreement";

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
  addonsTotalMinor: number;
  addonLines: Array<{
    id: string;
    label: string;
    quantity: number;
    unitAmountMinor: number;
    lineTotalMinor: number;
  }>;
}

function packagesBlocksFromDocument(blocks: ProposalBlock[]): PackagesBlock[] {
  const out: PackagesBlock[] = [];
  for (const b of iterateProposalContentBlocks(blocks)) {
    if (b.type === "packages") out.push(b);
  }
  return out;
}

function termLabelForSelection(
  block: PackagesBlock,
  term: PackagesPublicSelection["term"],
): string {
  if (term === "24_months") return block.plan24Label?.trim() || "24 months";
  return block.plan12Label?.trim() || "12 months";
}

function buildPackageSelectionSummary(
  block: PackagesBlock,
  selection: PackagesPublicSelection,
): PackageSelectionSummary | null {
  const tier = block.tiers.find((t) => t.id === selection.tierId);
  if (!tier) return null;

  const monthly =
    selection.term === "24_months"
      ? (tier.monthlyCost24Minor ?? 0)
      : (tier.monthlyCost12Minor ?? 0);
  const monthlyTotal = packageMonthlyTotalMinor(block, selection);
  const addonsTotal = packageAddonsTotalMinor(block, selection);

  const addonLines: PackageSelectionSummary["addonLines"] = [];
  if (packagesAddonsSectionActive(block)) {
    const lines = block.addonLineItems ?? [];
    for (const li of lines) {
      const off = li.optional && selection.addonOptionalOff?.[li.id];
      if (off) continue;
      const rawQ = selection.addonQuantities?.[li.id];
      const quantity =
        typeof rawQ === "number" && Number.isFinite(rawQ) && rawQ >= 0
          ? Math.floor(rawQ)
          : effectivePricingLineQuantity(li);
      if (quantity <= 0) continue;
      addonLines.push({
        id: li.id,
        label: li.label?.trim() || "Add-on",
        quantity,
        unitAmountMinor: li.unitAmountMinor,
        lineTotalMinor: Math.round(li.unitAmountMinor * quantity),
      });
    }
  }

  return {
    blockId: block.id,
    blockTitle: block.title?.trim() || "Plan",
    currency: (block.currency || "aud").toUpperCase(),
    tierName: tier.name?.trim() || "Plan",
    termLabel: termLabelForSelection(block, selection.term),
    monthlyMinor: monthly,
    monthlyTotalMinor: monthlyTotal,
    addonsTotalMinor: addonsTotal,
    addonLines,
  };
}

function PackageSummaryCard({ summary }: { summary: PackageSelectionSummary }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {summary.blockTitle}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {summary.tierName}
          </p>
          <p className="text-sm text-muted-foreground">Term: {summary.termLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Monthly subscription
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {formatCurrencyAmount(summary.monthlyMinor, summary.currency)}
          </p>
        </div>
      </div>

      {summary.addonLines.length > 0 ? (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Add-ons
          </p>
          <ul className="mt-2 space-y-2">
            {summary.addonLines.map((line) => (
              <li
                key={line.id}
                className="flex items-baseline justify-between gap-3 text-sm text-foreground"
              >
                <span>
                  {line.label}
                  {line.quantity > 1 ? (
                    <span className="text-muted-foreground"> × {line.quantity}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-foreground">
                  {formatCurrencyAmount(line.lineTotalMinor, summary.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Add-ons subtotal</span>
            <span className="tabular-nums text-foreground">
              {formatCurrencyAmount(summary.addonsTotalMinor, summary.currency)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-baseline justify-between rounded-xl bg-muted/50 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Monthly total</span>
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {formatCurrencyAmount(summary.monthlyTotalMinor, summary.currency)}
        </span>
      </div>
    </div>
  );
}

function NoPackageSelectionCard() {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
      No plan selected yet. Choose a plan in the proposal above before signing —
      your selection will appear here automatically.
    </div>
  );
}

function LegalSections({ legalHtml }: { legalHtml?: string }) {
  if (legalHtml && legalHtml.trim()) {
    return (
      <div
        className={cn(
          "proposal-rich-text max-w-none text-[15px] leading-relaxed text-foreground",
          "[&_h1]:mt-8 [&_h1]:text-xl [&_h1]:font-semibold",
          "[&_h2]:mt-7 [&_h2]:text-lg [&_h2]:font-semibold",
          "[&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold",
          "[&_p]:mb-4 [&_p:last-child]:mb-0",
          "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-primary [&_a]:underline",
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(legalHtml) }}
      />
    );
  }
  return (
    <div className="space-y-6">
      {DEFAULT_LEGAL_SECTIONS.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {s.heading}
          </h3>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
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
  interactive = true,
}: AgreementBlockPublicProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [agreed, setAgreed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localAcceptedName, setLocalAcceptedName] = React.useState<string | null>(null);
  const [localDone, setLocalDone] = React.useState(proposalStatus === "accepted");

  React.useEffect(() => {
    setLocalDone(proposalStatus === "accepted");
  }, [proposalStatus]);

  const heading = block.heading?.trim() || DEFAULT_HEADING;
  const buttonLabel = block.buttonLabel?.trim() || DEFAULT_BUTTON_LABEL;
  const agreementTitle = block.agreementTitle?.trim() || DEFAULT_AGREEMENT_TITLE;
  const requireAcceptTerms = block.requireAcceptTerms !== false;
  const ctaColor = resolveAgreementButtonColor(block.style);
  const ctaForeground = readableForeground(ctaColor);

  const packageSummaries = React.useMemo(() => {
    const blocks = packagesBlocksFromDocument(allBlocks);
    const out: PackageSelectionSummary[] = [];
    for (const pb of blocks) {
      const sel = publicSelections?.[pb.id];
      if (!sel) continue;
      const built = buildPackageSelectionSummary(pb, sel);
      if (built) out.push(built);
    }
    return out;
  }, [allBlocks, publicSelections]);

  const accepted = localDone || proposalStatus === "accepted";
  const displayName = localAcceptedName ?? acceptedByName;
  const canSign =
    interactive &&
    !accepted &&
    Boolean(shareToken) &&
    name.trim().length >= 2 &&
    (!requireAcceptTerms || agreed);

  async function onSign(e: React.FormEvent) {
    e.preventDefault();
    if (!shareToken || !interactive) return;
    setBusy(true);
    setError(null);
    const res = await acceptProposalPublicAction({
      shareToken,
      signerName: name.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setLocalAcceptedName(name.trim());
    setLocalDone(true);
    router.refresh();
  }

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-10 text-center sm:py-14">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {heading}
        </h2>
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
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "z-50 grid gap-0 overflow-hidden border-border/80 bg-card p-0 text-foreground shadow-2xl",
            "h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 left-0 top-0 rounded-none",
            "sm:left-1/2 sm:top-1/2 sm:h-[92vh] sm:max-h-[92vh] sm:w-[min(1080px,calc(100vw-3rem))] sm:max-w-[min(1080px,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            "grid-rows-[auto,1fr,auto]",
            // Hide the shadcn DialogContent default close (a direct-child button with aria-label=\"Close\"). Our header renders its own.
            "[&>button[aria-label='Close']]:hidden",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5 sm:px-10 sm:py-6">
            <div className="min-w-0">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {agreementTitle}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {proposalTitle ? (
                  <>
                    Re: <span className="font-medium text-foreground">{proposalTitle}</span>
                  </>
                ) : (
                  <>Review the terms below, then sign at the bottom of this modal.</>
                )}
              </DialogDescription>
            </div>
            <DialogClose
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close agreement"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </DialogClose>
          </div>

          <div className="min-h-0 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-10 px-6 py-8 sm:px-10 sm:py-10">
              <section className="space-y-4">
                <header>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Your Selection
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                    Selected plan &amp; add-ons
                  </h3>
                </header>
                {packageSummaries.length === 0 ? (
                  <NoPackageSelectionCard />
                ) : (
                  <div className="space-y-4">
                    {packageSummaries.map((summary) => (
                      <PackageSummaryCard key={summary.blockId} summary={summary} />
                    ))}
                  </div>
                )}
              </section>

              {block.introHtml && block.introHtml.trim() ? (
                <section>
                  <div
                    className={cn(
                      "proposal-rich-text max-w-none text-[15px] leading-relaxed text-muted-foreground",
                      "[&_a]:text-primary [&_a]:underline",
                      "[&_p]:mb-4 [&_p:last-child]:mb-0",
                    )}
                    dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(block.introHtml) }}
                  />
                </section>
              ) : null}

              <section className="space-y-5">
                <header>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    The Agreement
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                    Terms &amp; conditions
                  </h3>
                </header>
                <LegalSections legalHtml={block.legalHtml} />
              </section>
            </div>
          </div>

          <div className="border-t border-border/60 bg-muted/30 px-6 py-5 sm:px-10 sm:py-6">
            {accepted ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Signed{displayName ? ` by ${displayName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Thanks — we&apos;ll follow up with next steps shortly.
                    </p>
                  </div>
                </div>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="gap-2">
                    Close
                  </Button>
                </DialogClose>
              </div>
            ) : (
              <form className="grid gap-4 sm:grid-cols-[1fr,auto] sm:items-end" onSubmit={onSign}>
                <div className="space-y-2">
                  <Label htmlFor="agreement-sign-name" className="text-foreground">
                    Sign here — full name
                  </Label>
                  <Input
                    id="agreement-sign-name"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!interactive || busy}
                    minLength={2}
                    className="h-11 bg-card text-base"
                  />
                  {requireAcceptTerms ? (
                    <label className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-input"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        disabled={!interactive || busy}
                      />
                      <span>
                        I have read and agree to the terms of this {agreementTitle.toLowerCase()}
                        {proposalTitle ? <> for <span className="font-medium text-foreground">{proposalTitle}</span></> : null}.
                      </span>
                    </label>
                  ) : null}
                  {error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}
                  {!interactive ? (
                    <p className="text-xs text-muted-foreground">
                      Signing is disabled in preview — the live proposal will accept your customer&apos;s signature here.
                    </p>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-11 gap-2 rounded-xl text-base font-semibold shadow-md hover:opacity-95"
                  style={{ backgroundColor: ctaColor, color: ctaForeground }}
                  disabled={!canSign || busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileSignature className="h-4 w-4" aria-hidden />
                  )}
                  Sign &amp; accept
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

