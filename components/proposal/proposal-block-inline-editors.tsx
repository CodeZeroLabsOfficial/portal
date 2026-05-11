"use client";

import * as React from "react";
import { Check, Plus, Sparkles, TableProperties, X } from "lucide-react";
import type {
  PackageTier,
  PackagesBlock,
  PackagesPublicSelection,
  PricingBlock,
  PricingLineItem,
} from "@/types/proposal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrencyAmount } from "@/lib/format";
import { readableForeground, resolveBlockStyle, withAlpha } from "@/lib/block-style";
import {
  DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR,
  PACKAGE_TIER_UNLIMITED_VALUE,
} from "@/lib/package-tier-limits";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import {
  packageAddonsTotalMinor,
  packageCommitmentTotalMinor,
  packageMonthlyTotalMinor,
  packageTermMonths,
  packagesAddonsSectionActive,
} from "@/lib/proposal-packages-totals";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* -----------------------------------------------------------------------------
 * Inline edit primitives
 * Each renders a clickable read-mode chip; on activation it swaps to a focused
 * input. Enter / blur commits, Escape cancels. Designed so the editor feels
 * like the public viewer — no sidebar form fields.
 * -------------------------------------------------------------------------- */

interface InlineTextProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
  /** Tone of the read-mode hover hint. */
  tone?: "light" | "dark";
}

function InlineText({
  value,
  onChange,
  placeholder = "Click to edit",
  ariaLabel,
  className,
  inputClassName,
  tone = "light",
}: InlineTextProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "w-full min-w-0 rounded-md border border-current/30 bg-transparent px-1.5 py-0.5 outline-none focus:border-current/60",
          inputClassName ?? className,
        )}
      />
    );
  }

  const isEmpty = !value;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={ariaLabel}
      className={cn(
        "group/inline rounded-md border border-transparent px-1.5 py-0.5 text-left transition-colors",
        tone === "dark"
          ? "hover:bg-white/10 hover:border-white/20"
          : "hover:bg-foreground/5 hover:border-border",
        isEmpty && "opacity-60",
        className,
      )}
    >
      {value || <span className="italic">{placeholder}</span>}
    </button>
  );
}

interface InlineNumberProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
  width?: string;
  ariaLabel?: string;
  className?: string;
  tone?: "light" | "dark";
}

function InlineNumber({
  value,
  onChange,
  min = 0,
  step = 1,
  width = "w-16",
  ariaLabel,
  className,
  tone = "light",
}: InlineNumberProps) {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);

  function commit(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min) {
      setDraft(String(value));
      return;
    }
    const rounded = step >= 1 ? Math.floor(n) : n;
    if (rounded !== value) onChange(rounded);
    setDraft(String(rounded));
  }

  return (
    <input
      type="number"
      min={min}
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel}
      className={cn(
        "rounded-md border border-current/20 bg-transparent px-1.5 py-0.5 text-center tabular-nums outline-none transition-colors focus:border-current/60",
        tone === "dark" ? "hover:bg-white/10" : "hover:bg-foreground/5",
        width,
        className,
      )}
    />
  );
}

interface InlinePriceProps {
  /** Stored in minor units. */
  minor: number;
  onChange: (nextMinor: number) => void;
  currency: string;
  ariaLabel?: string;
  className?: string;
  tone?: "light" | "dark";
}

