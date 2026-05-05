"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import type { PackagesBlock, PackagesPublicSelection } from "@/types/proposal";
import { formatCurrencyAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  const currency = block.currency.toUpperCase();

  const [billing, setBilling] = React.useState<"monthly" | "yearly">(
    initialSelection?.billing ?? "yearly",
  );
  const [quantity, setQuantity] = React.useState(
    initialSelection?.quantity ?? block.defaultQuantity ?? 1,
  );
  const [selectedTierId, setSelectedTierId] = React.useState<string | null>(
    initialSelection?.tierId ?? null,
  );
  const [pendingTierId, setPendingTierId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialSelection?.tierId) setSelectedTierId(initialSelection.tierId);
    if (initialSelection?.billing) setBilling(initialSelection.billing);
    if (initialSelection?.quantity) setQuantity(initialSelection.quantity);
  }, [initialSelection?.tierId, initialSelection?.billing, initialSelection?.quantity]);

  const monthlyLabel = block.monthlyLabel ?? "Monthly";
  const yearlyLabel = block.yearlyLabel ?? "Yearly";
  const qtyLabel = block.quantityLabel ?? "Users";
  const title = block.title ?? "Packages";

  function unitMinor(tier: (typeof block.tiers)[0]): { current: number; original?: number } {
    if (billing === "monthly") {
      return {
        current: tier.monthlyAmountMinor,
        original: tier.monthlyOriginalMinor,
      };
    }
    return {
      current: tier.yearlyAmountMinor,
      original: tier.yearlyOriginalMinor,
    };
  }

  function lineTotalMinor(tier: (typeof block.tiers)[0]): { current: number; original?: number } {
    const u = unitMinor(tier);
    return {
      current: Math.round(u.current * quantity),
      original: u.original !== undefined ? Math.round(u.original * quantity) : undefined,
    };
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
      billing,
      quantity,
    });
    setPendingTierId(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSelectedTierId(tierId);
    router.refresh();
  }

  const intervalSuffix = billing === "monthly" ? "/ month" : "/ year";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-6 text-zinc-100 shadow-xl md:p-10",
        !interactive && "opacity-95 ring-1 ring-dashed ring-border",
      )}
    >
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{title}</h2>

        <div className="mx-auto mt-6 flex max-w-md justify-center">
          <div className="inline-flex rounded-full bg-zinc-900/90 p-1 ring-1 ring-zinc-700/80">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors",
                billing === "monthly" ? "bg-white text-zinc-900 shadow" : "text-zinc-400 hover:text-white",
              )}
            >
              {monthlyLabel}
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={cn(
                "relative rounded-full px-5 py-2 text-sm font-medium transition-colors",
                billing === "yearly" ? "bg-white text-zinc-900 shadow" : "text-zinc-400 hover:text-white",
              )}
            >
              {yearlyLabel}
              {block.yearlyBadgeText ? (
                <span className="absolute -right-1 -top-2 whitespace-nowrap rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                  {block.yearlyBadgeText}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {!interactive ? (
        <p className="mt-4 text-center text-xs text-zinc-500">Preview — selections are saved on the shared link only.</p>
      ) : null}

      {error ? <p className="mt-4 text-center text-sm text-red-400">{error}</p> : null}

      {selectedTierId && interactive ? (
        <p className="mt-4 text-center text-xs text-zinc-500">
          If you switch billing or change {qtyLabel.toLowerCase()}, click <strong className="text-zinc-300">Select</strong>{" "}
          again on your tier to save the update.
        </p>
      ) : null}

      <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-4">
        {block.tiers.map((tier) => {
          const totals = lineTotalMinor(tier);
          const isSelected = selectedTierId === tier.id;
          const isRecommended = Boolean(tier.recommended);
          const busy = pendingTierId === tier.id;

          return (
            <div key={tier.id} className="flex flex-col">
              <div
                className={cn(
                  "relative flex min-h-[320px] flex-col rounded-2xl border p-5 shadow-lg transition-colors md:min-h-[340px]",
                  isRecommended
                    ? "border-teal-500/60 bg-teal-900/25 pt-6 ring-2 ring-teal-500/40"
                    : "border-zinc-700/80 bg-white text-zinc-900",
                )}
              >
                {isRecommended ? (
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
                    Recommended
                  </div>
                ) : null}

                <h3 className={cn("text-lg font-semibold", isRecommended ? "text-white" : "text-zinc-900")}>
                  {tier.name}
                </h3>

                <div className="mt-4 space-y-1">
                  {totals.original !== undefined && totals.original > totals.current ? (
                    <p
                      className={cn(
                        "text-sm line-through opacity-70",
                        isRecommended ? "text-zinc-300" : "text-zinc-500",
                      )}
                    >
                      {formatCurrencyAmount(totals.original, currency)}
                    </p>
                  ) : null}
                  <p className={cn("text-3xl font-semibold tabular-nums", isRecommended ? "text-white" : "text-zinc-900")}>
                    {formatCurrencyAmount(totals.current, currency)}
                  </p>
                  <p className={cn("text-sm", isRecommended ? "text-teal-100/90" : "text-zinc-500")}>
                    {intervalSuffix}
                  </p>
                </div>

                <div className="mt-6 border-t border-dashed pt-4" style={{ borderColor: isRecommended ? "rgba(45,212,191,0.25)" : undefined }}>
                  <label
                    className={cn(
                      "text-xs font-medium uppercase tracking-wide",
                      isRecommended ? "text-teal-100/80" : "text-zinc-500",
                    )}
                  >
                    {qtyLabel}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      disabled={!interactive}
                      value={quantity}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n) || n < 1) return;
                        setQuantity(Math.floor(n));
                      }}
                      className={cn(
                        "w-full border-0 border-b bg-transparent py-1 text-lg font-medium tabular-nums outline-none focus:ring-0",
                        isRecommended
                          ? "border-teal-400/50 text-white placeholder:text-zinc-500"
                          : "border-zinc-300 text-zinc-900",
                      )}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Button
                    type="button"
                    disabled={!interactive || busy}
                    onClick={() => void selectTier(tier.id)}
                    className={cn(
                      "w-full font-semibold",
                      isRecommended
                        ? "bg-white text-zinc-900 hover:bg-zinc-100"
                        : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
                      isSelected && "ring-2 ring-teal-500 ring-offset-2 ring-offset-transparent",
                    )}
                    variant={isRecommended ? "default" : "outline"}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSelected ? "Selected" : "Select"}
                  </Button>
                </div>
              </div>

              <ul className="mt-5 space-y-2.5">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex gap-2 text-sm text-zinc-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
