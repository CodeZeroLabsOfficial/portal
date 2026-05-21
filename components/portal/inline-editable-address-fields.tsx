"use client";

import * as React from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { addressBlockFromFields, formatAddressLines, type AddressFields } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface InlineEditableAddressFieldsProps {
  fieldId: string;
  activeFieldId: string | null;
  onActiveFieldIdChange: (fieldId: string | null) => void;
  value: AddressFields;
  onSave: (value: AddressFields) => Promise<{ ok: boolean; message?: string }>;
  disabled?: boolean;
  editLabel?: string;
  className?: string;
}

const viewBoxClass =
  "group/inline flex min-h-9 w-full items-start gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm text-foreground transition-colors";
const viewBoxHoverClass =
  "hover:border-border/80 hover:bg-muted/25 focus-within:border-border/80 focus-within:bg-muted/25";
const editInputClass =
  "h-9 border-border/80 bg-background/60 text-[14px] shadow-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function InlineEditableAddressFields({
  fieldId,
  activeFieldId,
  onActiveFieldIdChange,
  value,
  onSave,
  disabled = false,
  editLabel = "address",
  className,
}: InlineEditableAddressFieldsProps) {
  const displayText = addressBlockFromFields(value);
  const hasValue = formatAddressLines(value).length > 0;
  const isEditing = activeFieldId === fieldId;

  const [draft, setDraft] = React.useState<AddressFields>(value);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isEditing) {
      setDraft(value);
      setError(null);
    }
  }, [isEditing, value]);

  function startEdit() {
    if (disabled) return;
    setDraft(value);
    setError(null);
    onActiveFieldIdChange(fieldId);
  }

  function cancelEdit() {
    setDraft(value);
    setError(null);
    onActiveFieldIdChange(null);
  }

  async function commit() {
    setSaving(true);
    setError(null);
    try {
      const res = await onSave(draft);
      if (!res.ok) {
        setError(res.message ?? "Could not save.");
        return;
      }
      onActiveFieldIdChange(null);
    } finally {
      setSaving(false);
    }
  }

  function patchDraft(patch: Partial<AddressFields>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  if (isEditing) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="space-y-1.5">
          <Input
            className={editInputClass}
            placeholder="Line 1"
            autoComplete="address-line1"
            value={draft.addressLine1 ?? ""}
            onChange={(e) => patchDraft({ addressLine1: e.target.value })}
            disabled={saving}
          />
          <Input
            className={editInputClass}
            placeholder="Line 2"
            autoComplete="address-line2"
            value={draft.addressLine2 ?? ""}
            onChange={(e) => patchDraft({ addressLine2: e.target.value })}
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              className={editInputClass}
              placeholder="City"
              autoComplete="address-level2"
              value={draft.city ?? ""}
              onChange={(e) => patchDraft({ city: e.target.value })}
              disabled={saving}
            />
            <Input
              className={editInputClass}
              placeholder="State / region"
              autoComplete="address-level1"
              value={draft.region ?? ""}
              onChange={(e) => patchDraft({ region: e.target.value })}
              disabled={saving}
            />
            <Input
              className={editInputClass}
              placeholder="Postal code"
              autoComplete="postal-code"
              value={draft.postalCode ?? ""}
              onChange={(e) => patchDraft({ postalCode: e.target.value })}
              disabled={saving}
            />
            <Input
              className={editInputClass}
              placeholder="Country"
              autoComplete="country-name"
              value={draft.country ?? ""}
              onChange={(e) => patchDraft({ country: e.target.value })}
              disabled={saving}
            />
          </div>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-8 w-8 shrink-0 rounded-full"
            disabled={saving}
            aria-label={`Save ${editLabel}`}
            onClick={() => void commit()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 rounded-full"
            disabled={saving}
            aria-label={`Cancel editing ${editLabel}`}
            onClick={cancelEdit}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(viewBoxClass, !disabled && viewBoxHoverClass, className)}>
      <button
        type="button"
        className="min-w-0 flex-1 whitespace-pre-line text-left"
        disabled={disabled}
        onClick={startEdit}
      >
        {hasValue ? displayText : <span className="text-muted-foreground">—</span>}
      </button>
      {!disabled ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 rounded-full opacity-0 transition-opacity group-hover/inline:opacity-100"
          aria-label={`Edit ${editLabel}`}
          onClick={startEdit}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
