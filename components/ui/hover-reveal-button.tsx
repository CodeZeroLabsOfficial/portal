import * as React from "react";
import Link from "next/link";
import { Button, buttonVariants, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Icon-only list/table action — no chrome at rest; surface on hover (Qwilr-style). */
export const listRowIconActionClassName =
  "h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground";

export const hoverRevealToolbarClassName =
  "group/hover-reveal h-8 min-w-8 gap-0 px-2 text-muted-foreground transition-[gap,padding,colors] duration-200 ease-out hover:gap-1.5 hover:px-3 hover:text-foreground";

export const hoverRevealLabelClassName =
  "inline-block max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover/hover-reveal:max-w-[10rem] group-hover/hover-reveal:opacity-100 group-focus-visible/hover-reveal:max-w-[10rem] group-focus-visible/hover-reveal:opacity-100";

export type HoverRevealButtonProps = ButtonProps & {
  /** Shown when the control is hovered or focused. */
  label: string;
};

/**
 * Toolbar control: icon only at rest; label and button surface appear on hover/focus.
 * Matches proposal editor Preview / Publish actions.
 */
export function HoverRevealButton({
  label,
  className,
  children,
  variant = "ghost",
  size = "sm",
  ...props
}: HoverRevealButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(hoverRevealToolbarClassName, className)}
      aria-label={props["aria-label"] ?? label}
      {...props}
    >
      {children}
      <span aria-hidden className={hoverRevealLabelClassName}>
        {label}
      </span>
    </Button>
  );
}

export type HoverRevealLinkProps = React.ComponentProps<typeof Link> & {
  label: string;
};

/** Next.js link variant for in-app preview routes. */
export function HoverRevealLink({ label, className, children, ...props }: HoverRevealLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), hoverRevealToolbarClassName, className)}
      aria-label={props["aria-label"] ?? label}
      {...props}
    >
      {children}
      <span aria-hidden className={hoverRevealLabelClassName}>
        {label}
      </span>
    </Link>
  );
}

export type HoverRevealAnchorProps = React.ComponentProps<"a"> & {
  label: string;
};

/** Plain anchor for external targets (e.g. public proposal preview). */
export function HoverRevealAnchor({ label, className, children, ...props }: HoverRevealAnchorProps) {
  return (
    <a
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), hoverRevealToolbarClassName, className)}
      aria-label={props["aria-label"] ?? label}
      {...props}
    >
      {children}
      <span aria-hidden className={hoverRevealLabelClassName}>
        {label}
      </span>
    </a>
  );
}
