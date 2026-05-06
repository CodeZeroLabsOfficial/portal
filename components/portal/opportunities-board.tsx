"use client";

import * as React from "react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import {
  OPPORTUNITY_STAGES,
  isOpportunityStage,
  opportunityStageLabel,
} from "@/lib/crm/opportunity-stages";
import type { OpportunityRecord, OpportunityStage } from "@/types/opportunity";
import { useOpportunityStageMutation } from "@/hooks/use-opportunity-stage-mutation";

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
        "flex min-h-[420px] min-w-[220px] flex-1 flex-col rounded-xl border bg-muted/20",
        isOver ? "border-primary/60 ring-1 ring-primary/30" : "border-border/70",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-[13px] font-semibold text-foreground">{opportunityStageLabel(stage)}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
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
  opp: OpportunityRecord;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opp.id,
    disabled,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/70 bg-card shadow-sm transition-colors",
        isDragging && "opacity-40",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div {...listeners} {...attributes} className="cursor-grab p-3 active:cursor-grabbing">
        <p className="text-[13px] font-medium leading-snug text-foreground">{opp.name}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">#{opp.id.slice(0, 8)}…</p>
        {typeof opp.amountMinor === "number" ? (
          <p className="mt-2 text-[12px] tabular-nums text-muted-foreground">
            {(opp.amountMinor / 100).toLocaleString(undefined, {
              style: "currency",
              currency: opp.currency.toUpperCase(),
            })}
          </p>
        ) : null}
        <Link
          href={`/admin/opportunities/${opp.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-3 inline-flex text-[11px] font-medium text-primary underline-offset-4 hover:underline"
        >
          Open detail
        </Link>
      </div>
    </div>
  );
}

export interface OpportunitiesBoardProps {
  opportunities: OpportunityRecord[];
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
    const map = new Map<OpportunityStage, OpportunityRecord[]>();
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
          <div className="pointer-events-none min-w-[200px] rounded-lg border border-border bg-card p-3 shadow-lg">
            <p className="text-[13px] font-medium text-foreground">{activeOpp.name}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
