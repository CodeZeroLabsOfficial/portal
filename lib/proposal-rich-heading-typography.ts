import { cn } from "@/lib/utils";

/**
 * Tailwind selectors for h1–h4 inside `.proposal-rich-text` on the public page and in
 * {@link components/proposal/proposal-rich-text} — keeps builder and preview in sync.
 */
export const PROPOSAL_RICH_HEADING_LEVEL_CLASSES = cn(
  "[&_h1]:mt-2 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight",
  "[&_h2]:mt-1.5 [&_h2]:mb-1.5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-tight",
  "[&_h3]:mt-1.5 [&_h3]:mb-1.5 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug",
  "[&_h4]:mt-1 [&_h4]:mb-1 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:leading-snug",
);
