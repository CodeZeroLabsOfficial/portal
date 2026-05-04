"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { LayoutGrid, List } from "lucide-react";
import type { OpportunityRecord } from "@/types/opportunity";
import { OpportunitiesBoard } from "@/components/portal/opportunities-board";
import { OpportunitiesList } from "@/components/portal/opportunities-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OpportunitiesPanelProps {
  opportunities: OpportunityRecord[];
}

export function OpportunitiesPanel({ opportunities }: OpportunitiesPanelProps) {
  const [mode, setMode] = React.useState<"board" | "list">("board");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem] md:leading-tight">
            Pipeline
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag cards between stages or use the list view to change the stage from the dropdown.
          </p>
        </motion.div>
        <div className="flex rounded-lg border border-border/80 bg-muted/30 p-0.5">
          <Button
            type="button"
            variant={mode === "board" ? "secondary" : "ghost"}
            size="sm"
            className={cn("gap-1.5", mode === "board" && "shadow-sm")}
            onClick={() => setMode("board")}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Board
          </Button>
          <Button
            type="button"
            variant={mode === "list" ? "secondary" : "ghost"}
            size="sm"
            className={cn("gap-1.5", mode === "list" && "shadow-sm")}
            onClick={() => setMode("list")}
          >
            <List className="h-4 w-4" aria-hidden />
            List
          </Button>
        </div>
      </div>

      {mode === "board" ? (
        <OpportunitiesBoard opportunities={opportunities} />
      ) : (
        <OpportunitiesList opportunities={opportunities} />
      )}
    </div>
  );
}
