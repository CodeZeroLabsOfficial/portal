"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Pencil,
  FileText,
  FolderOpen,
  Link2,
  ListChecks,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import type { CustomerActivityRecord, CustomerNoteRecord, CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type { InvoiceRecord } from "@/types/invoice";
import type { ProposalRecord } from "@/types/proposal";
import type { ProposalTemplateRecord } from "@/types/proposal-template";
import type { SubscriptionRecord } from "@/types/subscription";
import type { TaskRecord } from "@/types/task";
import {
  addCustomerNoteAction,
  archiveCustomerAction,
  linkStripeCustomerIdAction,
  pullStripeCustomerProfileAction,
} from "@/server/actions/customers-crm";
import { createDraftProposalFromCustomerAction } from "@/server/actions/proposals-crm";
import { ConvertLeadPanel } from "@/components/portal/convert-lead-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ""}${p[p.length - 1][0] ?? ""}`.toUpperCase();
}

function formatMinor(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

function rollupFromSubscriptions(subs: SubscriptionRecord[]): string {
  if (subs.length === 0) return "No active Stripe subscriptions";
  const statuses = [...new Set(subs.map((s) => s.status))];
  if (statuses.length === 1) return `Subscription · ${statuses[0]}`;
  return `Subscriptions · ${statuses.join(", ")}`;
}

function ProposalCreateControls({
  proposalTemplates,
  proposalTemplateId,
  onTemplateChange,
  busy,
  onCreate,
}: {
  proposalTemplates: ProposalTemplateRecord[];
  proposalTemplateId: string;
  onTemplateChange: (id: string) => void;
  busy: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {proposalTemplates.length > 0 ? (
        <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Template
          <select
            className="min-w-[160px] rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case text-foreground"
            value={proposalTemplateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            disabled={busy}
          >
            <option value="">Standard (auto-filled)</option>
            {proposalTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button size="sm" className="gap-1.5 shadow-sm" disabled={busy} onClick={() => void onCreate()}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
        Create proposal
      </Button>
      <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
        <Link href="/admin/proposals">
          <FileText className="mr-1 h-3.5 w-3.5" aria-hidden />
          Templates
        </Link>
      </Button>
    </div>
  );
}

export interface CustomerDetailViewProps {
  customer: CustomerRecord;
  subscriptions: SubscriptionRecord[];
  invoices: InvoiceRecord[];
  proposalsMatched: ProposalRecord[];
  opportunities: OpportunityRecord[];
  notes: CustomerNoteRecord[];
  activities: CustomerActivityRecord[];
  tasks: TaskRecord[];
  proposalTemplates: ProposalTemplateRecord[];
}

export function CustomerDetailView({
  customer,
  subscriptions,
  invoices,
  proposalsMatched,
  opportunities,
  notes,
  activities,
  tasks,
  proposalTemplates,
}: CustomerDetailViewProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState("overview");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [proposalTemplateId, setProposalTemplateId] = React.useState("");
  const [stripeInput, setStripeInput] = React.useState(customer.stripeCustomerId ?? "");

  React.useEffect(() => {
    setStripeInput(customer.stripeCustomerId ?? "");
  }, [customer.stripeCustomerId]);
  const [noteBody, setNoteBody] = React.useState("");
  const [noteKind, setNoteKind] = React.useState<CustomerNoteRecord["kind"]>("note");
  const [noteError, setNoteError] = React.useState<string | null>(null);

  const timeline = React.useMemo(() => {
    const merged: { id: string; at: number; label: string; sub: string; kind: "activity" | "note" }[] = [];
    for (const a of activities) {
      merged.push({
        id: `a-${a.id}`,
        at: a.createdAtMs,
        label: a.title,
        sub: a.detail ?? a.type,
        kind: "activity",
      });
    }
    for (const n of notes) {
      merged.push({
        id: `n-${n.id}`,
        at: n.createdAtMs,
        label: n.kind === "call" ? "Call" : n.kind === "email" ? "Email" : "Note",
        sub: n.body.slice(0, 200) + (n.body.length > 200 ? "…" : ""),
        kind: "note",
      });
    }
    return merged.sort((x, y) => y.at - x.at).slice(0, 24);
  }, [activities, notes]);

  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.ok && r.message) window.alert(r.message);
    else router.refresh();
  }

  async function createProposalFromCustomer() {
    setBusy("proposal");
    const res = await createDraftProposalFromCustomerAction(
      customer.id,
      proposalTemplateId.trim() ? proposalTemplateId.trim() : undefined,
    );
    setBusy(null);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.push(`/admin/proposals/${res.proposalId}`);
    router.refresh();
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    setNoteError(null);
    const res = await addCustomerNoteAction({
      customerId: customer.id,
      body: noteBody,
      kind: noteKind,
    });
    if (!res.ok) {
      setNoteError(res.message);
      return;
    }
    setNoteBody("");
    router.refresh();
  }

  const url = customer.avatarUrl?.trim();
  const canImg =
    url &&
    (url.includes("googleusercontent.com") || url.includes("firebasestorage.googleapis.com"));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/customers">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Customers
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border/80"
            disabled={busy === "archive"}
            onClick={() =>
              run("archive", () =>
                archiveCustomerAction(customer.id, customer.status !== "archived"),
              )
            }
          >
            {busy === "archive" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {customer.status === "archived" ? "Restore" : "Archive"}
          </Button>
          <ProposalCreateControls
            proposalTemplates={proposalTemplates}
            proposalTemplateId={proposalTemplateId}
            onTemplateChange={setProposalTemplateId}
            busy={busy === "proposal"}
            onCreate={() => void createProposalFromCustomer()}
          />
          <Button variant="secondary" size="sm" className="gap-1.5 shadow-sm" asChild>
            <Link href={`/admin/customers/${customer.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-6 shadow-sm backdrop-blur-sm md:p-8"
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted ring-1 ring-border">
              {canImg && url ? (
                <Image src={url} alt="" width={80} height={80} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                  {initials(customer.name)}
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  {customer.name || customer.email}
                </h1>
                {customer.status === "archived" ? (
                  <Badge variant="secondary">Archived</Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    Active
                  </Badge>
                )}
                {customer.crmType === "lead" ? (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                    Lead
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-sky-500/40 text-sky-700 dark:text-sky-300">
                    Contact
                  </Badge>
                )}
              </div>
              {customer.company ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  {customer.company}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  {customer.email}
                </span>
                {customer.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    {customer.phone}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customer.tags.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No tags</span>
                ) : (
                  customer.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-xs font-medium text-foreground/90"
                    >
                      {t}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="w-full shrink-0 space-y-3 md:w-72">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Integrations</p>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Firebase Auth</span>
                <span className={cn("font-medium", customer.portalUserId ? "text-emerald-600" : "text-muted-foreground")}>
                  {customer.portalUserId ? "Linked" : "—"}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {rollupFromSubscriptions(subscriptions)}
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Stripe customer id
              </label>
              <div className="flex gap-2">
                <Input
                  value={stripeInput}
                  onChange={(e) => setStripeInput(e.target.value)}
                  placeholder="cus_…"
                  className="h-9 font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy === "linkStripe"}
                  className="shrink-0"
                  onClick={() =>
                    run("linkStripe", () => linkStripeCustomerIdAction(customer.id, stripeInput))
                  }
                >
                  {busy === "linkStripe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                disabled={busy === "pullStripe" || !customer.stripeCustomerId}
                onClick={() => run("pullStripe", () => pullStripeCustomerProfileAction(customer.id))}
              >
                {busy === "pullStripe" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Sync fields from Stripe
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {customer.crmType === "lead" ? (
        <ConvertLeadPanel
          customerId={customer.id}
          defaultOpportunityName={customer.company?.trim() || `${customer.name || "Opportunity"}`.trim()}
        />
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="no-scrollbar h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto bg-muted/30 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Subscriptions & billing
          </TabsTrigger>
          <TabsTrigger value="proposals" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Proposals
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Notes & activity
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" />
            Tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/80 bg-card/60 shadow-sm backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription>Subscriptions</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{subscriptions.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/60 shadow-sm backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription>Open invoices</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {invoices.filter((i) => i.status === "open" || i.status === "draft").length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/60 shadow-sm backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription>Proposals (this contact)</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{proposalsMatched.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/60 shadow-sm backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription>Opportunities</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{opportunities.length}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {opportunities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None linked yet.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {opportunities.slice(0, 4).map((o) => (
                      <li key={o.id}>
                        <Link href={`/admin/opportunities/${o.id}`} className="text-primary hover:underline">
                          {o.name}
                        </Link>
                      </li>
                    ))}
                    {opportunities.length > 4 ? (
                      <li className="text-xs text-muted-foreground">+{opportunities.length - 4} more on Pipeline</li>
                    ) : null}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <Card className="border-border/80 bg-card/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Recent timeline</CardTitle>
              <CardDescription>Activity and notes, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="relative space-y-0 border-l border-border/80 pl-6">
                  {timeline.map((item) => (
                    <li key={item.id} className="mb-6 last:mb-0">
                      <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border border-border bg-background ring-2 ring-muted" />
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.sub}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          {!customer.stripeCustomerId ? (
            <p className="text-sm text-muted-foreground">
              Link a Stripe customer id above to hydrate subscriptions and invoices from your webhook mirrors.
            </p>
          ) : null}
          <Card className="border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {subscriptions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No subscription rows for this customer.</p>
              ) : (
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium">Product</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium">Renews</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => (
                      <tr key={s.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4">{s.productName ?? "—"}</td>
                        <td className="py-2 pr-4 capitalize">{s.status}</td>
                        <td className="py-2 text-muted-foreground">
                          {s.currentPeriodEndMs
                            ? new Date(s.currentPeriodEndMs).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {invoices.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No invoices for this Stripe customer.</p>
              ) : (
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 font-medium">Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4 capitalize">{inv.status}</td>
                        <td className="py-2 pr-4">{formatMinor(inv.amountDue, inv.currency)}</td>
                        <td className="py-2">
                          {inv.issuedAtMs ? new Date(inv.issuedAtMs).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Create and link</CardTitle>
              <CardDescription>
                New drafts are saved with this customer&apos;s id and email. They appear below once created.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <ProposalCreateControls
                proposalTemplates={proposalTemplates}
                proposalTemplateId={proposalTemplateId}
                onTemplateChange={setProposalTemplateId}
                busy={busy === "proposal"}
                onCreate={() => void createProposalFromCustomer()}
              />
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            List includes proposals with this CRM <span className="font-mono text-foreground/80">customerId</span>, or{" "}
            <span className="font-mono text-foreground/80">recipientEmail</span> matching this profile.
          </p>
          {proposalsMatched.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-muted/20">
              <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
                <p>No linked proposals yet.</p>
                <p>Use <strong className="text-foreground/90">Create proposal</strong> above, or attach one when creating from an opportunity.</p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {proposalsMatched.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{p.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">Status: {p.status}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/proposals/${p.id}`}>Admin detail</Link>
                    </Button>
                    {p.shareToken ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/p/${p.shareToken}`} target="_blank" rel="noopener noreferrer">
                          Public view
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <Card className="border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Add entry</CardTitle>
              <CardDescription>Internal notes, calls, or email logs — visible to your organisation.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitNote}>
                {noteError ? <p className="text-sm text-destructive">{noteError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {(["note", "call", "email"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNoteKind(k)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        noteKind === k
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="What happened?"
                  rows={4}
                  className="resize-y"
                />
                <Button type="submit" size="sm" disabled={!noteBody.trim()}>
                  Save to timeline
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {notes.length === 0 && activities.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nothing logged yet.</p>
              ) : (
                <ul className="space-y-4">
                  {[...notes]
                    .sort((a, b) => b.createdAtMs - a.createdAtMs)
                    .map((n) => (
                      <li key={n.id} className="rounded-xl border border-border/50 bg-background/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{n.kind}</span>
                          <time dateTime={new Date(n.createdAtMs).toISOString()}>
                            {new Date(n.createdAtMs).toLocaleString()}
                          </time>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="border-dashed border-border/80 bg-muted/15">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">
                File uploads and generated assets will appear here. For now, open invoices from the billing tab or
                attach PDFs in your storage workflow.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-muted/15">
              <CardContent className="py-14 text-center text-sm text-muted-foreground">
                No tasks with <span className="font-mono">customerId</span> set. Add tasks from your operational board
                with this customer linked.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-4 py-3"
                >
                  <span className="font-medium">{t.title}</span>
                  <span className="text-xs capitalize text-muted-foreground">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
