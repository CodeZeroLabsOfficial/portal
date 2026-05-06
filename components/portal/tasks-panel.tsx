"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Filter, LayoutGrid, List, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_HUB_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_CLASS,
} from "@/lib/workspace-page-typography";
import { statusToBoardColumn } from "@/lib/tasks/task-board-columns";
import type { TaskRecord } from "@/types/task";
import { Button } from "@/components/ui/button";
import { TasksBoard } from "@/components/portal/tasks-board";
import { TasksList } from "@/components/portal/tasks-list";

export type TaskHubFilterTab = "all" | "my" | "looked" | "closing";

const DAY_MS = 24 * 60 * 60 * 1000;

const TAB_LABELS: { id: TaskHubFilterTab; label: string }[] = [
  { id: "all", label: "All Tasks" },
  { id: "my", label: "My Tasks" },
  { id: "looked", label: "Looked Tasks" },
  { id: "closing", label: "Closing Tasks" },
];

function filterTasksForTab(tasks: TaskRecord[], tab: TaskHubFilterTab, viewerUid: string): TaskRecord[] {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  switch (tab) {
    case "all":
      return tasks;
    case "my":
      return tasks.filter((t) => t.assignedToUid === viewerUid);
    case "looked": {
      return tasks.filter((t) => {
        const p = (t.priority ?? "").toLowerCase();
        return p.includes("high") || p.includes("premium");
      });
    }
    case "closing":
      return tasks.filter((t) => {
        const col = statusToBoardColumn(t.status);
        const dueSoon =
          typeof t.dueAtMs === "number" && t.dueAtMs <= now + weekMs && t.dueAtMs >= now - DAY_MS;
        return col === "review" || dueSoon;
      });
    default:
      return tasks;
  }
}

export interface TasksPanelProps {
  tasks: TaskRecord[];
  viewerUid: string;
}

export function TasksPanel({ tasks, viewerUid }: TasksPanelProps) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"board" | "list">("board");
  const [filterTab, setFilterTab] = React.useState<TaskHubFilterTab>("all");

  const filtered = React.useMemo(
    () => filterTasksForTab(tasks, filterTab, viewerUid),
    [tasks, filterTab, viewerUid],
  );

  const lastUpdateMs = React.useMemo(() => {
    if (tasks.length === 0) return null;
    return Math.max(...tasks.map((t) => t.updatedAtMs));
  }, [tasks]);

  const lastUpdateLabel = lastUpdateMs
    ? new Date(lastUpdateMs).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h1 className={WORKSPACE_HUB_PAGE_TITLE_CLASS}>Tasks</h1>
          <p className={WORKSPACE_PAGE_DESCRIPTION_CLASS}>
            Drag cards between columns or switch to list view to change status from the dropdown.
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 border-b border-border/60">
          {TAB_LABELS.map((tab) => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={cn(
                  "-mb-px px-3 pb-2 pt-1 text-sm transition-colors",
                  active
                    ? "border-b-2 border-foreground font-semibold text-foreground"
                    : "border-b-2 border-transparent font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12px] text-muted-foreground">
            Last update: <span className="tabular-nums text-foreground">{lastUpdateLabel}</span>
          </p>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled>
            <Filter className="h-4 w-4" aria-hidden />
            Filter
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </Button>
          <Button type="button" size="sm" className="gap-1.5" disabled>
            + Add New
          </Button>
        </div>
      </div>

      {mode === "board" ? <TasksBoard tasks={filtered} /> : <TasksList tasks={filtered} />}
    </div>
  );
}
