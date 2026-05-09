"use client";

import * as React from "react";
import { Check, Plus, Sparkles, X } from "lucide-react";
import type {
  PackageTier,
  PackagesBlock,
  PricingBlock,
  PricingLineItem,
} from "@/types/proposal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrencyAmount } from "@/lib/format";
import { readableForeground, resolveBlockStyle, withAlpha } from "@/lib/block-style";

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
  /** Kept for backwards-compat with callers that don't yet use the floating toolbar. */
  onRemove?: () => void;
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

  const label12 = block.plan12Label ?? "12 months";
  const label24 = block.plan24Label ?? "24 months";

  /** Visual variant uses primaryColor as a soft hero tint behind the cards. */
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
        "relative overflow-hidden text-foreground transition-colors",
        isVisual
          ? "rounded-xl border bg-card p-4 shadow-sm md:p-6"
          : "rounded-lg border border-[#E8EAED] bg-card px-0 py-4 shadow-none md:py-5",
      )}
      style={containerStyle}
    >
      {/* Header: title + term toggle — section title always centered (matches Qwilr). */}
      <div className="px-4 text-center md:px-6">
        <InlineText
          tone="light"
          value={block.title ?? ""}
          placeholder="Section title"
          onChange={(v) => patch({ title: v })}
          ariaLabel="Section title"
          className={cn(
            "inline-block font-semibold tracking-tight text-foreground",
            isVisual ? "text-lg md:text-xl" : "text-base md:text-lg",
          )}
          inputClassName={cn(
            "inline-block font-semibold tracking-tight text-foreground",
            isVisual ? "text-lg md:text-xl text-center" : "text-base md:text-lg",
          )}
        />

        <div
          className={cn(
            "flex max-w-sm",
            isVisual ? "mx-auto mt-3 justify-center" : "mt-2",
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
          "mt-5 max-w-none overflow-x-auto sm:mt-6",
          isVisual
            ? "grid gap-3 sm:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4"
            : "flex divide-x divide-[#E8EAED] border-t border-[#E8EAED]",
        )}
      >
        {tiers.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            term={term}
            currency={currency}
            highlightColor={style.highlightColor}
            accentColor={style.primaryColor}
            compactSimple={!isVisual}
            onChange={(next) => patchTier(tier.id, next)}
            onRemove={() => removeTier(tier.id)}
            onToggleRecommended={() => toggleRecommended(tier.id)}
          />
        ))}

        <button
          type="button"
          onClick={addTier}
          className={cn(
            "flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/70 bg-muted/20 px-3 py-8 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-foreground",
            isVisual ? "min-h-[200px] rounded-xl border-2 border-dashed sm:min-h-[220px]" : "min-w-[5.5rem] flex-shrink-0 sm:min-w-[6.5rem]",
          )}
          aria-label="Add tier"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5">
            <Plus className="h-4 w-4" />
          </span>
          <span className="text-xs font-medium sm:text-sm">Add tier</span>
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
  accentColor: accentProp,
  compactSimple = false,
  onChange,
  onRemove,
  onToggleRecommended,
}: {
  tier: PackageTier;
  term: "12_months" | "24_months";
  currency: string;
  highlightColor: string;
  /** Primary accent (badge / checks). Defaults to highlight colour. */
  accentColor?: string;
  /** Qwilr-style column: vertical rules, centred price, left feature list — no tinted card chrome. */
  compactSimple?: boolean;
  onChange: (next: Partial<PackageTier>) => void;
  onRemove: () => void;
  onToggleRecommended: () => void;
}) {
  const accentColor = accentProp ?? highlightColor;
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

  if (compactSimple) {
    const onAccentFg = readableForeground(accentColor);

    return (
      <div className="group/tier relative flex min-w-[min(100%,10rem)] flex-1 flex-col px-3 py-5 sm:min-w-[9rem] sm:px-4 md:px-5 lg:py-7">
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove tier"
          className="absolute right-1 top-2 z-[1] rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover/tier:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex min-h-8 shrink-0 items-start justify-center sm:min-h-9">
          <button
            type="button"
            onClick={onToggleRecommended}
            aria-pressed={isRecommended}
            aria-label={isRecommended ? "Unmark as recommended" : "Mark as recommended"}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-all",
              isRecommended
                ? ""
                : "border border-dashed border-border bg-background text-muted-foreground opacity-0 group-hover/tier:opacity-100",
            )}
            style={
              isRecommended ? { backgroundColor: accentColor, color: onAccentFg } : undefined
            }
          >
            <Sparkles className="h-3 w-3 shrink-0" />
            {isRecommended ? "Recommended" : "Mark recommended"}
          </button>
        </div>

        <InlineText
          tone="light"
          value={tier.name}
          placeholder="Tier name"
          onChange={(v) => onChange({ name: v })}
          ariaLabel="Tier name"
          className="mt-2 block text-center text-sm font-semibold text-neutral-800 md:text-[15px]"
          inputClassName="w-full text-center text-sm font-semibold text-neutral-800 md:text-[15px]"
        />

        <div className="mt-6 text-center md:mt-7">
          <InlinePrice
            tone="light"
            minor={monthlyMinor}
            currency={currency}
            onChange={(v) =>
              onChange(
                term === "12_months" ? { monthlyCost12Minor: v } : { monthlyCost24Minor: v },
              )
            }
            ariaLabel="Monthly price"
            className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900 md:text-[1.75rem]"
          />
          <p className="mt-1 text-[13px] text-neutral-500">
            / month — {term === "12_months" ? "12-month plan" : "24-month plan"}
          </p>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {otherTermLabel}:{" "}
          <InlinePrice
            tone="light"
            minor={otherMonthlyMinor}
            currency={currency}
            onChange={(v) =>
              onChange(
                term === "12_months" ? { monthlyCost24Minor: v } : { monthlyCost12Minor: v },
              )
            }
            ariaLabel="Other-term monthly price"
            className="inline text-[11px] tabular-nums text-foreground"
          />
        </p>

        {term === "12_months" ? (
          <div className="mt-2 rounded-md border border-dashed border-border/80 px-2.5 py-2 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Upfront (12-month)
            </p>
            <InlinePrice
              tone="light"
              minor={tier.upfrontCost12Minor ?? 0}
              currency={currency}
              onChange={(v) => onChange({ upfrontCost12Minor: v > 0 ? v : undefined })}
              ariaLabel="Upfront cost (12-month)"
              className="mt-0.5 text-xs tabular-nums text-foreground"
            />
          </div>
        ) : (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">&nbsp;</p>
        )}

        <div className="mt-5 flex items-center justify-center gap-2">
          <InlineNumber
            tone="light"
            value={tier.includedUsers ?? 0}
            onChange={(v) => onChange({ includedUsers: v })}
            min={0}
            step={1}
            width="w-14"
            ariaLabel="Included users shown to buyer"
            className="rounded-md border border-[#E5E7EB] bg-white px-1 text-center text-neutral-900"
          />
          <span className="text-xs text-neutral-500">Users</span>
        </div>

        <div className="mt-6">
          <Button type="button" disabled variant="outline" size="sm" className="h-9 w-full rounded-md border-neutral-300 text-[13px] font-semibold text-neutral-600 shadow-none">
            Select
          </Button>
        </div>

        <div className="mt-10 border-t border-[#EBEDF0] pt-6 text-left md:mt-12">
          <ul className="space-y-2.5 text-[13px] leading-snug text-neutral-600">
            <li className="flex items-center gap-2">
              <Check className="size-[15px] shrink-0 text-neutral-400" style={{ color: accentColor }} aria-hidden />
              <span className="min-w-0 flex-1 font-medium text-neutral-800">Included users</span>
              <InlineNumber
                tone="light"
                value={tier.includedUsers ?? 0}
                onChange={(v) => onChange({ includedUsers: v })}
                min={0}
                width="w-16"
                ariaLabel="Included users"
                className="text-foreground"
              />
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-[15px] shrink-0 text-neutral-400" style={{ color: accentColor }} aria-hidden />
              <span className="min-w-0 flex-1 font-medium text-neutral-800">Locations</span>
              <InlineNumber
                tone="light"
                value={tier.includedLocations ?? 0}
                onChange={(v) => onChange({ includedLocations: v })}
                min={0}
                width="w-16"
                ariaLabel="Included locations"
                className="text-foreground"
              />
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-[15px] shrink-0 text-neutral-400" style={{ color: accentColor }} aria-hidden />
              <span className="min-w-0 flex-1 font-medium text-neutral-800">Admins</span>
              <InlineNumber
                tone="light"
                value={tier.includedAdmins ?? 0}
                onChange={(v) => onChange({ includedAdmins: v })}
                min={0}
                width="w-16"
                ariaLabel="Included admins"
                className="text-foreground"
              />
            </li>
            {features.map((feat, idx) => (
              <li key={`${idx}-${feat}`} className="group/feat flex items-start gap-2">
                <Check className="mt-0.5 size-[15px] shrink-0 text-neutral-400" style={{ color: accentColor }} aria-hidden />
                <InlineText
                  tone="light"
                  value={feat}
                  placeholder="Feature"
                  onChange={(v) => {
                    const next = [...features];
                    if (v.trim()) next[idx] = v.trim();
                    else next.splice(idx, 1);
                    onChange({ features: next });
                  }}
                  ariaLabel={`Feature ${idx + 1}`}
                  className="flex-1 text-[13px] text-foreground"
                  inputClassName="w-full text-[13px]"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({ features: features.filter((_, i) => i !== idx) })
                  }
                  aria-label="Remove feature"
                  className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-red-500 group-hover/feat:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => onChange({ features: [...features, "New feature"] })}
                className="flex items-center gap-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Add a feature
              </button>
            </li>
          </ul>
        </div>
      </div>
    );
  }

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
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="font-medium">{label}</span>
      <InlineNumber
        tone={tone}
        value={value}
        onChange={onChange}
        min={0}
        step={1}
        width="w-20"
        ariaLabel={label}
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
  /** Kept for backwards-compat with callers that don't yet use the floating toolbar. */
  onRemove?: () => void;
}

export function PricingInlineEditor({ block, onChange }: PricingInlineEditorProps) {
  const lineItems = block.lineItems ?? [];
  const currency = (block.currency ?? "aud").toUpperCase();
  const editable = block.allowQuantityEdit !== false;
  const style = resolveBlockStyle(block.style);
  const isVisual = style.variant === "visual";

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

  /** Visual variant tints the title bar with the primary colour; simple stays neutral. */
  const headerStyle: React.CSSProperties | undefined = isVisual
    ? {
        background: withAlpha(style.primaryColor, 0.08),
        borderBottomColor: withAlpha(style.primaryColor, 0.2),
      }
    : undefined;
  const totalRowStyle: React.CSSProperties = {
    background: withAlpha(style.highlightColor, isVisual ? 0.15 : 0.08),
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        isVisual ? "border-border/70" : "border-border/60",
      )}
      style={
        isVisual
          ? { borderColor: withAlpha(style.primaryColor, 0.25) }
          : undefined
      }
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3"
        style={headerStyle}
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
            <tr style={totalRowStyle}>
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
