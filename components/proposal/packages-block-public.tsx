"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import type { PackagesBlock, PackagesPublicSelection } from "@/types/proposal";
import { formatCurrencyAmount } from "@/lib/format";
import { formatPackageTierIncluded } from "@/lib/package-tier-limits";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import {
  packageAddonsTotalMinor,
  packageCommitmentTotalMinor,
  packageMonthlyTotalMinor,
  packageTermMonths,
  packagesAddonsSectionActive,
} from "@/lib/proposal-packages-totals";
import { cn } from "@/lib/utils";
import { readableForeground, resolveBlockStyle, withAlpha } from "@/lib/block-style";
import { saveProposalPackageSelectionAction } from "@/server/actions/proposal-builder";
import { Button } from "@/components/ui/button";

export interface PackagesBlockPublicProps {
  block: PackagesBlock;
  shareToken: string;
  /** Hydrated from Firestore after a previous visit. */
  initialSelection?: PackagesPublicSelection;
  /** False in admin preview — no persistence. */
  interactive?: boolean;
}

export function PackagesBlockPublic({
  block,
  shareToken,
  initialSelection,
  interactive = true,
}: PackagesBlockPublicProps) {
  const router = useRouter();
  const currency = (block.currency ?? "aud").toUpperCase();
  const tiers = Array.isArray(block.tiers) ? block.tiers : [];

  const [term, setTerm] = React.useState<"12_months" | "24_months">(
    initialSelection?.term ?? "24_months",
  );
  const [selectedTierId, setSelectedTierId] = React.useState<string | null>(
    initialSelection?.tierId ?? null,
  );
  const [pendingTierId, setPendingTierId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const addonsActive = packagesAddonsSectionActive(block);
  const addonLines = block.addonLineItems ?? [];
  const addonIdsKey = addonLines.map((l) => l.id).join(",");

  const [addonQty, setAddonQty] = React.useState<Record<string, number>>(() => {
    const next: Record<string, number> = {};
    for (const li of addonLines) {
      const s = initialSelection?.addonQuantities?.[li.id];
      next[li.id] =
        typeof s === "number" && Number.isFinite(s) && s >= 0
          ? Math.floor(s)
          : effectivePricingLineQuantity(li);
    }
    return next;
  });
  const [addonOptOff, setAddonOptOff] = React.useState<Record<string, boolean>>(() =>
    initialSelection?.addonOptionalOff ? { ...initialSelection.addonOptionalOff } : {},
  );

  React.useEffect(() => {
    if (initialSelection?.tierId) setSelectedTierId(initialSelection.tierId);
    if (initialSelection?.term) setTerm(initialSelection.term);
  }, [initialSelection?.tierId, initialSelection?.term]);

  React.useEffect(() => {
    const lines = block.addonLineItems ?? [];
    const next: Record<string, number> = {};
    for (const li of lines) {
      const s = initialSelection?.addonQuantities?.[li.id];
      next[li.id] =
        typeof s === "number" && Number.isFinite(s) && s >= 0
          ? Math.floor(s)
          : effectivePricingLineQuantity(li);
    }
    setAddonQty(next);
    setAddonOptOff(
      initialSelection?.addonOptionalOff ? { ...initialSelection.addonOptionalOff } : {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only rehydrate after server refresh (`updatedAtMs`) or add-on line set changes
  }, [addonIdsKey, initialSelection?.updatedAtMs]);

  const label12 = block.plan12Label ?? "12 months";
  const label24 = block.plan24Label ?? "24 months";
  const title = block.title ?? "Packages";
  const style = resolveBlockStyle(block.style);
  const isVisual = style.variant === "visual";
  const recommendedFg = readableForeground(style.highlightColor);
  const dimRecommendedFg =
    recommendedFg === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(15,23,42,0.65)";
  const recommendedFaintBorder =
    recommendedFg === "#ffffff" ? "rgba(255,255,255,0.32)" : "rgba(15,23,42,0.22)";
  const activeTermFg = readableForeground(style.primaryColor);
  const totalBarFg = readableForeground(style.primaryColor);
  const addonsTitle = block.addonsTitle ?? "Add-ons";
  const totalSectionLabel = block.totalSectionLabel ?? "Total";
  const qtyUnit = (block.addonQuantityUnitLabel ?? "Unit").trim() || "Unit";
  const allowAddonEdit = block.allowAddonQuantityEdit !== false;

  const selectionDraft: PackagesPublicSelection | undefined = selectedTierId
    ? {
        kind: "packages",
        tierId: selectedTierId,
        term,
        updatedAtMs: initialSelection?.updatedAtMs ?? 0,
        addonQuantities: addonQty,
        addonOptionalOff: addonOptOff,
      }
    : undefined;

  const addonsSubtotalMinor =
    selectionDraft != null
      ? packageAddonsTotalMinor(block, selectionDraft)
      : packageAddonsTotalMinor(block, undefined, addonQty, addonOptOff);
  const termMonths = packageTermMonths({ term });
  const monthlyTotalMinor = selectionDraft
    ? packageMonthlyTotalMinor(block, selectionDraft)
    : addonsSubtotalMinor;
  const commitmentTotalMinor = selectionDraft
    ? packageCommitmentTotalMinor(block, selectionDraft)
    : addonsSubtotalMinor * termMonths;

  async function flushAddonsToServer(nextQty?: Record<string, number>, nextOpt?: Record<string, boolean>) {
    if (!interactive || !shareToken || !selectedTierId) return;
    const q = nextQty ?? addonQty;
    const o = nextOpt ?? addonOptOff;
    const res = await saveProposalPackageSelectionAction({
      shareToken,
      blockId: block.id,
      tierId: selectedTierId,
      term,
      addonQuantities: q,
      addonOptionalOff: o,
    });
    if (res.ok) router.refresh();
  }

  function monthlyMinor(tier: (typeof tiers)[number]): number {
    const m12 = tier.monthlyCost12Minor ?? 0;
    const m24 = tier.monthlyCost24Minor ?? 0;
    return term === "12_months" ? m12 : m24;
  }

  async function selectTier(tierId: string) {
    setError(null);
    if (!interactive || !shareToken) {
      setSelectedTierId(tierId);
      return;
    }
    setPendingTierId(tierId);
    const res = await saveProposalPackageSelectionAction({
      shareToken,
      blockId: block.id,
      tierId,
      term,
      addonQuantities: addonQty,
      addonOptionalOff: addonOptOff,
    });
    setPendingTierId(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSelectedTierId(tierId);
    router.refresh();
  }

  return (
    <div
      className={cn("w-full min-w-0 text-foreground", !interactive && "opacity-95")}
    >
      <div className={cn(isVisual ? "text-center" : "text-left")}>
        <h1 className="scroll-mt-20 text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>

        <div
          className={cn(
            "flex max-w-sm",
            isVisual ? "mx-auto mt-4 justify-center" : "mt-4",
          )}
        >
          <div
            className="inline-flex rounded-full p-0.5"
            style={{ background: "rgba(15,23,42,0.04)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)" }}
          >
            <button
              type="button"
              onClick={() => setTerm("12_months")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors md:px-4 md:text-sm",
                term === "12_months" ? "shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              style={
                term === "12_months"
                  ? { backgroundColor: style.primaryColor, color: activeTermFg }
                  : undefined
              }
            >
              {label12}
            </button>
            <button
              type="button"
              onClick={() => setTerm("24_months")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors md:px-4 md:text-sm",
                term === "24_months" ? "shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              style={
                term === "24_months"
                  ? { backgroundColor: style.primaryColor, color: activeTermFg }
                  : undefined
              }
            >
              {label24}
            </button>
          </div>
        </div>
      </div>

      {!interactive ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Preview — selections are saved on the shared link only.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-center text-sm text-destructive">{error}</p> : null}

      {selectedTierId && interactive ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          If you switch term, click <strong className="text-foreground">Select</strong> again on your tier to save the
          update.
        </p>
      ) : null}

      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4",
          isVisual ? "mt-5" : "mt-4",
        )}
      >
        {tiers.length === 0 ? (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            No package tiers configured yet.
          </p>
        ) : null}
        {tiers.map((tier) => {
          const mm = monthlyMinor(tier);
          const upfront =
            term === "12_months" && typeof tier.upfrontCost12Minor === "number" && tier.upfrontCost12Minor > 0
              ? tier.upfrontCost12Minor
              : undefined;
          const isSelected = selectedTierId === tier.id;
          const isRecommended = Boolean(tier.recommended);
          const busy = pendingTierId === tier.id;

          const cardStyle: React.CSSProperties | undefined = isRecommended
            ? {
                backgroundColor: style.highlightColor,
                color: recommendedFg,
                borderColor: style.highlightColor,
              }
            : undefined;
          const selectedRingStyle: React.CSSProperties | undefined = isSelected
            ? {
                boxShadow: `0 0 0 2px ${style.highlightColor}, 0 0 0 4px ${withAlpha(
                  style.highlightColor,
                  0.25,
                )}`,
              }
            : undefined;

          return (
            <div key={tier.id} className="flex flex-col">
              <div
                className={cn(
                  "relative flex min-h-0 flex-col rounded-xl border p-3.5 shadow-sm transition-colors sm:p-4",
                  isRecommended ? "pt-5 sm:pt-5" : "border-border/70 bg-card text-foreground",
                )}
                style={cardStyle}
              >
                {isRecommended ? (
                  <div
                    className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow"
                    style={{ backgroundColor: style.highlightColor, color: recommendedFg }}
                  >
                    Recommended
                  </div>
                ) : null}

                <h3 className={cn("text-base font-semibold", isRecommended ? "" : "text-foreground")}>
                  {tier.name}
                </h3>

                <ul
                  className={cn("mt-2 space-y-1 text-[13px] leading-snug", isRecommended ? "" : "text-muted-foreground")}
                  style={isRecommended ? { color: recommendedFg } : undefined}
                >
                  <li>
                    <span className="font-medium">Included users</span>:{" "}
                    {formatPackageTierIncluded(tier.includedUsers)}
                  </li>
                  <li>
                    <span className="font-medium">Included locations</span>:{" "}
                    {formatPackageTierIncluded(tier.includedLocations)}
                  </li>
                  <li>
                    <span className="font-medium">Included admins</span>:{" "}
                    {formatPackageTierIncluded(tier.includedAdmins)}
                  </li>
                </ul>

                <div
                  className="mt-3 border-t border-dashed pt-3"
                  style={{ borderColor: isRecommended ? recommendedFaintBorder : undefined }}
                >
                  <p
                    className={cn(
                      "text-xl font-semibold tabular-nums sm:text-2xl",
                      isRecommended ? "" : "text-foreground",
                    )}
                  >
                    {formatCurrencyAmount(mm, currency)}
                  </p>
                  <p
                    className={cn("text-xs", isRecommended ? "" : "text-muted-foreground")}
                    style={isRecommended ? { color: dimRecommendedFg } : undefined}
                  >
                    / month
                  </p>

                  {term === "12_months" ? (
                    <div
                      className="mt-2.5 rounded-md border border-dashed px-2.5 py-2 text-left"
                      style={{ borderColor: isRecommended ? recommendedFaintBorder : undefined }}
                    >
                      <p
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-wide",
                          isRecommended ? "" : "text-muted-foreground",
                        )}
                        style={isRecommended ? { color: dimRecommendedFg } : undefined}
                      >
                        12-month plan
                      </p>
                      {upfront !== undefined ? (
                        <p
                          className={cn(
                            "mt-0.5 text-xs tabular-nums",
                            isRecommended ? "" : "text-foreground",
                          )}
                        >
                          Upfront: {formatCurrencyAmount(upfront, currency)}
                        </p>
                      ) : (
                        <p
                          className={cn("mt-0.5 text-xs", isRecommended ? "" : "text-muted-foreground")}
                          style={isRecommended ? { color: dimRecommendedFg } : undefined}
                        >
                          No upfront charge
                        </p>
                      )}
                    </div>
                  ) : (
                    <p
                      className={cn("mt-2 text-[11px]", isRecommended ? "" : "text-muted-foreground")}
                      style={isRecommended ? { color: dimRecommendedFg } : undefined}
                    >
                      24-month term · billed monthly
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-3">
                  <Button
                    type="button"
                    disabled={!interactive || busy}
                    onClick={() => void selectTier(tier.id)}
                    variant="outline"
                    size="sm"
                    className={cn("w-full rounded-full font-semibold")}
                    style={{
                      ...(isRecommended
                        ? { backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#ffffff" }
                        : {}),
                      ...(selectedRingStyle ?? {}),
                    }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSelected ? "Selected" : "Select"}
                  </Button>
                </div>
              </div>

              {(tier.features ?? []).length > 0 ? (
                <ul className="mt-2 space-y-1.5 border-t border-border/40 pt-2 sm:mt-3 sm:pt-2.5">
                  {(tier.features ?? []).map((feat) => (
                    <li key={feat} className="flex gap-1.5 text-xs text-muted-foreground sm:text-[13px]">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/60 sm:h-4 sm:w-4"
                        style={{ color: style.highlightColor }}
                        aria-hidden
                      />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      {addonsActive && addonLines.length > 0 ? (
        <div className="mt-[50px] text-left">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card text-left shadow-sm">
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed px-4 py-3"
              style={{
                backgroundColor: style.primaryColor,
                color: totalBarFg,
                borderBottomColor: totalBarFg === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.18)",
              }}
            >
              <p className="text-sm font-semibold">{addonsTitle}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
                Monthly subtotal{" "}
                <span className="text-base tabular-nums">{formatCurrencyAmount(addonsSubtotalMinor, currency)}</span>
                <span className="ml-1 text-[10px] font-medium opacity-90">/ mo</span>
              </p>
            </div>
            <div className="overflow-x-auto bg-card text-left">
              <table className="w-full min-w-[320px] text-left text-sm [&_thead_th:first-child]:!text-left [&_tbody_td:first-child]:!text-left">
                <thead>
                  <tr className="border-b border-dashed border-border/50 bg-card text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 !text-left">Description</th>
                    <th className="px-4 py-2.5 text-right">Item</th>
                    {allowAddonEdit ? <th className="px-4 py-2.5 text-right">Quantity</th> : null}
                    <th className="px-4 py-2.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="[&_tr]:border-b [&_tr]:border-dashed [&_tr]:border-border/40">
                  {addonLines.map((li) => {
                    const qRaw = addonQty[li.id] ?? effectivePricingLineQuantity(li);
                    const hidden = Boolean(li.optional && addonOptOff[li.id]);
                    const lineTotal = Math.round(li.unitAmountMinor * qRaw);
                    return (
                      <tr key={li.id} className={cn("transition-opacity", hidden && "opacity-40")}>
                        <td className="px-4 py-3 !text-left align-middle">
                          <div className="flex min-w-0 w-full flex-col items-start gap-1 text-left">
                            <span className="block w-full text-left font-medium text-foreground">{li.label}</span>
                            {li.optional ? (
                              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                                  checked={!addonOptOff[li.id]}
                                  disabled={!interactive || !selectedTierId}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setAddonOptOff((prev) => ({ ...prev, [li.id]: !on }));
                                    if (interactive && shareToken && selectedTierId) {
                                      void flushAddonsToServer(
                                        addonQty,
                                        { ...addonOptOff, [li.id]: !on },
                                      );
                                    }
                                  }}
                                />
                                Include add-on
                              </label>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right align-middle tabular-nums text-muted-foreground">
                          {formatCurrencyAmount(li.unitAmountMinor, currency)}
                        </td>
                        {allowAddonEdit ? (
                          <td className="px-4 py-3 text-right align-middle">
                            <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                disabled={hidden || !interactive || !selectedTierId}
                                className="w-14 rounded-md border border-border/60 bg-background px-2 py-1 text-right text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                                value={qRaw}
                                onChange={(e) => {
                                  const n = Number(e.target.value);
                                  if (!Number.isFinite(n) || n < 0) return;
                                  setAddonQty((prev) => ({ ...prev, [li.id]: Math.floor(n) }));
                                }}
                                onBlur={() => {
                                  void flushAddonsToServer();
                                }}
                              />
                              <span className="text-xs text-muted-foreground">{qtyUnit}</span>
                            </span>
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-right align-middle tabular-nums font-medium text-foreground">
                          {hidden ? "—" : formatCurrencyAmount(lineTotal, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {!selectedTierId && interactive ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Select a plan above to configure add-ons and save your choices.
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "mt-[50px] flex flex-col gap-2 rounded-xl border border-border/70 px-4 py-3 shadow-sm",
          isVisual ? "mx-auto max-w-md" : "",
        )}
        style={{ backgroundColor: style.primaryColor, color: totalBarFg }}
      >
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="min-w-0 shrink text-xl font-semibold leading-none sm:text-2xl">{totalSectionLabel}</span>
          <div className="min-w-0 shrink-0 text-right">
            <span className="text-xl font-semibold tabular-nums leading-none sm:text-2xl">
              {formatCurrencyAmount(monthlyTotalMinor, currency)}
            </span>
            <p className="mt-0.5 text-xs font-medium opacity-90">/ month</p>
          </div>
        </div>
        {!selectedTierId ? (
          <p className="text-xs opacity-85">Choose a plan to include subscription pricing in this total.</p>
        ) : null}
        {selectedTierId || addonsSubtotalMinor > 0 ? (
          <p className="max-w-[280px] text-pretty text-left text-[11px] leading-snug opacity-80 sm:ml-auto sm:text-right">
            Total commitment over {termMonths} mo:{" "}
            <span className="whitespace-nowrap tabular-nums font-medium opacity-95">
              {formatCurrencyAmount(commitmentTotalMinor, currency)}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
