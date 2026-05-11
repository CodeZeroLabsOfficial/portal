"use client";

import * as React from "react";
import type { PricingBlock } from "@/types/proposal";
import { formatCurrencyAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { readableForeground, resolveBlockStyle, withAlpha } from "@/lib/block-style";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";

type LineState = Record<string, number>;

export interface PricingBlockPublicProps {
  block: PricingBlock;
  className?: string;
}

/** Persist qty keyed by line item across reorder/filter unchanged IDs only sync additions/removals */
export function PricingBlockPublic({ block, className }: PricingBlockPublicProps) {
  const lineItems = block.lineItems ?? [];
  const qtyUnit = (block.quantityUnitLabel ?? "Unit").trim() || "Unit";

  const [qty, setQty] = React.useState<LineState>(() =>
    Object.fromEntries(lineItems.map((li) => [li.id, effectivePricingLineQuantity(li)])),
  );
  const [optionalOff, setOptionalOff] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setQty((prev) =>
      Object.fromEntries(
        lineItems.map((li) => [li.id, typeof prev[li.id] === "number" ? prev[li.id]! : effectivePricingLineQuantity(li)]),
      ),
    );
  }, [lineItems]);

  const currency = (block.currency ?? "aud").toUpperCase();

  const totalMinor = lineItems.reduce((sum, li) => {
    if (li.optional && optionalOff[li.id]) return sum;
    const q = qty[li.id] ?? effectivePricingLineQuantity(li);
    return sum + Math.round(li.unitAmountMinor * q);
  }, 0);

  const editable = block.allowQuantityEdit !== false;
  const style = resolveBlockStyle(block.style);
  const isVisual = style.variant === "visual";
  const isSimpleTable = !isVisual;

  const headerBarFg = readableForeground(style.primaryColor);

  const headerSimpleStyle: React.CSSProperties = {
    backgroundColor: style.primaryColor,
    color: headerBarFg,
    borderColor: style.primaryColor,
  };
  const headerSimpleDividerColor =
    headerBarFg === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.18)";

  const visualHeaderStyle: React.CSSProperties | undefined = isVisual
    ? {
        background: withAlpha(style.primaryColor, 0.08),
        borderBottomColor: withAlpha(style.primaryColor, 0.2),
      }
    : undefined;

  const totalRowStyle: React.CSSProperties = {
    background: withAlpha(style.highlightColor, isVisual ? 0.15 : 0.08),
  };

  const containerStyle: React.CSSProperties | undefined =
    isVisual ? { borderColor: withAlpha(style.primaryColor, 0.25) } : undefined;

  return (
    <div
      className={cn(
        "overflow-hidden bg-card shadow-sm",
        "rounded-xl border border-border/70",
        className,
      )}
      style={containerStyle}
    >
      {block.title ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 px-4 py-3",
            isSimpleTable ? "rounded-t-xl border-b border-dashed" : "border-b border-border/60",
          )}
          style={
            isSimpleTable
              ? { ...headerSimpleStyle, borderBottomColor: headerSimpleDividerColor }
              : { ...visualHeaderStyle, borderBottomColor: visualHeaderStyle?.borderBottomColor ?? undefined }
          }
        >
          <p
            className={cn(
              "min-w-0 flex-1 text-base font-semibold",
              isSimpleTable ? "" : "text-foreground",
            )}
            style={isSimpleTable ? { color: headerBarFg } : undefined}
          >
            {block.title}
          </p>
          {isSimpleTable ? (
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                Subtotal
              </span>
              <span className="text-lg font-semibold tabular-nums leading-none">
                {formatCurrencyAmount(totalMinor, currency)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto bg-card">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr
              className={cn(
                "border-b border-dashed text-left text-[11px] font-medium uppercase tracking-wide",
                isSimpleTable
                  ? "border-border/50 bg-card text-muted-foreground"
                  : "border-border/60 bg-muted/20 text-muted-foreground",
              )}
            >
              <th className="px-4 py-2.5">{isSimpleTable ? "Description" : "Item"}</th>
              <th className="px-4 py-2.5 text-right">{isSimpleTable ? "Item" : "Unit"}</th>
              {editable ? (
                <th className="px-4 py-2.5 text-right">{isSimpleTable ? "Quantity" : "Qty"}</th>
              ) : null}
              <th className="px-4 py-2.5 text-right">{isSimpleTable ? "Price" : "Line total"}</th>
            </tr>
          </thead>
          <tbody
            className={cn(
              "[&_tr]:border-b [&_tr]:border-border/40",
              isSimpleTable && "[&_tr]:border-dashed",
            )}
          >
            {lineItems.map((li) => {
              const qRaw = qty[li.id] ?? effectivePricingLineQuantity(li);
              const hidden = Boolean(li.optional && optionalOff[li.id]);
              const lineTotal = Math.round(li.unitAmountMinor * qRaw);
              return (
                <tr key={li.id} className={cn("transition-opacity", hidden && "opacity-40")}>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{li.label}</span>
                      {li.optional ? (
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 text-[12px]",
                            "text-muted-foreground",
                          )}
                        >
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
                  <td className="px-4 py-3 text-right align-middle tabular-nums text-muted-foreground">
                    {formatCurrencyAmount(li.unitAmountMinor, currency)}
                  </td>
                  {editable ? (
                    <td className="px-4 py-3 text-right align-middle">
                      <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          disabled={hidden}
                          className="w-14 rounded-md border border-border/60 bg-background px-2 py-1 text-right text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                          value={qRaw}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n) || n < 0) return;
                            setQty((prev) => ({ ...prev, [li.id]: Math.floor(n) }));
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
          {!isSimpleTable ? (
            <tfoot>
              <tr style={totalRowStyle}>
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
          ) : null}
        </table>
      </div>
    </div>
  );
}
