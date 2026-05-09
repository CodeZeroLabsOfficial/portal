"use client";

import * as React from "react";
import { Check, Plus, Sparkles, Trash2, X } from "lucide-react";
import type {
  PackageTier,
  PackagesBlock,
  PricingBlock,
  PricingLineItem,
} from "@/types/proposal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrencyAmount } from "@/lib/format";

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
  onRemove: () => void;
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
    features: [],
  };
}

export function PackagesInlineEditor({ block, onChange, onRemove }: PackagesInlineEditorProps) {
  const tiers = block.tiers ?? [];
  const currency = (block.currency ?? "aud").toUpperCase();
  const [term, setTerm] = React.useState<"12_months" | "24_months">("24_months");

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

  const label12 = block.plan12Label ?? "12 months";
  const label24 = block.plan24Label ?? "24 months";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-6 text-zinc-100 shadow-xl md:p-10">
      {/* Block-level controls */}
      <div className="absolute right-3 top-3 flex items-center gap-1">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-200">
          {currency}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove plans block"
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Title */}
      <div className="text-center">
        <InlineText
          tone="dark"
          value={block.title ?? ""}
          placeholder="Section title"
          onChange={(v) => patch({ title: v })}
          ariaLabel="Section title"
          className="inline-block text-xl font-semibold tracking-tight text-white md:text-2xl"
          inputClassName="inline-block text-xl font-semibold tracking-tight text-white md:text-2xl text-center"
        />

        {/* Term toggle (active term decides which monthly price is in focus) */}
        <div className="mx-auto mt-6 flex max-w-md justify-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-zinc-900/90 p-1 ring-1 ring-zinc-700/80">
            <TermPill
              active={term === "12_months"}
              onActivate={() => setTerm("12_months")}
              label={label12}
              onLabelChange={(v) => patch({ plan12Label: v })}
              ariaLabel="12-month term toggle label"
            />
            <TermPill
              active={term === "24_months"}
              onActivate={() => setTerm("24_months")}
              label={label24}
              onLabelChange={(v) => patch({ plan24Label: v })}
              ariaLabel="24-month term toggle label"
            />
          </div>
        </div>

        {/* Currency editor — small, inline */}
        <p className="mt-3 text-[11px] text-zinc-500">
          Currency:{" "}
          <InlineText
            tone="dark"
            value={(block.currency ?? "aud").toLowerCase()}
            onChange={(v) => patch({ currency: v.toLowerCase().slice(0, 3) })}
            ariaLabel="Currency code"
            className="inline-block text-[11px] uppercase tracking-wider text-zinc-300"
          />
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-4">
        {tiers.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            term={term}
            currency={currency}
            onChange={(next) => patchTier(tier.id, next)}
            onRemove={() => removeTier(tier.id)}
            onToggleRecommended={() => toggleRecommended(tier.id)}
          />
        ))}

        <button
          type="button"
          onClick={addTier}
          className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-700/70 bg-zinc-900/30 p-6 text-zinc-400 transition-colors hover:border-teal-500/60 hover:bg-teal-900/15 hover:text-teal-200 md:min-h-[380px]"
          aria-label="Add tier"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium">Add tier</span>
        </button>
      </div>
    </div>
  );
}

