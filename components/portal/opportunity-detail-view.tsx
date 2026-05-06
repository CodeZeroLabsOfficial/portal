"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Pin,
  Plus,
  StickyNote,
  Users,
} from "lucide-react";
import type { CustomerRecord } from "@/types/customer";
import type {
  OpportunityActivityKind,
  OpportunityActivityRecord,
  OpportunityNoteRecord,
  OpportunityRecord,
  OpportunityStage,
} from "@/types/opportunity";
import { OPPORTUNITY_STAGES, opportunityStageLabel } from "@/lib/crm/opportunity-stages";
import { useOpportunityStageMutation } from "@/hooks/use-opportunity-stage-mutation";
import {
  addOpportunityActivityAction,
  addOpportunityNoteAction,
} from "@/server/actions/opportunities-crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  WORKSPACE_DETAIL_PAGE_TITLE_CLASS,
  WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS,
} from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";

export interface OpportunityDetailViewProps {
  opportunity: OpportunityRecord;
  customer: CustomerRecord;
  notes: OpportunityNoteRecord[];
  activities: OpportunityActivityRecord[];
}

const CHEVRON_CLIP =
  "[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%,14px_50%)]";
const CHEVRON_CLIP_FIRST =
  "[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%)]";

const ACTIVITY_KINDS: { value: OpportunityActivityKind; label: string; Icon: typeof Phone }[] = [
  { value: "meeting", label: "Meeting", Icon: Users },
  { value: "call", label: "Phone call", Icon: Phone },
  { value: "email", label: "Email", Icon: Mail },
  { value: "other", label: "Other", Icon: Pin },
];

function activityKindMeta(kind: OpportunityActivityKind) {
  return ACTIVITY_KINDS.find((k) => k.value === kind) ?? ACTIVITY_KINDS[3];
}

function stageVariantClasses(
  stage: OpportunityStage,
  variant: "active" | "completed" | "upcoming",
): string {
  if (variant === "active") {
    if (stage === "lost") return "bg-destructive/15 text-destructive";
    if (stage === "won") return "bg-emerald-500/15 text-emerald-500";
    return "bg-primary/15 text-primary";
  }
  if (variant === "completed") {
    return "bg-muted text-foreground/80";
  }
  return "bg-muted/40 text-muted-foreground";
}

interface OpportunityStageProgressProps {
  opportunity: OpportunityRecord;
}

