"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  KeyRound,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Users,
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
} from "@/server/actions/customers-crm";
import { deleteProposalAction } from "@/server/actions/proposal-builder";
import { createDraftProposalFromCustomerAction } from "@/server/actions/proposals-crm";
import { ConvertLeadPanel } from "@/components/portal/convert-lead-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatAddressLines, initialsFromName } from "@/lib/format";
import { WORKSPACE_DETAIL_PAGE_TITLE_CLASS } from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";

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
  const productNames = [...new Set(subs.map((s) => (s.productName ?? "").trim()).filter(Boolean))];
  if (productNames.length === 1) return `Subscription · ${productNames[0]}`;
  if (productNames.length > 1) return `Subscriptions · ${productNames.join(", ")}`;
  const statuses = [...new Set(subs.map((s) => s.status))];
  if (statuses.length === 1) return `Subscription · ${statuses[0]}`;
  return `Subscriptions · ${statuses.join(", ")}`;
}

type ProposalLifecyclePhase = "saved" | "sent" | "viewed";

/** Single phase for CRM proposal rows: viewed wins over sent over draft (saved). */
function proposalLifecyclePhase(p: ProposalRecord): ProposalLifecyclePhase {
  const viewed =
    p.status === "viewed" ||
    p.status === "accepted" ||
    p.status === "declined" ||
    (typeof p.viewCount === "number" && p.viewCount > 0) ||
    (typeof p.lastViewedAtMs === "number" && p.lastViewedAtMs > 0);
  if (viewed) return "viewed";
  if (p.status !== "draft") return "sent";
  return "saved";
}

const PROPOSAL_PHASE_BADGE_CLASS: Record<ProposalLifecyclePhase, string> = {
  saved: "border-slate-500/45 bg-slate-500/10 text-slate-800 dark:border-slate-500/35 dark:bg-slate-500/15 dark:text-slate-200",
  sent: "border-sky-500/45 bg-sky-500/10 text-sky-900 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-200",
  viewed:
    "border-emerald-500/45 bg-emerald-500/10 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200",
};

