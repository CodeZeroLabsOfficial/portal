"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";

export function TemplatesHubPageIntro({ actions }: { actions: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-wrap items-start justify-between gap-4"
    >
      <div>
        <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Templates</h1>
        <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>
          Create, send, and track dynamic digital proposals.
        </p>
      </div>
      {actions}
    </motion.div>
  );
}
