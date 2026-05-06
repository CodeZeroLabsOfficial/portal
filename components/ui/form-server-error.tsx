"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FormServerErrorProps {
  /** Error message string; renders nothing when null/empty. */
  message: string | null;
  /** Match the surrounding container's border-radius. Defaults to `lg`. */
  rounded?: "lg" | "xl";
}

/**
 * Animated `role="alert"` banner shown above forms when a server action returns
 * `{ ok: false, message }`. Replaces the same `<AnimatePresence>+motion.div`
 * block previously inlined in every dialog/edit form (~9 places).
 */
export function FormServerError({ message, rounded = "lg" }: FormServerErrorProps) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            "border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive",
            rounded === "lg" ? "rounded-lg" : "rounded-xl",
          )}
          role="alert"
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
