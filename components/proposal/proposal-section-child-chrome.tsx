"use client";

import * as React from "react";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROPOSAL_EDITOR_SECTION_CHILD_INSERT_HOST_CLASSES } from "@/lib/proposal-public-layout";

/** Align floating insert row with section child content (past the drag gutter). */
const SECTION_CHILD_INSERT_INSET_CLASSES = "left-9 right-0 sm:left-10";

/**
 * Qwilr-style insert affordance inside a section: “+ Add content” floats on the
 * seam and does not expand the layout when hovered.
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
        "pointer-events-auto absolute top-1/2 z-20 flex min-h-7 -translate-y-1/2 items-center gap-2.5",
        SECTION_CHILD_INSERT_INSET_CLASSES,
        "border-0 bg-transparent py-0 pl-0.5 pr-2 text-left",
        "text-muted-foreground/75 opacity-0 transition-[opacity,background-color,box-shadow] duration-150",
        "group-hover/section-insert:opacity-100",
        "group-hover/section-insert:rounded-md group-hover/section-insert:bg-background/95 group-hover/section-insert:py-1 group-hover/section-insert:shadow-sm",
        "group-focus-within/section-insert:opacity-100",
        "group-focus-within/section-insert:rounded-md group-focus-within/section-insert:bg-background/95 group-focus-within/section-insert:py-1 group-focus-within/section-insert:shadow-sm",
        "data-[state=open]:opacity-100 data-[state=open]:rounded-md data-[state=open]:bg-background data-[state=open]:py-1 data-[state=open]:shadow-md",
        "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "data-[state=open]:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground shadow-sm",
          "transition-colors group-hover/section-insert:border-primary/50 group-hover/section-insert:text-primary",
          "group-focus-within/section-insert:border-primary/50 group-focus-within/section-insert:text-primary",
          "data-[state=open]:border-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground",
        )}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="whitespace-nowrap text-sm">Add content</span>
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
