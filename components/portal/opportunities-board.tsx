"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Activity, EllipsisVertical, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OPPORTUNITY_STAGES,
  isOpportunityStage,
  opportunityStageLabel,
} from "@/lib/crm/opportunity-stages";
import type { OpportunityBoardCard, OpportunityStage } from "@/types/opportunity";
import { useOpportunityStageMutation } from "@/hooks/use-opportunity-stage-mutation";
import { deleteOpportunityAction } from "@/server/actions/opportunities-crm";
import { initialsFromName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatOpportunityCardDate(ms: number | undefined): string {
  if (typeof ms !== "number" || !ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function stageTagClass(stage: OpportunityStage): string {
  switch (stage) {
    case "won":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100";
    case "lost":
      return "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100";
    case "negotiation":
      return "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100";
    case "proposal_sent":
      return "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100";
    case "discovery":
      return "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function StageColumn({
  stage,
  children,
  count,
}: {
  stage: OpportunityStage;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[420px] min-w-[260px] flex-1 flex-col rounded-xl border bg-muted/20",
        isOver ? "border-primary/60 ring-1 ring-primary/30" : "border-border/70",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <span className="text-[13px] font-semibold text-foreground">{opportunityStageLabel(stage)}</span>
        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary-foreground">
          {count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">{children}</div>
    </div>
  );
}

function OpportunityCard({
  opp,
  disabled,
}: {
  opp: OpportunityBoardCard;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opp.id,
    disabled: disabled || isDeleting,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const notes = opp.opportunityNoteCount ?? 0;
  const activities = opp.opportunityActivityCount ?? 0;
  const hasAssignee = Boolean(opp.assigneeUid?.trim());
  const assigneeLabel = hasAssignee ? opp.assigneeDisplayName?.trim() || "Team member" : "Unassigned";
  const photo = opp.assigneePhotoUrl?.trim();
  const initialsSource = hasAssignee ? opp.assigneeDisplayName?.trim() || assigneeLabel : "";

  async function handleDelete() {
    const ok = window.confirm("Delete this pipeline deal and its notes/activities? This cannot be undone.");
    if (!ok) return;
    setIsDeleting(true);
    const res = await deleteOpportunityAction({ opportunityId: opp.id });
    setIsDeleting(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.refresh();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-border/70 bg-card shadow-sm transition-colors",
        isDragging && "opacity-40",
        (disabled || isDeleting) && "pointer-events-none opacity-60",
      )}
    >
      <div {...listeners} {...attributes} className="cursor-grab p-3 active:cursor-grabbing">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "inline-flex max-w-[min(100%,12rem)] truncate rounded-md px-2 py-0.5 text-[11px] font-medium",
              stageTagClass(opp.stage),
            )}
          >
            {opportunityStageLabel(opp.stage)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onPointerDown={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mr-1 -mt-1" aria-label="Pipeline deal options">
                <EllipsisVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href={`/admin/opportunities/${opp.id}`}>Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onSelect={() => void handleDelete()}
              >
                Delete deal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/admin/customers/${opp.customerId}`}>Open account</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link
          href={`/admin/opportunities/${opp.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-2 block text-[13px] font-semibold leading-snug text-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {opp.name}
        </Link>
        <Link
          href={`/admin/customers/${opp.customerId}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-1.5 block truncate text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {opp.leadContactName}
        </Link>
        <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-muted-foreground">
          <p>Created: {formatOpportunityCardDate(opp.createdAtMs)}</p>
          <p>Last update: {formatOpportunityCardDate(opp.updatedAtMs)}</p>
        </div>

        {typeof opp.amountMinor === "number" ? (
          <p className="mt-2 text-[12px] tabular-nums text-muted-foreground">
            {(opp.amountMinor / 100).toLocaleString(undefined, {
              style: "currency",
              currency: opp.currency.toUpperCase(),
            })}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div
            className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-card bg-muted ring-2 ring-background"
            title={assigneeLabel}
          >
            {photo ? (
              <Image src={photo} alt="" width={28} height={28} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary/15 text-[10px] font-semibold text-primary">
                {hasAssignee ? initialsFromName(initialsSource) : "?"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1" title="Notes on this deal">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {notes}
            </span>
            <span className="inline-flex items-center gap-1" title="Activities on this deal">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              {activities}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface OpportunitiesBoardProps {
  opportunities: OpportunityBoardCard[];
}

export function OpportunitiesBoard({ opportunities }: OpportunitiesBoardProps) {
  const { moveStage, pendingId } = useOpportunityStageMutation();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const byStage = React.useMemo(() => {
    const map = new Map<OpportunityStage, OpportunityBoardCard[]>();
    for (const s of OPPORTUNITY_STAGES) {
      map.set(s, []);
    }
    for (const o of opportunities) {
      const list = map.get(o.stage);
      if (list) list.push(o);
      else map.get("lead_in")!.push(o);
    }
    return map;
  }, [opportunities]);

  const activeOpp = activeId ? opportunities.find((o) => o.id === activeId) : undefined;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const oid = String(event.active.id);
    setActiveId(null);
    const overId = event.over?.id;
    if (!overId) return;
    const opp = opportunities.find((o) => o.id === oid);
    if (!opp) return;
    const nextStage = String(overId);
    if (!isOpportunityStage(nextStage)) return;
    if (nextStage === opp.stage) return;
    void moveStage(oid, nextStage as OpportunityStage);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {OPPORTUNITY_STAGES.map((stage) => {
          const list = byStage.get(stage) ?? [];
          return (
            <StageColumn key={stage} stage={stage} count={list.length}>
              {list.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} disabled={pendingId === opp.id} />
              ))}
            </StageColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeOpp ? (
          <div className="pointer-events-none min-w-[240px] max-w-[280px] rounded-xl border border-border bg-card p-3 shadow-lg">
            <p className="text-[13px] font-semibold text-foreground">{activeOpp.name}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{activeOpp.leadContactName}</p>
            <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-muted-foreground">
              <p>Created: {formatOpportunityCardDate(activeOpp.createdAtMs)}</p>
              <p>Last update: {formatOpportunityCardDate(activeOpp.updatedAtMs)}</p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