function OpportunityStageProgress({ opportunity }: OpportunityStageProgressProps) {
  const { moveStage, pendingId } = useOpportunityStageMutation();
  const busy = pendingId === opportunity.id;
  const currentIndex = OPPORTUNITY_STAGES.indexOf(opportunity.stage);

  const startDate = opportunity.createdAtMs
    ? new Date(opportunity.createdAtMs).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 px-4 py-4 shadow-sm sm:px-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Start
          </p>
          {startDate ? (
            <p className="text-[13px] tabular-nums text-foreground">{startDate}</p>
          ) : (
            <p className="text-[13px] text-muted-foreground">—</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Current stage
          </p>
          <p className="text-[13px] font-medium text-foreground">
            {opportunityStageLabel(opportunity.stage)}
          </p>
        </div>
      </div>

      <div className="-mx-4 flex items-stretch overflow-x-auto px-4 pb-1 pt-1 sm:-mx-6 sm:px-6">
        {OPPORTUNITY_STAGES.map((stage, i) => {
          const active = stage === opportunity.stage;
          const completed = i < currentIndex;
          const variant: "active" | "completed" | "upcoming" = active
            ? "active"
            : completed
              ? "completed"
              : "upcoming";
          return (
            <button
              key={stage}
              type="button"
              disabled={busy || active}
              onClick={() => {
                if (stage !== opportunity.stage) void moveStage(opportunity.id, stage);
              }}
              aria-current={active ? "step" : undefined}
              aria-label={`Move stage to ${opportunityStageLabel(stage)}`}
              className={cn(
                "relative h-10 shrink-0 whitespace-nowrap px-6 text-[12px] font-semibold transition-colors",
                "min-w-[140px] sm:min-w-[160px]",
                i === 0 ? CHEVRON_CLIP_FIRST : cn("-ml-[14px]", CHEVRON_CLIP),
                stageVariantClasses(stage, variant),
                !active && !busy && "hover:brightness-110",
                busy && "opacity-60",
              )}
            >
              {opportunityStageLabel(stage)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface NotesSectionProps {
  opportunityId: string;
  notes: OpportunityNoteRecord[];
}

function NotesSection({ opportunityId, notes }: NotesSectionProps) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await addOpportunityNoteAction({ opportunityId, body });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const sorted = React.useMemo(
    () => [...notes].sort((a, b) => b.createdAtMs - a.createdAtMs),
    [notes],
  );

  return (
    <Card className="border-border/80 bg-card/60">
      <CardHeader>
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base">Notes</CardTitle>
        </div>
        <CardDescription>Capture context, decisions, or follow-ups for this opportunity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-3" onSubmit={submit}>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a note for this opportunity…"
            rows={4}
            className="resize-y"
            disabled={busy}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={busy || !body.trim()} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
              Add note
            </Button>
          </div>
        </form>

        {sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
            No notes yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-border/60 bg-background/40 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <StickyNote className="h-3.5 w-3.5" aria-hidden />
                    Note
                  </span>
                  <time dateTime={new Date(n.createdAtMs).toISOString()}>
                    {new Date(n.createdAtMs).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface ActivitySectionProps {
  opportunityId: string;
  activities: OpportunityActivityRecord[];
}

function toLocalDateTimeInputValue(ms: number): string {
  const d = new Date(ms);
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function ActivitySection({ opportunityId, activities }: ActivitySectionProps) {
  const router = useRouter();
  const [kind, setKind] = React.useState<OpportunityActivityKind>("meeting");
  const [title, setTitle] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [occurredAt, setOccurredAt] = React.useState(() => toLocalDateTimeInputValue(Date.now()));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const occurredAtMs = occurredAt ? new Date(occurredAt).getTime() : undefined;
      const result = await addOpportunityActivityAction({
        opportunityId,
        kind,
        title,
        detail: detail.trim() ? detail : undefined,
        occurredAtMs:
          typeof occurredAtMs === "number" && Number.isFinite(occurredAtMs)
            ? occurredAtMs
            : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTitle("");
      setDetail("");
      setOccurredAt(toLocalDateTimeInputValue(Date.now()));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const sorted = React.useMemo(
    () => [...activities].sort((a, b) => b.occurredAtMs - a.occurredAtMs),
    [activities],
  );

  return (
    <Card className="border-border/80 bg-card/60">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base">Activity</CardTitle>
        </div>
        <CardDescription>
          Log meetings, phone calls, emails and other touchpoints with this contact.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-3" onSubmit={submit}>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            {ACTIVITY_KINDS.map(({ value, label, Icon }) => {
              const active = kind === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-muted/50",
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Discovery call with finance lead)"
              disabled={busy}
              maxLength={240}
            />
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              disabled={busy}
              aria-label="When"
            />
          </div>

          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Optional notes — what was discussed, next steps, links…"
            rows={3}
            className="resize-y"
            disabled={busy}
            maxLength={4000}
          />

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={busy || !title.trim()} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
              Log activity
            </Button>
          </div>
        </form>

        {sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
            No activity logged yet.
          </p>
        ) : (
          <ul className="space-y-0 border-l border-border/70 pl-6">
            {sorted.map((a) => {
              const meta = activityKindMeta(a.kind);
              const Icon = meta.Icon;
              return (
                <li key={a.id} className="relative mb-5 last:mb-0">
                  <span className="absolute -left-[27px] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground ring-2 ring-muted">
                    <Icon className="h-3 w-3" aria-hidden />
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium uppercase tracking-wide">{meta.label}</span>
                    <time dateTime={new Date(a.occurredAtMs).toISOString()}>
                      {new Date(a.occurredAtMs).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">{a.title}</p>
                  {a.detail ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.detail}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function OpportunityDetailView({
  opportunity,
  customer,
  notes,
  activities,
}: OpportunityDetailViewProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/opportunities">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Pipeline
          </Link>
        </Button>
      </div>

      <OpportunityStageProgress opportunity={opportunity} />

      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-6 shadow-sm backdrop-blur-sm md:p-8"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={WORKSPACE_DETAIL_PAGE_TITLE_CLASS}>{opportunity.name}</h1>
              <Badge variant="outline" className="font-normal">
                {opportunityStageLabel(opportunity.stage)}
              </Badge>
            </div>
            <div className={cn(WORKSPACE_PAGE_DESCRIPTION_STACK_CLASS, "flex flex-wrap items-center gap-x-3 gap-y-1")}>
              <Link href={`/admin/customers/${customer.id}`} className="font-medium text-primary hover:underline">
                {customer.name || customer.email}
              </Link>
              {customer.phone ? (
                <>
                  <span aria-hidden className="text-muted-foreground/60">·</span>
                  <a href={`tel:${customer.phone}`} className="hover:text-foreground hover:underline">
                    {customer.phone}
                  </a>
                </>
              ) : null}
              {customer.email ? (
                <>
                  <span aria-hidden className="text-muted-foreground/60">·</span>
                  <a href={`mailto:${customer.email}`} className="hover:text-foreground hover:underline">
                    {customer.email}
                  </a>
                </>
              ) : null}
            </div>
            {typeof opportunity.amountMinor === "number" ? (
              <p className="text-lg tabular-nums text-foreground">
                {(opportunity.amountMinor / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: opportunity.currency.toUpperCase(),
                })}
              </p>
            ) : null}
          </div>
        </div>
      </motion.header>

      {opportunity.notes?.trim() ? (
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardTitle className="text-base">Opportunity summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{opportunity.notes.trim()}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <NotesSection opportunityId={opportunity.id} notes={notes} />
        <ActivitySection opportunityId={opportunity.id} activities={activities} />
      </div>
    </div>
  );
}