function InlinePrice({ minor, onChange, currency, ariaLabel, className, tone = "light" }: InlinePriceProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(((minor ?? 0) / 100).toString());
  React.useEffect(() => {
    if (!editing) setDraft(((minor ?? 0) / 100).toString());
  }, [editing, minor]);

  function commit() {
    setEditing(false);
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 0) return;
    const next = Math.round(n * 100);
    if (next !== minor) onChange(next);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        aria-label={ariaLabel}
        className={cn(
          "w-full min-w-0 rounded-md border border-current/40 bg-transparent px-2 py-1 text-center tabular-nums outline-none focus:border-current/60",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={ariaLabel}
      className={cn(
        "rounded-md border border-transparent px-2 py-0.5 tabular-nums transition-colors",
        tone === "dark"
          ? "hover:bg-white/10 hover:border-white/20"
          : "hover:bg-foreground/5 hover:border-border",
        className,
      )}
    >
      {formatCurrencyAmount(minor ?? 0, currency)}
    </button>
  );
}

/* -----------------------------------------------------------------------------
 * Plans (packages) — inline editor.
 * Visually mirrors PackagesBlockPublic so the admin sees what customers see.
 * -------------------------------------------------------------------------- */

export interface PackagesInlineEditorProps {
  block: PackagesBlock;
  onChange: (next: PackagesBlock) => void;
}

function defaultTier(): PackageTier {
  return {
    id: newId(),
    name: "New tier",
    includedUsers: 0,
    includedLocations: 0,
    includedAdmins: 0,
    monthlyCost12Minor: 0,
    monthlyCost24Minor: 0,
    upfrontCost12Minor: DEFAULT_PACKAGES_UPFRONT_COST_12_MINOR,
    features: [],
  };
}

export function PackagesInlineEditor({ block, onChange }: PackagesInlineEditorProps) {
  const tiers = block.tiers ?? [];
  const currency = (block.currency ?? "aud").toUpperCase();
  const [term, setTerm] = React.useState<"12_months" | "24_months">("24_months");
  const style = resolveBlockStyle(block.style);
  const isVisual = style.variant === "visual";

  function patch(next: Partial<PackagesBlock>) {
    onChange({ ...block, ...next });
  }
  function patchTier(id: string, next: Partial<PackageTier>) {
    onChange({ ...block, tiers: tiers.map((t) => (t.id === id ? { ...t, ...next } : t)) });
  }
  function removeTier(id: string) {
    onChange({ ...block, tiers: tiers.filter((t) => t.id !== id) });
  }
  function addTier() {
    onChange({ ...block, tiers: [...tiers, defaultTier()] });
  }
  function toggleRecommended(id: string) {
    onChange({
      ...block,
      tiers: tiers.map((t) => ({ ...t, recommended: t.id === id ? !t.recommended : false })),
    });
  }

  const addonLineItems = block.addonLineItems ?? [];
  const addonQtyUnitDraft = ((block.addonQuantityUnitLabel ?? "").trim() || "Unit").slice(0, 40);
  const editableAddonQty = block.allowAddonQuantityEdit !== false;

  function patchAddonLine(id: string, next: Partial<PricingLineItem>) {
    onChange({
      ...block,
      addonLineItems: addonLineItems.map((l) => (l.id === id ? { ...l, ...next } : l)),
    });
  }
  function removeAddonLine(id: string) {
    onChange({ ...block, addonLineItems: addonLineItems.filter((l) => l.id !== id) });
  }
  function addAddonLine() {
    onChange({
      ...block,
      addonLineItems: [
        ...addonLineItems,
        { id: newId(), label: "Add-on", unitAmountMinor: 0, quantity: 0 },
      ],
    });
  }

  const previewTierId = tiers.find((t) => t.recommended)?.id ?? tiers[0]?.id ?? null;
  const mockAddonQty: Record<string, number> = {};
  for (const li of addonLineItems) {
    mockAddonQty[li.id] = effectivePricingLineQuantity(li);
  }
  const previewSel: PackagesPublicSelection | undefined =
    previewTierId != null
      ? {
          kind: "packages",
          tierId: previewTierId,
          term,
          updatedAtMs: 0,
          addonQuantities: mockAddonQty,
          addonOptionalOff: {},
        }
      : undefined;
  const addonsPreviewMinor = previewSel
    ? packageAddonsTotalMinor(block, previewSel)
    : packageAddonsTotalMinor(block, undefined, mockAddonQty, {});
  const previewTermMonths = packageTermMonths({ term });
  const monthlyPreviewMinor = previewSel
    ? packageMonthlyTotalMinor(block, previewSel)
    : addonsPreviewMinor;
  const commitmentPreviewMinor = previewSel
    ? packageCommitmentTotalMinor(block, previewSel)
    : addonsPreviewMinor * previewTermMonths;

  const label12 = block.plan12Label ?? "12 months";
  const label24 = block.plan24Label ?? "24 months";
  const headerBarFg = readableForeground(style.primaryColor);
  const headerSimpleDividerColor =
    headerBarFg === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.18)";
  const headerSimpleSolid: React.CSSProperties = {
    backgroundColor: style.primaryColor,
    color: headerBarFg,
    borderColor: style.primaryColor,
  };

  const addonsActive = packagesAddonsSectionActive(block);

  function enableAddonsTable() {
    const nextLines =
      addonLineItems.length > 0
        ? addonLineItems
        : [{ id: newId(), label: "Line item", unitAmountMinor: 0, quantity: 0 }];
    patch({
      addonsSectionEnabled: true,
      addonLineItems: nextLines,
      addonsTitle: block.addonsTitle?.trim() || "Add-ons",
      allowAddonQuantityEdit: true,
      addonQuantityUnitLabel: block.addonQuantityUnitLabel?.trim() || "Unit",
      totalSectionLabel: block.totalSectionLabel?.trim() || "Total",
    });
  }

  return (
    <div className="relative w-full min-w-0 text-foreground">
      {/* Header: title + term toggle. The remove icon now lives in the floating toolbar. */}
      <div className={cn(isVisual ? "text-center" : "text-left")}>
        <InlineText
          tone="light"
          value={block.title ?? ""}
          placeholder="Section title"
          onChange={(v) => patch({ title: v })}
          ariaLabel="Section title"
          className={cn(
            "inline-block text-3xl font-semibold tracking-tight text-foreground",
            isVisual && "text-center",
          )}
          inputClassName={cn(
            "inline-block text-3xl font-semibold tracking-tight text-foreground",
            isVisual && "text-center",
          )}
        />

        <div
          className={cn(
            "flex max-w-sm",
            isVisual ? "mx-auto mt-4 justify-center" : "mt-4",
          )}
        >
          <div
            className="inline-flex items-center gap-1 rounded-full p-0.5 ring-1"
            style={{ borderColor: "transparent", background: "rgba(15,23,42,0.04)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)" }}
          >
            <TermPill
              active={term === "12_months"}
              onActivate={() => setTerm("12_months")}
              label={label12}
              onLabelChange={(v) => patch({ plan12Label: v })}
              activeColor={style.primaryColor}
              ariaLabel="12-month term toggle label"
            />
            <TermPill
              active={term === "24_months"}
              onActivate={() => setTerm("24_months")}
              label={label24}
              onLabelChange={(v) => patch({ plan24Label: v })}
              activeColor={style.primaryColor}
              ariaLabel="24-month term toggle label"
            />
          </div>
        </div>

        <p className={cn("text-[11px] text-muted-foreground", isVisual ? "mt-2" : "mt-1.5")}>
          Currency:{" "}
          <InlineText
            tone="light"
            value={(block.currency ?? "aud").toLowerCase()}
            onChange={(v) => patch({ currency: v.toLowerCase().slice(0, 3) })}
            ariaLabel="Currency code"
            className="inline-block text-[11px] uppercase tracking-wider text-muted-foreground"
          />
        </p>
      </div>

      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4",
          isVisual ? "mt-5" : "mt-4",
        )}
      >
        {tiers.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            term={term}
            currency={currency}
            highlightColor={style.highlightColor}
            onChange={(next) => patchTier(tier.id, next)}
            onRemove={() => removeTier(tier.id)}
            onToggleRecommended={() => toggleRecommended(tier.id)}
          />
        ))}

        <button
          type="button"
          onClick={addTier}
          className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-muted/20 px-4 py-5 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-foreground sm:min-h-[220px]"
          aria-label="Add tier"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5">
            <Plus className="h-4 w-4" />
          </span>
          <span className="text-xs font-medium sm:text-sm">Add tier</span>
        </button>
      </div>

      {!addonsActive ? (
        <div className="group/pkginsert relative mt-6 flex items-center justify-center py-1.5">
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-border opacity-0 transition-opacity group-hover/pkginsert:opacity-80 group-focus-within/pkginsert:opacity-80" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Add table"
                className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" sideOffset={4} className="w-[min(200px,calc(100vw-2rem))] p-1">
              <p className="px-2 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Add to plan
              </p>
              <DropdownMenuItem
                className="cursor-pointer gap-2 rounded-sm"
                onSelect={(e) => e.preventDefault()}
                onClick={() => enableAddonsTable()}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-muted ring-1 ring-border">
                  <TableProperties className="h-3 w-3" aria-hidden />
                </span>
                Table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-border/70 bg-card text-left shadow-sm">
          <div
            className="flex flex-wrap items-center gap-3 rounded-t-xl border-b border-dashed px-4 py-3"
            style={{ ...headerSimpleSolid, borderBottomColor: headerSimpleDividerColor }}
          >
            <div className="min-w-0 flex-1">
              <InlineText
                tone="dark"
                value={block.addonsTitle ?? ""}
                placeholder="Add-ons"
                onChange={(v) => patch({ addonsTitle: v || undefined })}
                ariaLabel="Add-ons section title"
                className="text-base font-semibold"
                inputClassName="w-full text-base font-semibold"
              />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Monthly subtotal</span>
              <span className="text-lg font-semibold tabular-nums leading-none">
                {formatCurrencyAmount(addonsPreviewMinor, currency)}
                <span className="ml-1 text-xs font-medium opacity-90">/ mo</span>
              </span>
            </div>
          </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-dashed border-border/50 bg-muted/10 px-4 py-2 text-[11px]">
          <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input
              type="checkbox"
              checked={editableAddonQty}
              onChange={(e) => patch({ allowAddonQuantityEdit: e.target.checked })}
              className="h-3 w-3 accent-primary"
            />
            Editable qty
          </label>
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
            <span className="text-muted-foreground">Qty label</span>
            <Input
              value={addonQtyUnitDraft}
              onChange={(e) =>
                patch({
                  addonQuantityUnitLabel: e.target.value.trim()
                    ? e.target.value.trim().slice(0, 40)
                    : undefined,
                })
              }
              placeholder="Unit"
              className="h-8 w-28 bg-background text-xs"
              aria-label="Add-on quantity suffix"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Summary label</span>
            <Input
              value={block.totalSectionLabel ?? ""}
              onChange={(e) =>
                patch({
                  totalSectionLabel: e.target.value.trim() ? e.target.value.trim().slice(0, 120) : undefined,
                })
              }
              placeholder="Total"
              className="h-8 w-32 bg-background text-xs"
              aria-label="Packages summary bar title"
            />
          </div>
        </div>
        <div className="overflow-x-auto bg-card text-left">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-dashed border-border/50 bg-card text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-right">Item</th>
                {editableAddonQty ? <th className="px-4 py-2.5 text-right">Quantity</th> : null}
                <th className="px-4 py-2.5 text-right">Price</th>
                <th className="w-8 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="[&_tr]:border-b [&_tr]:border-dashed [&_tr]:border-border/40">
              {addonLineItems.map((li) => {
                const q = effectivePricingLineQuantity(li);
                const lineTotal = Math.round(li.unitAmountMinor * q);
                const qtyProps = editableAddonQty
                  ? {
                      tone: "light" as const,
                      value: q,
                      min: 0,
                      step: 1,
                      width: "w-16" as const,
                      onChange: (v: number) => patchAddonLine(li.id, { quantity: v }),
                      ariaLabel: "Default quantity" as const,
                      className: "text-foreground" as const,
                    }
                  : null;
                return (
                  <tr key={li.id} className="group/row">
                    <td className="px-4 py-3 text-left align-middle">
                      <div className="flex flex-col items-start gap-1">
                        <InlineText
                          tone="light"
                          value={li.label}
                          placeholder="Add-on label"
                          onChange={(v) => patchAddonLine(li.id, { label: v })}
                          ariaLabel="Add-on label"
                          className="font-medium text-foreground"
                          inputClassName="w-full font-medium text-foreground"
                        />
                        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(li.optional)}
                            onChange={(e) => patchAddonLine(li.id, { optional: e.target.checked })}
                            className="h-3 w-3 accent-primary"
                          />
                          Optional (buyer can turn off)
                        </label>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-middle tabular-nums text-muted-foreground">
                      <InlinePrice
                        tone="light"
                        minor={li.unitAmountMinor}
                        currency={currency}
                        onChange={(v) => patchAddonLine(li.id, { unitAmountMinor: v })}
                        ariaLabel="Unit price"
                        className="text-muted-foreground"
                      />
                    </td>
                    {qtyProps ? (
                      <td className="px-4 py-3 text-right align-middle">
                        <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                          <InlineNumber {...qtyProps} />
                          <span className="text-xs text-muted-foreground">{addonQtyUnitDraft}</span>
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right align-middle tabular-nums font-medium text-foreground">
                      {formatCurrencyAmount(lineTotal, currency)}
                    </td>
                    <td className="px-2 py-3 text-right align-middle">
                      <button
                        type="button"
                        onClick={() => removeAddonLine(li.id)}
                        aria-label="Remove add-on"
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/row:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={editableAddonQty ? 5 : 4} className="px-4 py-2">
                  <button
                    type="button"
                    onClick={addAddonLine}
                    className="flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-transparent px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/30 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add add-on line
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div
        className={cn(
          "mt-4 flex flex-col gap-2 rounded-xl border border-border/70 px-4 py-3 shadow-sm",
          isVisual ? "mx-auto max-w-md" : "",
        )}
        style={{ backgroundColor: style.primaryColor, color: headerBarFg }}
      >
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="inline-flex min-w-0 shrink flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xl font-semibold leading-none sm:text-2xl">
            <span>{block.totalSectionLabel?.trim() || "Total"}</span>
            <span className="text-sm font-medium opacity-90 sm:text-base">(preview)</span>
          </span>
          <div className="min-w-0 shrink-0 text-right">
            <span className="text-xl font-semibold tabular-nums leading-none sm:text-2xl">
              {formatCurrencyAmount(monthlyPreviewMinor, currency)}
            </span>
            <p className="mt-0.5 text-xs font-medium opacity-90">/ month</p>
          </div>
        </div>
        {!previewTierId ? (
          <p className="text-xs opacity-85">
            <span>Add tiers to preview the plan portion of this total.</span>
          </p>
        ) : null}
        {previewTierId || addonsPreviewMinor > 0 ? (
          <p className="max-w-[280px] text-pretty text-left text-[11px] leading-snug opacity-80 sm:ml-auto sm:text-right">
            Total commitment over {previewTermMonths} mo:{" "}
            <span className="whitespace-nowrap tabular-nums font-medium opacity-95">
              {formatCurrencyAmount(commitmentPreviewMinor, currency)}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TermPill({
  active,
  onActivate,
  label,
  onLabelChange,
  activeColor,
  ariaLabel,
}: {
  active: boolean;
  onActivate: () => void;
  label: string;
  onLabelChange: (next: string) => void;
  activeColor: string;
  ariaLabel: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(label);
  React.useEffect(() => {
    if (!editing) setDraft(label);
  }, [editing, label]);

  const activeForeground = readableForeground(activeColor);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== label) onLabelChange(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(label);
            setEditing(false);
          }
        }}
        aria-label={ariaLabel}
        className="rounded-full px-3.5 py-1.5 text-xs font-medium outline-none ring-2 md:px-4 md:text-sm"
        style={{
          backgroundColor: activeColor,
          color: activeForeground,
          boxShadow: `0 0 0 2px ${withAlpha(activeColor, 0.4)}`,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => (active ? setEditing(true) : onActivate())}
      onDoubleClick={() => setEditing(true)}
      aria-label={ariaLabel}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors md:px-4 md:text-sm",
        active ? "shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
      style={
        active
          ? { backgroundColor: activeColor, color: activeForeground }
          : undefined
      }
      title={active ? "Click again to rename" : "Click to switch term"}
    >
      {label}
    </button>
  );
}

function TierCard({
  tier,
  term,
  currency,
  highlightColor,
  onChange,
  onRemove,
  onToggleRecommended,
}: {
  tier: PackageTier;
  term: "12_months" | "24_months";
  currency: string;
  highlightColor: string;
  onChange: (next: Partial<PackageTier>) => void;
  onRemove: () => void;
  onToggleRecommended: () => void;
}) {
  const isRecommended = Boolean(tier.recommended);
  const monthlyMinor = term === "12_months" ? tier.monthlyCost12Minor ?? 0 : tier.monthlyCost24Minor ?? 0;
  const otherMonthlyMinor = term === "12_months" ? tier.monthlyCost24Minor ?? 0 : tier.monthlyCost12Minor ?? 0;
  const otherTermLabel = term === "12_months" ? "24-month monthly" : "12-month monthly";
  const features = tier.features ?? [];

  /** Recommended cards adopt the highlight colour as a solid background. */
  const recommendedFg = readableForeground(highlightColor);
  const recommendedTone = recommendedFg === "#ffffff" ? "dark" : "light";
  const recommendedDimText =
    recommendedFg === "#ffffff" ? "rgba(255,255,255,0.78)" : "rgba(15,23,42,0.62)";
  const recommendedFaintBorder =
    recommendedFg === "#ffffff" ? "rgba(255,255,255,0.32)" : "rgba(15,23,42,0.22)";

  const cardStyle: React.CSSProperties | undefined = isRecommended
    ? { backgroundColor: highlightColor, color: recommendedFg, borderColor: highlightColor }
    : undefined;

  return (
    <div className="group/tier flex flex-col">
      <div
        className={cn(
          "relative flex min-h-0 flex-col rounded-xl border p-3.5 shadow-sm transition-colors sm:p-4",
          isRecommended ? "pt-5 sm:pt-5" : "border-border/70 bg-card text-foreground",
        )}
        style={cardStyle}
      >
        <button
          type="button"
          onClick={onToggleRecommended}
          aria-pressed={isRecommended}
          aria-label={isRecommended ? "Unmark as recommended" : "Mark as recommended"}
          className={cn(
            "absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow transition-all",
            isRecommended
              ? ""
              : "border border-dashed border-border bg-background text-muted-foreground opacity-0 group-hover/tier:opacity-100",
          )}
          style={
            isRecommended ? { backgroundColor: highlightColor, color: recommendedFg } : undefined
          }
        >
          <Sparkles className="h-3 w-3" />
          {isRecommended ? "Recommended" : "Mark recommended"}
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove tier"
          className={cn(
            "absolute right-2 top-2 rounded-md p-1.5 opacity-0 transition-opacity hover:text-red-500 group-hover/tier:opacity-100",
            isRecommended ? "" : "text-muted-foreground",
          )}
          style={isRecommended ? { color: recommendedDimText } : undefined}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <InlineText
          tone={recommendedTone}
          value={tier.name}
          placeholder="Tier name"
          onChange={(v) => onChange({ name: v })}
          ariaLabel="Tier name"
          className={cn("text-base font-semibold", isRecommended ? "" : "text-foreground")}
          inputClassName={cn(
            "w-full text-base font-semibold",
            isRecommended ? "" : "text-foreground",
          )}
        />

        <ul
          className={cn(
            "mt-2 space-y-1 text-[13px] leading-snug",
            isRecommended ? "" : "text-muted-foreground",
          )}
          style={isRecommended ? { color: recommendedFg } : undefined}
        >
          <StatRow
            label="Included users"
            value={tier.includedUsers ?? 0}
            onChange={(v) => onChange({ includedUsers: v })}
            tone={isRecommended ? recommendedTone : "light"}
          />
          <StatRow
            label="Included locations"
            value={tier.includedLocations ?? 0}
            onChange={(v) => onChange({ includedLocations: v })}
            tone={isRecommended ? recommendedTone : "light"}
          />
          <StatRow
            label="Included admins"
            value={tier.includedAdmins ?? 0}
            onChange={(v) => onChange({ includedAdmins: v })}
            tone={isRecommended ? recommendedTone : "light"}
          />
        </ul>

        <div
          className="mt-3 border-t border-dashed pt-3"
          style={{ borderColor: isRecommended ? recommendedFaintBorder : undefined }}
        >
          <div className="flex items-baseline gap-1">
            <InlinePrice
              tone={recommendedTone}
              minor={monthlyMinor}
              currency={currency}
              onChange={(v) =>
                onChange(
                  term === "12_months" ? { monthlyCost12Minor: v } : { monthlyCost24Minor: v },
                )
              }
              ariaLabel="Monthly price"
              className={cn(
                "text-xl font-semibold tabular-nums sm:text-2xl",
                isRecommended ? "" : "text-foreground",
              )}
            />
          </div>
          <p
            className={cn("text-xs", isRecommended ? "" : "text-muted-foreground")}
            style={isRecommended ? { color: recommendedDimText } : undefined}
          >
            / month — {term === "12_months" ? "12-month plan" : "24-month plan"}
          </p>

          <p
            className={cn("mt-2 text-[11px]", isRecommended ? "" : "text-muted-foreground")}
            style={isRecommended ? { color: recommendedDimText } : undefined}
          >
            {otherTermLabel}:{" "}
            <InlinePrice
              tone={recommendedTone}
              minor={otherMonthlyMinor}
              currency={currency}
              onChange={(v) =>
                onChange(
                  term === "12_months" ? { monthlyCost24Minor: v } : { monthlyCost12Minor: v },
                )
              }
              ariaLabel="Other-term monthly price"
              className={cn("text-[11px] tabular-nums", isRecommended ? "" : "text-foreground")}
            />
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
                style={isRecommended ? { color: recommendedDimText } : undefined}
              >
                Upfront (12-month)
              </p>
              <InlinePrice
                tone={recommendedTone}
                minor={tier.upfrontCost12Minor ?? 0}
                currency={currency}
                onChange={(v) => onChange({ upfrontCost12Minor: v > 0 ? v : undefined })}
                ariaLabel="Upfront cost (12-month)"
                className={cn(
                  "mt-0.5 text-xs tabular-nums",
                  isRecommended ? "" : "text-foreground",
                )}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-auto pt-3">
          <Button
            type="button"
            disabled
            variant="outline"
            size="sm"
            className={cn("w-full rounded-full font-semibold")}
            style={
              isRecommended
                ? { backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#ffffff" }
                : undefined
            }
          >
            Select
          </Button>
        </div>
      </div>

      <ul className="mt-2 space-y-1.5 border-t border-border/40 pt-2 sm:mt-3 sm:pt-2.5">
        {features.map((feat, idx) => (
          <li
            key={`${idx}-${feat}`}
            className="group/feat flex items-start gap-1.5 text-xs text-foreground sm:text-[13px]"
          >
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/60 sm:h-4 sm:w-4"
              style={{ color: highlightColor }}
              aria-hidden
            />
            <InlineText
              tone="light"
              value={feat}
              placeholder="Feature"
              onChange={(v) => {
                const next = [...features];
                if (v.trim()) {
                  next[idx] = v.trim();
                } else {
                  next.splice(idx, 1);
                }
                onChange({ features: next });
              }}
              ariaLabel={`Feature ${idx + 1}`}
              className="flex-1 text-xs text-foreground sm:text-[13px]"
              inputClassName="w-full text-xs text-foreground sm:text-[13px]"
            />
            <button
              type="button"
              onClick={() => {
                const next = [...features];
                next.splice(idx, 1);
                onChange({ features: next });
              }}
              aria-label="Remove feature"
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/feat:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onChange({ features: [...features, "New feature"] })}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-transparent px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/30 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a feature
          </button>
        </li>
      </ul>
    </div>
  );
}

function StatRow({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  tone: "light" | "dark";
}) {
  const isUnlimited = value >= PACKAGE_TIER_UNLIMITED_VALUE;

  return (
    <li className="flex items-center justify-between gap-2">
      <span className="font-medium">{label}</span>
      {isUnlimited ? (
        <div className="flex items-center gap-2">
          <span className="tabular-nums">Unlimited</span>
          <button
            type="button"
            onClick={() => onChange(1)}
            className={cn(
              "rounded px-1 text-[11px] underline-offset-2 hover:underline",
              tone === "dark" ? "text-white/85 hover:text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Set limit
          </button>
        </div>
      ) : (
        <InlineNumber
          tone={tone}
          value={value}
          onChange={onChange}
          min={0}
          step={1}
          width="w-20"
          ariaLabel={label}
        />
      )}
    </li>
  );
}

/* -----------------------------------------------------------------------------
 * Quote (pricing) — inline editor.
 * Mirrors PricingBlockPublic table layout.
 * -------------------------------------------------------------------------- */

export interface PricingInlineEditorProps {
  block: PricingBlock;
  onChange: (next: PricingBlock) => void;
}

export function PricingInlineEditor({ block, onChange }: PricingInlineEditorProps) {
  const lineItems = block.lineItems ?? [];
  const currency = (block.currency ?? "aud").toUpperCase();
  const qtyUnitDraft = ((block.quantityUnitLabel ?? "").trim() || "Unit").slice(0, 40);
  const editable = block.allowQuantityEdit !== false;
  const style = resolveBlockStyle(block.style);
  const isVisual = style.variant === "visual";

  const previewTotal = lineItems.reduce((sum, li) => {
    const q = effectivePricingLineQuantity(li);
    return sum + Math.round(li.unitAmountMinor * q);
  }, 0);

  function patch(next: Partial<PricingBlock>) {
    onChange({ ...block, ...next });
  }
  function patchLine(id: string, next: Partial<PricingLineItem>) {
    onChange({
      ...block,
      lineItems: lineItems.map((l) => (l.id === id ? { ...l, ...next } : l)),
    });
  }
  function removeLine(id: string) {
    onChange({ ...block, lineItems: lineItems.filter((l) => l.id !== id) });
  }
  function addLine() {
    onChange({
      ...block,
      lineItems: [
        ...lineItems,
        {
          id: newId(),
          label: "Line item",
          unitAmountMinor: 0,
          quantity: isVisual ? 1 : 0,
        },
      ],
    });
  }

  /** Visual variant tints the title bar; Simple uses a solid primary bar with subtotal. */
  const headerVisualStyle: React.CSSProperties | undefined = isVisual
    ? {
        background: withAlpha(style.primaryColor, 0.08),
        borderBottomColor: withAlpha(style.primaryColor, 0.2),
      }
    : undefined;
  const totalRowStyle: React.CSSProperties = {
    background: withAlpha(style.highlightColor, isVisual ? 0.15 : 0.08),
  };

  const headerBarFg = readableForeground(style.primaryColor);
  const headerSimpleSolid: React.CSSProperties = {
    backgroundColor: style.primaryColor,
    color: headerBarFg,
    borderColor: style.primaryColor,
  };
  const headerSimpleDividerColor =
    headerBarFg === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.18)";

  return (
    <div
      className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
      style={
        isVisual
          ? { borderColor: withAlpha(style.primaryColor, 0.25) }
          : undefined
      }
    >
      {isVisual ? (
        <div
          className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3"
          style={headerVisualStyle}
        >
          <InlineText
            tone="light"
            value={block.title ?? ""}
            placeholder="Quote title"
            onChange={(v) => patch({ title: v })}
            ariaLabel="Quote title"
            className="text-base font-semibold text-foreground"
            inputClassName="text-base font-semibold text-foreground w-full"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={editable}
                onChange={(e) => patch({ allowQuantityEdit: e.target.checked })}
                className="h-3 w-3 accent-primary"
              />
              Editable qty
            </label>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <InlineText
                tone="light"
                value={(block.currency ?? "aud").toLowerCase()}
                onChange={(v) => patch({ currency: v.toLowerCase().slice(0, 3) })}
                ariaLabel="Currency code"
                className="text-[10px] uppercase"
              />
            </span>
          </div>
        </div>
      ) : (
        <>
          <div
            className="flex flex-wrap items-center gap-3 rounded-t-xl border-b border-dashed px-4 py-3"
            style={{ ...headerSimpleSolid, borderBottomColor: headerSimpleDividerColor }}
          >
            <div className="min-w-0 flex-1">
              <InlineText
                tone="dark"
                value={block.title ?? ""}
                placeholder="Section title"
                onChange={(v) => patch({ title: v })}
                ariaLabel="Table title"
                className="text-base font-semibold"
                inputClassName="text-base font-semibold w-full"
              />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Subtotal</span>
              <span className="text-lg font-semibold tabular-nums leading-none">
                {formatCurrencyAmount(previewTotal, currency)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-dashed border-border/50 bg-muted/10 px-4 py-2 text-[11px]">
            <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
              <input
                type="checkbox"
                checked={editable}
                onChange={(e) => patch({ allowQuantityEdit: e.target.checked })}
                className="h-3 w-3 accent-primary"
              />
              Editable qty
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Currency</span>
              <InlineText
                tone="light"
                value={(block.currency ?? "aud").toLowerCase()}
                onChange={(v) => patch({ currency: v.toLowerCase().slice(0, 3) })}
                ariaLabel="Currency code"
                className="rounded-md border border-border/60 px-2 py-0.5 uppercase"
              />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-muted-foreground">Qty label</span>
              <Input
                value={qtyUnitDraft}
                onChange={(e) =>
                  patch({
                    quantityUnitLabel: e.target.value.trim() ? e.target.value.trim().slice(0, 40) : undefined,
                  })
                }
                placeholder="Unit"
                className="h-8 w-28 bg-background text-xs"
                aria-label="Quantity suffix (e.g. Unit)"
              />
            </div>
          </div>
        </>
      )}

      <div className="overflow-x-auto bg-card">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr
              className={cn(
                "border-b border-dashed text-left text-[11px] font-medium uppercase tracking-wide",
                isVisual
                  ? "border-border/60 bg-muted/20 text-muted-foreground"
                  : "border-border/50 bg-card text-muted-foreground",
              )}
            >
              <th className="px-4 py-2.5">{isVisual ? "Item" : "Description"}</th>
              <th className="px-4 py-2.5 text-right">{isVisual ? "Unit" : "Item"}</th>
              {editable ? <th className="px-4 py-2.5 text-right">{isVisual ? "Qty" : "Quantity"}</th> : null}
              <th className="px-4 py-2.5 text-right">{isVisual ? "Line total" : "Price"}</th>
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody
            className={cn(
              "[&_tr]:border-b [&_tr]:border-border/40",
              !isVisual && "[&_tr]:border-dashed",
            )}
          >
            {lineItems.map((li) => {
              const q = effectivePricingLineQuantity(li);
              const lineTotal = Math.round(li.unitAmountMinor * q);
              const qtyProps = editable
                ? {
                    tone: "light" as const,
                    value: q,
                    min: isVisual ? 1 : 0,
                    step: 1,
                    width: "w-16" as const,
                    onChange: (v: number) => patchLine(li.id, { quantity: v }),
                    ariaLabel: "Quantity" as const,
                    className: "text-foreground" as const,
                  }
                : null;
              return (
                <tr key={li.id} className="group/row">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col gap-1">
                      <InlineText
                        tone="light"
                        value={li.label}
                        placeholder="Item label"
                        onChange={(v) => patchLine(li.id, { label: v })}
                        ariaLabel="Line item label"
                        className="font-medium text-foreground"
                        inputClassName="w-full font-medium text-foreground"
                      />
                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(li.optional)}
                          onChange={(e) => patchLine(li.id, { optional: e.target.checked })}
                          className="h-3 w-3 accent-primary"
                        />
                        Add-on (buyer can toggle off)
                      </label>
                    </div>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right align-middle tabular-nums",
                      isVisual ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <InlinePrice
                      tone="light"
                      minor={li.unitAmountMinor}
                      currency={currency}
                      onChange={(v) => patchLine(li.id, { unitAmountMinor: v })}
                      ariaLabel="Unit price"
                      className={isVisual ? "text-foreground" : "text-muted-foreground"}
                    />
                  </td>
                  {qtyProps ? (
                    <td className="px-4 py-3 text-right align-middle">
                      {!isVisual ? (
                        <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                          <InlineNumber {...qtyProps} />
                          <span className="text-xs text-muted-foreground">{qtyUnitDraft}</span>
                        </span>
                      ) : (
                        <InlineNumber {...qtyProps} />
                      )}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-right align-middle tabular-nums font-medium text-foreground">
                    {formatCurrencyAmount(lineTotal, currency)}
                  </td>
                  <td className="px-2 py-3 text-right align-middle">
                    <button
                      type="button"
                      onClick={() => removeLine(li.id)}
                      aria-label="Remove line item"
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/row:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={editable ? 5 : 4} className="px-4 py-2">
                <button
                  type="button"
                  onClick={addLine}
                  className="flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-transparent px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/30 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add a line item
                </button>
              </td>
            </tr>
          </tbody>
          {isVisual ? (
            <tfoot>
              <tr style={totalRowStyle}>
                <td
                  colSpan={editable ? 3 : 2}
                  className="px-4 py-3 text-right text-[13px] font-semibold text-foreground"
                >
                  Total (preview)
                </td>
                <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-foreground">
                  {formatCurrencyAmount(previewTotal, currency)}
                </td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
