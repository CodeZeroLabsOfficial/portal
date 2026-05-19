"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NumericStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  /** `glass` matches dark workspace dialogs; `default` matches proposal add-on tables. */
  variant?: "default" | "glass";
  className?: string;
}

function clampValue(value: number, min: number, max?: number): number {
  const floored = Math.max(min, Math.floor(value));
  if (typeof max === "number" && Number.isFinite(max)) {
    return Math.min(max, floored);
  }
  return floored;
}

export function NumericStepper({
  value,
  onChange,
  min = 0,
  max,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  variant = "default",
  className,
}: NumericStepperProps) {
  const current = clampValue(value, min, max);
  const atMin = current <= min;

  function setNext(next: number) {
    onChange(clampValue(next, min, max));
  }

  const shellClass =
    variant === "glass"
      ? "border-white/[0.08] bg-white/[0.04] shadow-sm"
      : "border-border/60 bg-background shadow-sm";

  const btnClass =
    variant === "glass"
      ? "text-white hover:bg-white/10 focus-visible:ring-offset-background disabled:opacity-50"
      : "text-foreground hover:bg-muted focus-visible:ring-offset-background disabled:opacity-50";

  const valueClass = variant === "glass" ? "text-white" : "text-foreground";

  return (
    <div
      id={id}
      className={cn(
        "inline-flex items-center rounded-md border p-0.5",
        shellClass,
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        disabled={disabled || atMin}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:pointer-events-none",
          btnClass,
        )}
        aria-label={ariaLabel ? `Decrease ${ariaLabel}` : "Decrease"}
        onClick={() => setNext(current - 1)}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        className={cn("min-w-8 px-1 text-center text-sm font-medium tabular-nums", valueClass)}
        aria-live="polite"
      >
        {current}
      </span>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:pointer-events-none",
          btnClass,
        )}
        aria-label={ariaLabel ? `Increase ${ariaLabel}` : "Increase"}
        onClick={() => setNext(current + 1)}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
