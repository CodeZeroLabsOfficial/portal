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
              onClick={() => setTerm("12_months")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors",
                term === "12_months" ? "bg-white text-zinc-900 shadow" : "text-zinc-400 hover:text-white",
              )}
            >
              {label12}
            </button>
            <button
              type="button"
              onClick={() => setTerm("24_months")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors",
                term === "24_months" ? "bg-white text-zinc-900 shadow" : "text-zinc-400 hover:text-white",
              )}
            >
              {label24}
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
          If you switch term, click <strong className="text-zinc-300">Select</strong> again on your tier to save the
          update.
        </p>
      ) : null}

      <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-4">
        {tiers.length === 0 ? (
          <p className="col-span-full text-center text-sm text-zinc-400">No package tiers configured yet.</p>
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

          return (
            <div key={tier.id} className="flex flex-col">
              <div
                className={cn(
                  "relative flex min-h-[320px] flex-col rounded-2xl border p-5 shadow-lg transition-colors md:min-h-[380px]",
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

                <ul
                  className={cn(
                    "mt-4 space-y-1.5 text-sm",
                    isRecommended ? "text-teal-50/95" : "text-zinc-600",
                  )}
                >
                  <li>
                    <span className={cn("font-medium", isRecommended ? "text-teal-100" : "text-zinc-800")}>
                      Included users
                    </span>
                    : {tier.includedUsers ?? 0}
                  </li>
                  <li>
                    <span className={cn("font-medium", isRecommended ? "text-teal-100" : "text-zinc-800")}>
                      Included locations
                    </span>
                    : {tier.includedLocations ?? 0}
                  </li>
                  <li>
                    <span className={cn("font-medium", isRecommended ? "text-teal-100" : "text-zinc-800")}>
                      Included admins
                    </span>
                    : {tier.includedAdmins ?? 0}
                  </li>
                </ul>

                <div className="mt-6 border-t border-dashed pt-4" style={{ borderColor: isRecommended ? "rgba(45,212,191,0.25)" : undefined }}>
                  <p className={cn("text-3xl font-semibold tabular-nums", isRecommended ? "text-white" : "text-zinc-900")}>
                    {formatCurrencyAmount(mm, currency)}
                  </p>
                  <p className={cn("text-sm", isRecommended ? "text-teal-100/90" : "text-zinc-500")}>/ month</p>

                  {term === "12_months" ? (
                    <div className="mt-4 rounded-lg border border-dashed px-3 py-2.5 text-left" style={{ borderColor: isRecommended ? "rgba(45,212,191,0.35)" : undefined }}>
                      <p
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-wide",
                          isRecommended ? "text-teal-200/90" : "text-zinc-500",
                        )}
                      >
                        12-month plan
                      </p>
                      {upfront !== undefined ? (
                        <p className={cn("mt-1 text-sm tabular-nums", isRecommended ? "text-white" : "text-zinc-900")}>
                          Upfront: {formatCurrencyAmount(upfront, currency)}
                        </p>
                      ) : (
                        <p className={cn("mt-1 text-sm", isRecommended ? "text-teal-100/80" : "text-zinc-500")}>
                          No upfront charge
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className={cn("mt-3 text-xs", isRecommended ? "text-teal-100/75" : "text-zinc-500")}>
                      24-month term · billed monthly
                    </p>
                  )}
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

              {(tier.features ?? []).length > 0 ? (
                <ul className="mt-5 space-y-2.5">
                  {(tier.features ?? []).map((feat) => (
                    <li key={feat} className="flex gap-2 text-sm text-zinc-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden />
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