const PROPOSAL_PHASE_TITLE: Record<ProposalLifecyclePhase, string> = {
  saved: "Draft — saved to CRM, not published yet.",
  sent: "Published — public link is live; no recorded opens yet.",
  viewed: "Opened — recipient has viewed or acted on the public proposal.",
};

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
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      {proposalTemplates.length > 0 ? (
        <select
          className="min-w-[220px] rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          value={proposalTemplateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          disabled={busy}
          aria-label="Proposal template"
        >
          {proposalTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : null}
      <Button size="sm" className="gap-1.5 shadow-sm" disabled={busy} onClick={() => void onCreate()}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
        Add proposal
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
  const [proposalTemplateId, setProposalTemplateId] = React.useState(
    () => proposalTemplates[0]?.id ?? "",
  );
  const proposalTemplateIdsKey = proposalTemplates.map((t) => t.id).join(",");

  React.useEffect(() => {
    const list = proposalTemplates;
    if (list.length === 0) {
      setProposalTemplateId("");
      return;
    }
    setProposalTemplateId((prev) =>
      prev && list.some((t) => t.id === prev) ? prev : list[0].id,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when template *set* changes, not array identity
  }, [proposalTemplateIdsKey]);
  const [noteBody, setNoteBody] = React.useState("");
  const [noteKind, setNoteKind] = React.useState<CustomerNoteRecord["kind"]>("note");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [deletingProposalId, setDeletingProposalId] = React.useState<string | null>(null);

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

  async function createProposalFromCustomer() {
    setBusy("proposal");
    try {
      const res = await createDraftProposalFromCustomerAction(
        customer.id,
        proposalTemplateId.trim() ? proposalTemplateId.trim() : undefined,
      );
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.push(
        `/admin/proposals/${res.proposalId}?customer=${encodeURIComponent(customer.id)}`,
      );
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not create proposal. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteProposal(proposalId: string, title: string) {
    if (!window.confirm(`Delete proposal “${title}”? This cannot be undone.`)) return;
    setDeletingProposalId(proposalId);
    try {
      const res = await deleteProposalAction(proposalId);
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.refresh();
    } finally {
      setDeletingProposalId(null);
    }
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
  const addressLines = formatAddressLines({
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    region: customer.region,
    postalCode: customer.postalCode,
    country: customer.country,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/customers">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Customers
          </Link>
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5 shadow-sm" asChild>
          <Link href={`/admin/customers/${customer.id}/edit`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </Link>
        </Button>
      </div>

      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border/80 pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted ring-1 ring-border">
            {canImg && url ? (
              <Image src={url} alt="" width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground">
                {initialsFromName(customer.name)}
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <h1 className={cn("truncate", WORKSPACE_DETAIL_PAGE_TITLE_CLASS)}>{customer.name || customer.email}</h1>
            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>
      </motion.header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
              Contact details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</dt>
                <dd className="text-sm text-foreground">{customer.name || "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  Email
                </dt>
                <dd className="text-sm text-foreground">{customer.email}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Phone
                </dt>
                <dd className="text-sm text-foreground">{customer.phone || customer.companyPhone || "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" aria-hidden />
                  Company
                </dt>
                <dd className="text-sm text-foreground">{customer.company || "—"}</dd>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Address
                </dt>
                <dd className="text-sm text-foreground">
                  {addressLines.length > 0 ? (
                    <span className="whitespace-pre-line">{addressLines.join("\n")}</span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            {customer.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customer.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-xs font-medium text-foreground/90"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-sm">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Stripe</span>
                {customer.stripeCustomerId?.trim() ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    Linked
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not linked</Badge>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{rollupFromSubscriptions(subscriptions)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <TabsTrigger value="vault" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            Vault
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/80 bg-card/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Subscriptions</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{subscriptions.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Open invoices</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {invoices.filter((i) => i.status === "open" || i.status === "draft").length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Proposals</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{proposalsMatched.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Opportunities</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{opportunities.length}</CardTitle>
              </CardHeader>
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
                <ul className="relative space-y-8 border-l border-border/80 pl-6">
                  {timeline.map((item) => (
                    <li key={item.id} className="relative">
                      <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border border-border bg-background ring-2 ring-muted" />
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
                          {s.subscriptionEnd || s.currentPeriodEndMs
                            ? new Date(s.subscriptionEnd ?? s.currentPeriodEndMs ?? 0).toLocaleDateString()
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
                <p className="py-6 text-center text-sm text-muted-foreground">No invoices for this customer.</p>
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
              <CardTitle className="text-base">Add proposal</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-end">
              <ProposalCreateControls
                proposalTemplates={proposalTemplates}
                proposalTemplateId={proposalTemplateId}
                onTemplateChange={setProposalTemplateId}
                busy={busy === "proposal"}
                onCreate={() => void createProposalFromCustomer()}
              />
            </CardContent>
          </Card>
          {proposalsMatched.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-muted/20">
              <CardContent className="space-y-2 py-12 text-center text-sm text-muted-foreground">
                <p>No linked proposals yet.</p>
                <p>
                  Use <strong className="text-foreground/90">Add proposal</strong> above, or attach one when creating
                  from an opportunity.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {proposalsMatched.map((p) => {
                const phase = proposalLifecyclePhase(p);
                return (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3"
                >
                  <p className="min-w-0 font-medium text-foreground">{p.title}</p>
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                      <Badge
                        variant="outline"
                        title={PROPOSAL_PHASE_TITLE[phase]}
                        className={cn("text-xs font-medium capitalize", PROPOSAL_PHASE_BADGE_CLASS[phase])}
                      >
                        {phase === "saved" ? "Saved" : phase === "sent" ? "Sent" : "Viewed"}
                      </Badge>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:ml-auto">
                        <span className="inline-flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="text-foreground/90">
                            {typeof p.viewCount === "number" ? (
                              <>
                                <span className="font-medium tabular-nums text-foreground">{p.viewCount}</span>
                                {p.viewCount === 1 ? " open" : " opens"}
                              </>
                            ) : (
                              "Opens not recorded"
                            )}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="text-foreground/90">
                            {typeof p.totalEngagementSeconds === "number" ? (
                              <>
                                <span className="font-medium tabular-nums text-foreground">
                                  {Math.max(0, Math.round(p.totalEngagementSeconds / 60))}
                                </span>
                                {" min on page"}
                              </>
                            ) : (
                              "Engagement not recorded"
                            )}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deletingProposalId === p.id}
                        aria-label={`Delete proposal “${p.title}”`}
                        onClick={() => void deleteProposal(p.id, p.title)}
                      >
                        {deletingProposalId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <Link
                          href={`/admin/proposals/${p.id}?customer=${encodeURIComponent(customer.id)}`}
                          aria-label={`Edit proposal “${p.title}”`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                      {p.shareToken ? (
                        <Button variant="outline" size="icon" asChild>
                          <Link
                            href={`/p/${p.shareToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open public proposal preview"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <Card className="border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Add entry</CardTitle>
              <CardDescription>Internal notes, calls, or email logs - visible to your organisation.</CardDescription>
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
                File uploads and generated assets will appear here. For now, open invoices from Subscription & billing or
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

        <TabsContent value="vault">
          <Card className="border-dashed border-border/80 bg-muted/15">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground/50" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">
                Customer credentials for app development, integrations, hosting, and related access details will be
                stored here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
