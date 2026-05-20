"use client";

import * as React from "react";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Qwilr-style insert affordance inside a section: small “+” and hint on hover,
 * opens the section Content menu (caller supplies `menu`).
 */
export function SectionChildInsertSlot({
  menu,
  className,
}: {
  menu: (trigger: React.ReactNode) => React.ReactNode;
  className?: string;
}) {
  const trigger = (
    <button
      type="button"
      aria-label="Add content"
      className={cn(
        "group/section-insert flex w-full min-h-8 items-center gap-2.5 rounded-md border-0 bg-transparent py-1 pl-0.5 pr-2 text-left",
        "opacity-0 transition-opacity duration-150",
        "hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "group-hover/section-stack:opacity-100 group-focus-within/section-stack:opacity-100",
        "data-[state=open]:opacity-100",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground shadow-sm",
          "transition-colors group-hover/section-insert:border-primary/50 group-hover/section-insert:text-primary",
          "group-data-[state=open]/section-insert:border-primary group-data-[state=open]/section-insert:bg-primary group-data-[state=open]/section-insert:text-primary-foreground",
        )}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="text-sm text-muted-foreground/75">Type / to add content</span>
    </button>
  );

  return (
    <div className={cn("relative z-[1] w-full min-h-8", className)}>
      {menu(trigger)}
    </div>
  );
}

export const SECTION_CHILD_DRAG_GUTTER_CLASSES =
  "flex w-9 shrink-0 items-start justify-center pt-1.5 sm:w-10";

export const SECTION_CHILD_DRAG_HANDLE_CLASSES = cn(
  "touch-none flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground",
  "opacity-0 transition-opacity duration-150",
  "group-hover/sortblock:opacity-100",
  "hover:bg-muted/70 hover:text-foreground",
  "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
