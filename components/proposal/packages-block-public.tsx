"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import type { PackagesBlock, PackagesPublicSelection } from "@/types/proposal";
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

  return (
    <div
      className={cn(
        "overflow-hidden text-foreground transition-colors",
        isVisual
          ? "rounded-2xl border bg-card p-6 shadow-sm md:p-10"
          : "rounded-xl border border-border/70 bg-card p-4 md:p-6",
        !interactive && "opacity-95 ring-1 ring-dashed ring-border",
      )}
      style={containerStyle}
    >
      <div className={cn(isVisual ? "text-center" : "text-left")}>
        <h2
          className={cn(
            "font-semibold tracking-tight text-foreground",
            isVisual ? "text-xl md:text-2xl" : "text-lg md:text-xl",
          )}
        >
          {title}
        </h2>

        <div
          className={cn(
            "flex max-w-md",
            isVisual ? "mx-auto mt-6 justify-center" : "mt-3",
          )}
        >
          <div
            className="inline-flex rounded-full p-1"
            style={{ background: "rgba(15,23,42,0.04)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)" }}
          >
            <button
              type="button"
              onClick={() => setTerm("12_months")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors",
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
                "rounded-full px-5 py-2 text-sm font-medium transition-colors",
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
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Preview — selections are saved on the shared link only.
        </p>
      ) : null}

      {error ? <p className="mt-4 text-center text-sm text-destructive">{error}</p> : null}

      {selectedTierId && interactive ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          If you switch term, click <strong className="text-foreground">Select</strong> again on your tier to save the
          update.
        </p>
      ) : null}

      <div
        className={cn(
          "grid gap-6 md:grid-cols-3 md:gap-4",
          isVisual ? "mt-10" : "mt-6",
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
                  "relative flex min-h-[320px] flex-col rounded-2xl border p-5 shadow-md transition-colors md:min-h-[380px]",
                  isRecommended ? "pt-6" : "border-border/70 bg-card text-foreground",
                )}
                style={cardStyle}
              >
                {isRecommended ? (
                  <div
                    className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide shadow"
                    style={{ backgroundColor: style.highlightColor, color: recommendedFg }}
                  >
                    Recommended
                  </div>
                ) : null}

                <h3 className={cn("text-lg font-semibold", isRecommended ? "" : "text-foreground")}>
                  {tier.name}
                </h3>

                <ul
                  className={cn("mt-4 space-y-1.5 text-sm", isRecommended ? "" : "text-muted-foreground")}
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
                  className="mt-6 border-t border-dashed pt-4"
                  style={{ borderColor: isRecommended ? recommendedFaintBorder : undefined }}
                >
                  <p
                    className={cn(
                      "text-3xl font-semibold tabular-nums",
                      isRecommended ? "" : "text-foreground",
                    )}
                  >
                    {formatCurrencyAmount(mm, currency)}
                  </p>
                  <p
                    className={cn("text-sm", isRecommended ? "" : "text-muted-foreground")}
                    style={isRecommended ? { color: dimRecommendedFg } : undefined}
                  >
                    / month
                  </p>

                  {term === "12_months" ? (
                    <div
                      className="mt-4 rounded-lg border border-dashed px-3 py-2.5 text-left"
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
                            "mt-1 text-sm tabular-nums",
                            isRecommended ? "" : "text-foreground",
                          )}
                        >
                          Upfront: {formatCurrencyAmount(upfront, currency)}
                        </p>
                      ) : (
                        <p
                          className={cn("mt-1 text-sm", isRecommended ? "" : "text-muted-foreground")}
                          style={isRecommended ? { color: dimRecommendedFg } : undefined}
                        >
                          No upfront charge
                        </p>
                      )}
                    </div>
                  ) : (
                    <p
                      className={cn("mt-3 text-xs", isRecommended ? "" : "text-muted-foreground")}
                      style={isRecommended ? { color: dimRecommendedFg } : undefined}
                    >
                      24-month term · billed monthly
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-6">
                  <Button
                    type="button"
                    disabled={!interactive || busy}
                    onClick={() => void selectTier(tier.id)}
                    variant="outline"
                    className={cn("w-full font-semibold")}
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
                <ul className="mt-5 space-y-2.5">
                  {(tier.features ?? []).map((feat) => (
                    <li key={feat} className="flex gap-2 text-sm text-foreground">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
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
    </div>
  );
}
