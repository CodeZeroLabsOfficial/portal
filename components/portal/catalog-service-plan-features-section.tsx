"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, ListChecks, Plus, Trash2 } from "lucide-react";
import { InlineEditableField } from "@/components/portal/inline-editable-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_FEATURES = 40;
const MAX_FEATURE_LENGTH = 200;

export interface CatalogServicePlanFeaturesSectionProps {
  features: string[];
  disabled?: boolean;
  activeFieldId: string | null;
  onActiveFieldIdChange: (fieldId: string | null) => void;
  onSaveFeatures: (features: string[]) => Promise<{ ok: boolean; message?: string }>;
}

export function CatalogServicePlanFeaturesSection({
  features,
  disabled = false,
  activeFieldId,
  onActiveFieldIdChange,
  onSaveFeatures,
}: CatalogServicePlanFeaturesSectionProps) {
  const [expanded, setExpanded] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const contentId = React.useId();

  async function persist(next: string[]) {
    const trimmed = next.map((f) => f.trim()).filter(Boolean);
    if (trimmed.length > MAX_FEATURES) {
      return { ok: false as const, message: `At most ${MAX_FEATURES} features allowed.` };
    }
    for (const f of trimmed) {
      if (f.length > MAX_FEATURE_LENGTH) {
        return {
          ok: false as const,
          message: `Each feature must be ${MAX_FEATURE_LENGTH} characters or fewer.`,
        };
      }
    }
    setSaving(true);
    const res = await onSaveFeatures(trimmed);
    setSaving(false);
    return res;
  }

  async function addFeature() {
    if (disabled || saving) return;
    const next = [...features, "New feature"];
    const res = await persist(next);
    if (res.ok) {
      onActiveFieldIdChange(`feature-${next.length - 1}`);
      setExpanded(true);
    }
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          Included features
          {features.length > 0 ? (
            <span className="normal-case tracking-normal text-muted-foreground/80">
              ({features.length})
            </span>
          ) : null}
        </p>
        <button
          type="button"
          disabled={disabled || saving}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
            "hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          )}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Collapse" : "Expand"}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>

      {expanded ? (
        <div id={contentId} className="space-y-3">
          {features.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {features.map((feat, idx) => (
                <li
                  key={`${idx}-${feat}`}
                  className="group/feat flex items-center gap-3"
                >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <InlineEditableField
                      className="min-w-0 flex-1 font-medium"
                      fieldId={`feature-${idx}`}
                      activeFieldId={activeFieldId}
                      onActiveFieldIdChange={onActiveFieldIdChange}
                      value={feat}
                      editLabel={`feature ${idx + 1}`}
                      placeholder="Feature name"
                      emptyDisplay="Untitled feature"
                      disabled={disabled || saving}
                      onSave={async (next) => {
                        const trimmed = next.trim();
                        const updated = [...features];
                        if (!trimmed) {
                          updated.splice(idx, 1);
                        } else {
                          updated[idx] = trimmed;
                        }
                        return persist(updated);
                      }}
                    />
                  {!disabled ? (
                    <button
                      type="button"
                      disabled={saving}
                      aria-label={`Remove feature ${idx + 1}`}
                      className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/feat:opacity-100"
                      onClick={() => void persist(features.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No features yet. Add one to show on proposals.
            </p>
          )}

          {!disabled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || features.length >= MAX_FEATURES}
              onClick={() => void addFeature()}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add feature
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
