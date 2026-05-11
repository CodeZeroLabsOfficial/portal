"use client";

import * as React from "react";
import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const outerEase = [0.22, 1, 0.36, 1] as const;
const innerEase = [0.2, 1, 0.28, 1] as const;

type SurfaceProps = Omit<
  HTMLMotionProps<"div">,
  "children" | "initial" | "animate" | "exit" | "transition" | "className"
>;

/**
 * Accordion body: height clip + slight scale-y / slide from top (“roll” open).
 * Outer layer handles collapse; inner layer handles the unroll on expand.
 */
export function ProposalAccordionExpandSurface({
  open,
  motionKey,
  className,
  children,
  style,
  ...surfaceMotion
}: {
  open: boolean;
  motionKey: string;
  className?: string;
  children: React.ReactNode;
} & SurfaceProps) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key={motionKey}
          initial={{ height: 0 }}
          animate={{ height: "auto" }}
          exit={{ height: 0 }}
          transition={{ duration: 0.34, ease: outerEase }}
          className="overflow-hidden"
        >
          <motion.div
            initial={{ scaleY: 0.88, y: -12, opacity: 0 }}
            animate={{ scaleY: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.32, ease: innerEase }}
            style={{ transformOrigin: "top center", ...style }}
            className={cn("will-change-transform", className)}
            {...surfaceMotion}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
