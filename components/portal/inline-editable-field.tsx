"use client";

import * as React from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericStepper } from "@/components/ui/numeric-stepper";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface InlineEditableFieldProps {
  /** Unique id so only one field edits at a time when coordinated by parent. */
  fieldId: string;
  activeFieldId: string | null;
  onActiveFieldIdChange: (fieldId: string | null) => void;
  value: string;
  onSave: (value: string) => Promise<{ ok: boolean; message?: string }>;
  disabled?: boolean;
  editLabel: string;
  placeholder?: string;
  /** Shown in view mode when value is empty. */
  emptyDisplay?: string;
  multiline?: boolean;
  inputType?: "text" | "number";
  inputMin?: number;
  inputMax?: number;
  /** When true with `inputType="number"`, edit mode uses +/- stepper instead of a text input. */
  useNumericStepper?: boolean;
  className?: string;
}

function parseDraftNumber(raw: string, min: number, max?: number): number {
  const n = Number.parseInt(raw, 10);
  const base = Number.isFinite(n) ? n : min;
  const floored = Math.max(min, Math.floor(base));
  if (typeof max === "number" && Number.isFinite(max)) {
    return Math.min(max, floored);
  }
  return floored;
}

const viewBoxClass =
  "group/inline flex min-h-9 w-full items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm text-foreground transition-colors";
const viewBoxHoverClass =
  "hover:border-border/80 hover:bg-muted/25 focus-within:border-border/80 focus-within:bg-muted/25";
const editInputClass =
  "h-9 flex-1 border-border/80 bg-background/60 text-[14px] shadow-none focus-visible:ring-2 focus-visible:ring-primary/40";
const actionButtonClass = "h-8 w-8 shrink-0 rounded-full";

export function InlineEditableField({
  fieldId,
  activeFieldId,
  onActiveFieldIdChange,
  value,
  onSave,
  disabled = false,
  editLabel,
  placeholder,
  emptyDisplay = "—",
  multiline = false,
  inputType = "text",
  inputMin = 0,
  inputMax,
  useNumericStepper = false,
  className,
}: InlineEditableFieldProps) {
  const showStepper = useNumericStepper && inputType === "number";
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isEditing = activeFieldId === fieldId;

  React.useEffect(() => {
    if (!isEditing) {
      setDraft(value);
      setError(null);
    }
  }, [isEditing, value]);

  React.useEffect(() => {
    if (isEditing && !showStepper) {
      inputRef.current?.focus();
      if (inputRef.current && "select" in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [isEditing, showStepper]);

  function startEditing() {
    if (disabled || saving) return;
    setDraft(value);
    setError(null);
    onActiveFieldIdChange(fieldId);
  }

  function cancelEditing() {
    setDraft(value);
    setError(null);
    onActiveFieldIdChange(null);
  }

  async function confirmEditing() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await onSave(draft);
    setSaving(false);
    if (!res.ok) {
      setError(res.message ?? "Could not save.");
      return;
    }
    onActiveFieldIdChange(null);
  }

  const displayText = value.trim() ? value.trim() : emptyDisplay;
  const isEmpty = !value.trim();

  if (disabled) {
    return (
      <p className={cn("text-sm text-foreground", isEmpty && "text-muted-foreground", className)}>
        {displayText}
      </p>
    );
  }

  if (isEditing) {
    const numericDraft = showStepper ? parseDraftNumber(draft, inputMin, inputMax) : 0;

    return (
      <div className={cn("space-y-1", className)}>
        <div className={cn("flex gap-1.5", showStepper ? "items-center" : "items-start")}>
          {multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              rows={3}
              disabled={saving}
              placeholder={placeholder}
              aria-label={editLabel}
              className={cn(
                "min-h-[5rem] flex-1 resize-y border-border/80 bg-background/60 text-[14px] shadow-none focus-visible:ring-2 focus-visible:ring-primary/40",
              )}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditing();
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void confirmEditing();
                }
              }}
            />
          ) : showStepper ? (
            <NumericStepper
              value={numericDraft}
              min={inputMin}
              max={inputMax}
              disabled={saving}
              aria-label={editLabel}
              className="min-w-0 flex-1"
              onChange={(next) => setDraft(String(next))}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={inputType}
              min={inputType === "number" ? inputMin : undefined}
              value={draft}
              disabled={saving}
              placeholder={placeholder}
              aria-label={editLabel}
              className={editInputClass}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void confirmEditing();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditing();
                }
              }}
            />
          )}
          <div
            className={cn("flex shrink-0 items-center gap-1", !showStepper && "pt-0.5")}
            onKeyDown={
              showStepper
                ? (e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEditing();
                    }
                  }
                : undefined
            }
          >
            <Button
              type="button"
              size="icon"
              className={actionButtonClass}
              disabled={saving}
              aria-label={`Save ${editLabel}`}
              onClick={() => void confirmEditing()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(actionButtonClass, "border-border/80 bg-muted/40")}
              disabled={saving}
              aria-label={`Cancel editing ${editLabel}`}
              onClick={cancelEditing}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="button"
        tabIndex={0}
        className={cn(viewBoxClass, viewBoxHoverClass, "cursor-text")}
        onClick={startEditing}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing();
          }
        }}
      >
        <span
          className={cn(
            "min-w-0 flex-1",
            !multiline && "truncate",
            isEmpty && "text-muted-foreground",
            multiline && !isEmpty && "whitespace-pre-wrap",
          )}
        >
          {displayText}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover/inline:opacity-100 group-focus-within/inline:opacity-100"
          aria-label={`Edit ${editLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            startEditing();
          }}
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
