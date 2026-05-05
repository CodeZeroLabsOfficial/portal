"use client";

import * as React from "react";
import type { PricingBlock } from "@/types/proposal";
import { formatCurrencyAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

type LineState = Record<string, number>;

export interface PricingBlockPublicProps {
  block: PricingBlock;
  className?: string;
}

export function PricingBlockPublic({ block, className }: PricingBlockPublicProps) {
  const lineItems = block.lineItems ?? [];
  const [qty, setQty] = React.useState<LineState>(() =>
    Object.fromEntries(
      lineItems.map((li) => [li.id, typeof li.quantity === "number" && li.quantity > 0 ? li.quantity : 1]),
    ),
  );
  const [optionalOff, setOptionalOff] = React.useState<Record<string, boolean>>({});

  const currency = (block.currency ?? "aud").toUpperCase();

  const totalMinor = lineItems.reduce((sum, li) => {
    if (li.optional && optionalOff[li.id]) return sum;
    const q = qty[li.id] ?? 1;
    return sum + Math.round(li.unitAmountMinor * q);
  }, 0);

  const editable = block.allowQuantityEdit !== false;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm", className)}>
      {block.title ? (
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-base font-semibold text-foreground">{block.title}</p>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2 text-right">Unit</th>
              {editable ? <th className="px-4 py-2 text-right">Qty</th> : null}
              <th className="px-4 py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li) => {
              const q = qty[li.id] ?? 1;
              const lineTotal = Math.round(li.unitAmountMinor * q);
              const hidden = Boolean(li.optional && optionalOff[li.id]);
              return (
                <tr key={li.id} className={cn("border-b border-border/40", hidden && "opacity-40")}>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{li.label}</span>
                      {li.optional ? (
                        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-border accent-primary"
                            checked={!optionalOff[li.id]}
                            onChange={(e) =>
                              setOptionalOff((o) => ({ ...o, [li.id]: !e.target.checked }))
                            }
                          />
                          Include add-on
                        </label>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrencyAmount(li.unitAmountMinor, currency)}
                  </td>
                  {editable ? (
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        disabled={hidden}
                        className="w-16 rounded-md border border-input bg-background px-2 py-1 text-right tabular-nums"
                        value={q}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n) || n < 1) return;
                          setQty((prev) => ({ ...prev, [li.id]: Math.floor(n) }));
                        }}
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                    {hidden ? "—" : formatCurrencyAmount(lineTotal, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/15">
              <td
                colSpan={editable ? 3 : 2}
                className="px-4 py-3 text-right text-[13px] font-semibold text-foreground"
              >
                Total
              </td>
              <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-foreground">
                {formatCurrencyAmount(totalMinor, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