function TermPill({
  active,
  onActivate,
  label,
  onLabelChange,
  ariaLabel,
}: {
  active: boolean;
  onActivate: () => void;
  label: string;
  onLabelChange: (next: string) => void;
  ariaLabel: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(label);
  React.useEffect(() => {
    if (!editing) setDraft(label);
  }, [editing, label]);

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
        className="rounded-full bg-white px-5 py-2 text-sm font-medium text-zinc-900 outline-none ring-2 ring-teal-400"
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
        "rounded-full px-5 py-2 text-sm font-medium transition-colors",
        active ? "bg-white text-zinc-900 shadow" : "text-zinc-400 hover:text-white",
      )}
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
  onChange,
  onRemove,
  onToggleRecommended,
}: {
  tier: PackageTier;
  term: "12_months" | "24_months";
  currency: string;
  onChange: (next: Partial<PackageTier>) => void;
  onRemove: () => void;
  onToggleRecommended: () => void;
}) {
  const isRecommended = Boolean(tier.recommended);
  const monthlyMinor = term === "12_months" ? tier.monthlyCost12Minor ?? 0 : tier.monthlyCost24Minor ?? 0;
  const otherMonthlyMinor = term === "12_months" ? tier.monthlyCost24Minor ?? 0 : tier.monthlyCost12Minor ?? 0;
  const otherTermLabel = term === "12_months" ? "24-month monthly" : "12-month monthly";
  const features = tier.features ?? [];

  return (
    <div className="group/tier flex flex-col">
      <div
        className={cn(
          "relative flex min-h-[320px] flex-col rounded-2xl border p-5 shadow-lg transition-colors md:min-h-[380px]",
          isRecommended
            ? "border-teal-500/60 bg-teal-900/25 pt-6 ring-2 ring-teal-500/40"
            : "border-zinc-700/80 bg-white text-zinc-900",
        )}
      >
        {/* Recommended badge — toggles on click */}
        <button
          type="button"
          onClick={onToggleRecommended}
          aria-pressed={isRecommended}
          aria-label={isRecommended ? "Unmark as recommended" : "Mark as recommended"}
          className={cn(
            "absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide shadow transition-all",
            isRecommended
              ? "bg-teal-500 text-white"
              : "border border-dashed border-zinc-400 bg-white text-zinc-500 opacity-0 group-hover/tier:opacity-100",
          )}
        >
          <Sparkles className="h-3 w-3" />
          {isRecommended ? "Recommended" : "Mark recommended"}
        </button>

        {/* Tier-level remove */}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove tier"
          className={cn(
            "absolute right-2 top-2 rounded-md p-1.5 opacity-0 transition-opacity hover:text-red-500 group-hover/tier:opacity-100",
            isRecommended ? "text-teal-100 hover:text-red-300" : "text-zinc-400",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* Tier name */}
        <InlineText
          tone={isRecommended ? "dark" : "light"}
          value={tier.name}
          placeholder="Tier name"
          onChange={(v) => onChange({ name: v })}
          ariaLabel="Tier name"
          className={cn("text-lg font-semibold", isRecommended ? "text-white" : "text-zinc-900")}
          inputClassName={cn(
            "w-full text-lg font-semibold",
            isRecommended ? "text-white" : "text-zinc-900",
          )}
        />

        {/* Stats */}
        <ul
          className={cn(
            "mt-4 space-y-1.5 text-sm",
            isRecommended ? "text-teal-50/95" : "text-zinc-600",
          )}
        >
          <StatRow
            label="Included users"
            value={tier.includedUsers ?? 0}
            onChange={(v) => onChange({ includedUsers: v })}
            tone={isRecommended ? "dark" : "light"}
          />
          <StatRow
            label="Included locations"
            value={tier.includedLocations ?? 0}
            onChange={(v) => onChange({ includedLocations: v })}
            tone={isRecommended ? "dark" : "light"}
          />
          <StatRow
            label="Included admins"
            value={tier.includedAdmins ?? 0}
            onChange={(v) => onChange({ includedAdmins: v })}
            tone={isRecommended ? "dark" : "light"}
          />
        </ul>

        {/* Price block */}
        <div
          className="mt-6 border-t border-dashed pt-4"
          style={{ borderColor: isRecommended ? "rgba(45,212,191,0.25)" : undefined }}
        >
          <div className="flex items-baseline gap-1">
            <InlinePrice
              tone={isRecommended ? "dark" : "light"}
              minor={monthlyMinor}
              currency={currency}
              onChange={(v) =>
                onChange(
                  term === "12_months" ? { monthlyCost12Minor: v } : { monthlyCost24Minor: v },
                )
              }
              ariaLabel="Monthly price"
              className={cn(
                "text-3xl font-semibold tabular-nums",
                isRecommended ? "text-white" : "text-zinc-900",
              )}
            />
          </div>
          <p className={cn("text-sm", isRecommended ? "text-teal-100/90" : "text-zinc-500")}>
            / month — {term === "12_months" ? "12-month plan" : "24-month plan"}
          </p>

          {/* Inline editor for the OTHER term so both prices are reachable without leaving */}
          <p className={cn("mt-2 text-[11px]", isRecommended ? "text-teal-100/70" : "text-zinc-400")}>
            {otherTermLabel}:{" "}
            <InlinePrice
              tone={isRecommended ? "dark" : "light"}
              minor={otherMonthlyMinor}
              currency={currency}
              onChange={(v) =>
                onChange(
                  term === "12_months" ? { monthlyCost24Minor: v } : { monthlyCost12Minor: v },
                )
              }
              ariaLabel="Other-term monthly price"
              className={cn(
                "text-[11px] tabular-nums",
                isRecommended ? "text-teal-50" : "text-zinc-600",
              )}
            />
          </p>

          {term === "12_months" ? (
            <div
              className="mt-4 rounded-lg border border-dashed px-3 py-2.5 text-left"
              style={{ borderColor: isRecommended ? "rgba(45,212,191,0.35)" : undefined }}
            >
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wide",
                  isRecommended ? "text-teal-200/90" : "text-zinc-500",
                )}
              >
                Upfront (12-month)
              </p>
              <InlinePrice
                tone={isRecommended ? "dark" : "light"}
                minor={tier.upfrontCost12Minor ?? 0}
                currency={currency}
                onChange={(v) => onChange({ upfrontCost12Minor: v > 0 ? v : undefined })}
                ariaLabel="Upfront cost (12-month)"
                className={cn(
                  "mt-1 text-sm tabular-nums",
                  isRecommended ? "text-white" : "text-zinc-900",
                )}
              />
            </div>
          ) : null}
        </div>

        {/* Disabled "Select" preview button (so admin sees what customer sees) */}
        <div className="mt-auto pt-6">
          <Button
            type="button"
            disabled
            variant={isRecommended ? "default" : "outline"}
            className={cn(
              "w-full font-semibold",
              isRecommended
                ? "bg-white text-zinc-900 hover:bg-zinc-100"
                : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
            )}
          >
            Select
          </Button>
        </div>
      </div>

      {/* Features list — below the card, matches public layout */}
      <ul className="mt-5 space-y-2.5">
        {features.map((feat, idx) => (
          <li key={`${idx}-${feat}`} className="group/feat flex items-start gap-2 text-sm text-zinc-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden />
            <InlineText
              tone="dark"
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
              className="flex-1 text-sm text-zinc-200"
              inputClassName="w-full text-sm text-zinc-100"
            />
            <button
              type="button"
              onClick={() => {
                const next = [...features];
                next.splice(idx, 1);
                onChange({ features: next });
              }}
              aria-label="Remove feature"
              className="rounded p-0.5 text-zinc-500 opacity-0 transition-opacity hover:text-red-400 group-hover/feat:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onChange({ features: [...features, "New feature"] })}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-transparent px-2 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:border-teal-500/60 hover:bg-zinc-900/40 hover:text-teal-300"
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
  return (
    <li className="flex items-center justify-between gap-2">
      <span className={cn("font-medium", tone === "dark" ? "text-teal-100" : "text-zinc-800")}>{label}</span>
      <InlineNumber
        tone={tone}
        value={value}
        onChange={onChange}
        min={0}
        step={1}
        width="w-20"
        ariaLabel={label}
        className={cn(tone === "dark" ? "text-white" : "text-zinc-900")}
      />
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
  onRemove: () => void;
}

export function PricingInlineEditor({ block, onChange, onRemove }: PricingInlineEditorProps) {
  const lineItems = block.lineItems ?? [];
  const currency = (block.currency ?? "aud").toUpperCase();
  const editable = block.allowQuantityEdit !== false;

  const previewTotal = lineItems.reduce((sum, li) => {
    const q = typeof li.quantity === "number" && li.quantity > 0 ? li.quantity : 1;
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
        { id: newId(), label: "Line item", unitAmountMinor: 0, quantity: 1 },
      ],
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      {/* Header — title + currency + qty toggle + remove */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
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
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove quote block"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2 text-right">Unit</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Line total</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li) => {
              const q = typeof li.quantity === "number" && li.quantity > 0 ? li.quantity : 1;
              const lineTotal = Math.round(li.unitAmountMinor * q);
              return (
                <tr key={li.id} className="group/row border-b border-border/40">
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
                  <td className="px-4 py-3 text-right align-middle">
                    <InlinePrice
                      tone="light"
                      minor={li.unitAmountMinor}
                      currency={currency}
                      onChange={(v) => patchLine(li.id, { unitAmountMinor: v })}
                      ariaLabel="Unit price"
                      className="text-foreground"
                    />
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <InlineNumber
                      tone="light"
                      value={q}
                      min={1}
                      step={1}
                      width="w-16"
                      onChange={(v) => patchLine(li.id, { quantity: v })}
                      ariaLabel="Quantity"
                      className="text-foreground"
                    />
                  </td>
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
              <td colSpan={5} className="px-4 py-2">
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
          <tfoot>
            <tr className="bg-muted/15">
              <td colSpan={3} className="px-4 py-3 text-right text-[13px] font-semibold text-foreground">
                Total (preview)
              </td>
              <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-foreground">
                {formatCurrencyAmount(previewTotal, currency)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
