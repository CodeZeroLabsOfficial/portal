"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import type { PackagesBlock, PackageTier, PackagesPublicSelection } from "@/types/proposal";
import { formatCurrencyAmount } from "@/lib/format";
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

/** Simple-style column: centered plan + price + CTA; features left-aligned (Qwilr-like). */
function SimpleTierColumnPublic({
  tier,
  currency,
  term,
  monthlyMinor,
  isSelected,
  isRecommended,
  busy,
  interactive,
  accentColor,
  onSelect,
}: {
  tier: PackageTier;
  currency: string;
  term: "12_months" | "24_months";
  monthlyMinor: number;
  isSelected: boolean;
  isRecommended: boolean;
  busy: boolean;
  interactive: boolean;
  /** Badge + filled selected button (typically primaryColour). */
  accentColor: string;
  onSelect: () => void;
}) {
  const onAccentFg = readableForeground(accentColor);
  const upfront =
    term === "12_months" && typeof tier.upfrontCost12Minor === "number" && tier.upfrontCost12Minor > 0
      ? tier.upfrontCost12Minor
      : undefined;

  return (
    <div className="relative flex min-w-[min(100%,10rem)] flex-1 flex-col px-3 py-5 sm:min-w-[9rem] sm:px-4 md:px-5 lg:py-7">
      <div className="flex min-h-8 shrink-0 items-start justify-center sm:min-h-9">
        {isRecommended ? (
          <span
            className="rounded-full px-3 py-1 text-[11px] font-semibold shadow-none"
            style={{ backgroundColor: accentColor, color: onAccentFg }}
          >
            Recommended
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 text-center text-sm font-semibold text-neutral-800 md:text-[15px]">{tier.name}</h3>

      <div className="mt-6 text-center md:mt-7">
        <p className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900 md:text-[1.75rem]">
          {formatCurrencyAmount(monthlyMinor, currency)}
        </p>
        <p className="mt-1 text-[13px] text-neutral-500">/ month</p>
      </div>

      {term === "12_months" ? (
        upfront !== undefined ? (
          <p className="mt-3 text-center text-[11px] text-neutral-500">
            Upfront {formatCurrencyAmount(upfront, currency)}
          </p>
        ) : (
          <p className="mt-3 text-center text-[11px] text-neutral-500">No upfront charge</p>
        )
      ) : (
        <p className="mt-3 text-center text-[11px] text-neutral-500">24-month · billed monthly</p>
      )}

      {/* Mirrors Qwilr “quantity”; maps to configured included seats (not buyer-editable). */}
      <div className="mt-5 flex items-center justify-center gap-2">
        <span className="inline-flex min-h-8 min-w-[2rem] items-center justify-center rounded-md border border-[#E5E7EB] bg-white px-2 text-sm font-medium tabular-nums text-neutral-800">
          {tier.includedUsers ?? 0}
        </span>
        <span className="text-xs text-neutral-500">Users</span>
      </div>

      <div className="mt-6">
        <Button
          type="button"
          disabled={!interactive || busy}
          onClick={onSelect}
          size="sm"
          variant={isSelected ? "default" : "outline"}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-4 text-[13px] font-semibold",
            !isSelected && "border-neutral-300 bg-white text-neutral-700 shadow-none hover:bg-neutral-50",
          )}
          style={
            isSelected
              ? { backgroundColor: accentColor, color: onAccentFg, borderColor: accentColor }
              : undefined
          }
        >
          {busy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
          {isSelected ? <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden /> : null}
          {isSelected ? "Selected" : "Select"}
        </Button>
      </div>

      <div className="mt-10 border-t border-[#EBEDF0] pt-6 text-left md:mt-12">
        <ul className="space-y-2.5 text-[13px] leading-snug text-neutral-600">
          <li className="flex gap-2">
            <Check className="mt-0.5 size-[15px] shrink-0 text-neutral-400" style={{ color: accentColor }} aria-hidden />
            <span>
              <span className="font-medium text-neutral-800">Included users</span> {tier.includedUsers ?? 0}
            </span>
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 size-[15px] shrink-0 text-neutral-400" style={{ color: accentColor }} aria-hidden />
            <span>
              <span className="font-medium text-neutral-800">Locations</span> {tier.includedLocations ?? 0}
            </span>
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 size-[15px] shrink-0 text-neutral-400" style={{ color: accentColor }} aria-hidden />
            <span>
              <span className="font-medium text-neutral-800">Admins</span> {tier.includedAdmins ?? 0}
            </span>
          </li>
          {(tier.features ?? []).map((feat, i) => (
            <li key={`${i}-${feat}`} className="flex gap-2">
              <Check className="mt-0.5 size-[15px] shrink-0 text-neutral-400" style={{ color: accentColor }} aria-hidden />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
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

  React.useEffect(() => {
    if (initialSelection?.tierId) setSelectedTierId(initialSelection.tierId);
    if (initialSelection?.term) setTerm(initialSelection.term);
  }, [initialSelection?.tierId, initialSelection?.term]);

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
    });
    setPendingTierId(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSelectedTierId(tierId);
    router.refresh();
  }

  const containerStyle: React.CSSProperties | undefined = isVisual
    ? {
        background: `linear-gradient(180deg, ${withAlpha(style.primaryColor, 0.08)} 0%, ${withAlpha(
          style.primaryColor,
          0.02,
        )} 100%)`,
        borderColor: withAlpha(style.primaryColor, 0.18),
      }
    : undefined;

  /** Qwilr-style simple: airy columns separated by thin vertical rules, no tinted “hero” card shells. */
  const isSimple = !isVisual;

  return (
    <div
      className={cn(
        "overflow-hidden text-foreground transition-colors",
        isVisual
          ? "rounded-xl border bg-card p-4 shadow-sm md:p-6"
          : cn(
              "rounded-lg border bg-card px-0 py-4 shadow-none md:py-6",
              "border-[#E8EAED]",
            ),
        !interactive && "opacity-95 ring-1 ring-dashed ring-border",
      )}
      style={containerStyle}
    >
      <div className={cn(isVisual ? "text-center" : "px-4 text-center md:px-6")}>
        <h2
          className={cn(
            "font-semibold tracking-tight text-foreground",
            isVisual ? "text-lg md:text-xl" : "text-base md:text-lg",
          )}
        >
          {title}
        </h2>

        <div
          className={cn(
            "flex max-w-sm",
            isVisual ? "mx-auto mt-3 justify-center" : "mx-auto mt-3 justify-center",
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

      {isSimple ? (
        <div
          className={cn(
            "mt-5 flex max-w-none flex-col overflow-x-auto sm:mt-6",
            tiers.length === 0 && "items-center py-8",
          )}
        >
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No package tiers configured yet.</p>
          ) : (
            <div className="flex min-w-0 divide-x divide-[#E8EAED]">
              {tiers.map((tier) => (
                <SimpleTierColumnPublic
                  key={tier.id}
                  tier={tier}
                  currency={currency}
                  term={term}
                  monthlyMinor={monthlyMinor(tier)}
                  isSelected={selectedTierId === tier.id}
                  isRecommended={Boolean(tier.recommended)}
                  busy={pendingTierId === tier.id}
                  interactive={interactive}
                  accentColor={style.primaryColor}
                  onSelect={() => void selectTier(tier.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-3 sm:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4",
            "mt-5",
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
                    className={cn(
                      "mt-2 space-y-1 text-[13px] leading-snug",
                      isRecommended ? "" : "text-muted-foreground",
                    )}
                    style={isRecommended ? { color: recommendedFg } : undefined}
                  >
                    <li>
                      <span className="font-medium">Included users</span>: {tier.includedUsers ?? 0}
                    </li>
                    <li>
                      <span className="font-medium">Included locations</span>:{" "}
                      {tier.includedLocations ?? 0}
                    </li>
                    <li>
                      <span className="font-medium">Included admins</span>: {tier.includedAdmins ?? 0}
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
      )}
    </div>
  );
}
