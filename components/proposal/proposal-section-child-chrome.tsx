"use client";

import * as React from "react";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROPOSAL_EDITOR_SECTION_CHILD_INSERT_HOST_CLASSES } from "@/lib/proposal-public-layout";

/** Past the drag gutter — matches {@link SECTION_CHILD_DRAG_GUTTER_CLASSES} width. */
const SECTION_CHILD_INSERT_LEFT_CLASSES = "left-9 sm:left-10";

/**
 * Qwilr-style insert inside a section: a single floating “+” on the seam (no full-width row or label).
 */
export function SectionChildInsertSlot({
  menu,
  className,
  placement = "between",
}: {
  menu: (trigger: React.ReactNode) => React.ReactNode;
  className?: string;
  /** `trailing` sits on the last seam before the next root band — slightly higher stacking. */
  placement?: "between" | "trailing";
}) {
  const isTrailing = placement === "trailing";

  const trigger = (
    <button
      type="button"
      aria-label="Add content"
      className={cn(
        "pointer-events-auto absolute top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full p-0",
        SECTION_CHILD_INSERT_LEFT_CLASSES,
        "border border-border/80 bg-background text-muted-foreground shadow-sm",
        "opacity-0 transition-[opacity,border-color,color,background-color] duration-150",
        "group-hover/section-insert:opacity-100",
        "group-focus-within/section-insert:opacity-100",
        "hover:border-primary/50 hover:text-primary",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "data-[state=open]:border-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:opacity-100",
      )}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
    </button>
  );

  return (
    <div
      className={cn(
        "group/section-insert pointer-events-none",
        PROPOSAL_EDITOR_SECTION_CHILD_INSERT_HOST_CLASSES,
        isTrailing ? "z-[25]" : "z-[20]",
        className,
      )}
    >
      {menu(trigger)}
    </div>
  );
}

/** Layout-only; visibility is toggled from {@link SortableShell} row hover state. */
export const SECTION_CHILD_DRAG_GUTTER_CLASSES =
  "flex w-9 shrink-0 items-start justify-center pt-1.5 transition-opacity duration-150 sm:w-10";

export const SECTION_CHILD_DRAG_HANDLE_CLASSES = cn(
  "touch-none flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground",
  "hover:bg-muted/70 hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

export function SectionChildDragHandle({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn(SECTION_CHILD_DRAG_HANDLE_CLASSES, className)} {...props}>
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );
}
