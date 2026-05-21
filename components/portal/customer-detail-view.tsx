"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  RefreshCw,
  Eye,
  FileText,
  FolderOpen,
  KeyRound,
  ListChecks,
  Loader2,
  LogIn,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { CustomerActivityRecord, CustomerNoteRecord, CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type { InvoiceRecord } from "@/types/invoice";
import type { ProposalRecord } from "@/types/proposal";
import type { ProposalTemplateRecord } from "@/types/proposal-template";
import type { SignedAgreementRecord } from "@/types/signed-agreement";
import type { SubscriptionRecord } from "@/types/subscription";
import type { TaskRecord } from "@/types/task";
import {
  addCustomerNoteAction,
  enableCustomerPortalAccessAction,
  generatePortalPasswordResetLinkAction,
  getSignedAgreementModalPayloadAction,
  pullStripeCustomerProfileAction,
} from "@/server/actions/customers-crm";
import { deleteProposalAction } from "@/server/actions/proposal-builder";
import { createDraftProposalFromCustomerAction } from "@/server/actions/proposals-crm";
import { convertLeadToContactAction } from "@/server/actions/opportunities-crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listRowIconActionClassName } from "@/components/ui/list-row-icon-action";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { initialsFromName } from "@/lib/format";
import { ProposalStageBadge } from "@/components/portal/proposal-stage-badge";
import { CustomerContactDetailsCard } from "@/components/portal/customer-contact-details-card";
import { sanitizeProposalHtml } from "@/lib/sanitize-proposal-html";
import { WORKSPACE_DETAIL_PAGE_TITLE_CLASS } from "@/lib/workspace-page-typography";
import { cn } from "@/lib/utils";
import { AgreementPrintSignatureBlock } from "@/components/proposal/agreement-block-public";
import { printAgreementDocument, useAgreementPrintMode } from "@/hooks/use-agreement-print-mode";
import { useProposalTemplatePickerState } from "@/hooks/use-proposal-template-picker-state";

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

function customerStripeLastSyncedAt(
  customer: CustomerRecord,
  activities: CustomerActivityRecord[],
): number | null {
  if (customer.stripeSyncedAt && Number.isFinite(customer.stripeSyncedAt)) {
    return customer.stripeSyncedAt;
  }
  let latest = 0;
  for (const activity of activities) {
    if (activity.type === "stripe_sync" && activity.createdAt > latest) {
      latest = activity.createdAt;
    }
  }
  return latest > 0 ? latest : null;
}

const CUSTOMER_DETAIL_TAB_VALUES = [
  "overview",
  "billing",
  "proposals",
  "notes",
  "documents",
  "tasks",
  "vault",
] as const;
type CustomerDetailTab = (typeof CUSTOMER_DETAIL_TAB_VALUES)[number];

function isCustomerDetailTab(v: string | undefined): v is CustomerDetailTab {
  return Boolean(v && (CUSTOMER_DETAIL_TAB_VALUES as readonly string[]).includes(v));
}

const CUSTOMER_DETAIL_TAB_MIN_HEIGHT_CLASS = "min-h-[32rem]";

function CustomerTabEmptyState({
  icon: Icon,
  children,
  embedded = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  embedded?: boolean;
}) {
  const body = (
    <>
      <Icon className="h-10 w-10 text-muted-foreground/50" aria-hidden />
      <div className="max-w-sm space-y-2 text-sm text-muted-foreground">{children}</div>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col items-center gap-2 py-12 text-center">{body}</div>;
  }

  return (
    <Card className="border-dashed border-border/80 bg-muted/15">
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">{body}</CardContent>
    </Card>
  );
}

const workspaceGhostButtonClassName =
  "gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground";

function ProposalCreateControls({
  templates,
  proposalTemplateId,
  onTemplateChange,
  busy,
  onCreate,
}: {
  templates: ProposalTemplateRecord[];
  proposalTemplateId: string;
  onTemplateChange: (id: string) => void;
  busy: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      {templates.length > 0 ? (
        <select
          className="min-w-[220px] rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          value={proposalTemplateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          disabled={busy}
          aria-label="Template"
        >
          {templates.map((t) => (
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
  templates: ProposalTemplateRecord[];
  signedAgreements: SignedAgreementRecord[];
  /** When set (e.g. `?tab=documents`), opens that tab on first paint. */
  initialTab?: string;
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
  templates,
  signedAgreements,
  initialTab,
}: CustomerDetailViewProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<CustomerDetailTab>(() =>
    isCustomerDetailTab(initialTab) ? initialTab : "overview",
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const { proposalTemplateId, setProposalTemplateId } = useProposalTemplatePickerState(templates);
  const [noteBody, setNoteBody] = React.useState("");
  const [noteKind, setNoteKind] = React.useState<CustomerNoteRecord["kind"]>("note");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [deletingProposalId, setDeletingProposalId] = React.useState<string | null>(null);
  const [portalSetupLink, setPortalSetupLink] = React.useState<string | null>(null);
  const [portalPasswordLinkModalOpen, setPortalPasswordLinkModalOpen] = React.useState(false);
  const [portalSetupBusy, setPortalSetupBusy] = React.useState(false);
  const [enableAccessBusy, setEnableAccessBusy] = React.useState(false);
  const [portalSetupError, setPortalSetupError] = React.useState<string | null>(null);
  const [stripeIntegrationsBusy, setStripeIntegrationsBusy] = React.useState(false);
  const [stripeIntegrationsError, setStripeIntegrationsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPortalSetupLink(null);
    setPortalPasswordLinkModalOpen(false);
    setPortalSetupError(null);
    setPortalSetupBusy(false);
    setEnableAccessBusy(false);
    setStripeIntegrationsBusy(false);
    setStripeIntegrationsError(null);
  }, [customer.id]);

  function onPortalPasswordLinkModalOpenChange(open: boolean) {
    setPortalPasswordLinkModalOpen(open);
    if (!open) {
      setPortalSetupLink(null);
    }
  }

  const stripeLastSyncedAt = React.useMemo(
    () => customerStripeLastSyncedAt(customer, activities),
    [customer, activities],
  );

  const timeline = React.useMemo(() => {
    // Notes are also written to `customer_activities` (e.g. "Note added"); merging both sources
    // duplicated every note/call/email on this timeline.
    return activities
      .map((a) => ({
        id: `a-${a.id}`,
        at: a.createdAt,
        label: a.title,
        sub: a.detail ?? a.type,
      }))
      .sort((x, y) => y.at - x.at)
      .slice(0, 24);
  }, [activities]);

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

  async function convertLead() {
    setBusy("convert-lead");
    try {
      const res = await convertLeadToContactAction({ customerId: customer.id });
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      router.refresh();
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

  async function enablePortalAccess() {
    setPortalSetupError(null);
    setEnableAccessBusy(true);
    try {
      const res = await enableCustomerPortalAccessAction(customer.id);
      if (!res.ok) {
        setPortalSetupError(res.message);
        return;
      }
      router.refresh();
    } finally {
      setEnableAccessBusy(false);
    }
  }

  async function resyncStripeCustomer() {
    setStripeIntegrationsError(null);
    setStripeIntegrationsBusy(true);
    try {
      const res = await pullStripeCustomerProfileAction(customer.id);
      if (!res.ok) {
        setStripeIntegrationsError(res.message);
        return;
      }
      router.refresh();
    } finally {
      setStripeIntegrationsBusy(false);
    }
  }

  async function generatePortalPasswordSetupLink() {
    setPortalSetupError(null);
    setPortalSetupBusy(true);
    try {
      const res = await generatePortalPasswordResetLinkAction(customer.id);
      if (!res.ok) {
        setPortalSetupError(res.message);
        return;
      }
      setPortalSetupLink(res.link);
      setPortalPasswordLinkModalOpen(true);
    } finally {
      setPortalSetupBusy(false);
    }
  }

  const [signedAgreementModalOpen, setSignedAgreementModalOpen] = React.useState(false);
  const [signedAgreementLoadingId, setSignedAgreementLoadingId] = React.useState<string | null>(null);
  const [signedAgreementModalData, setSignedAgreementModalData] = React.useState<{
    record: SignedAgreementRecord;
    signatureSrc: string | null;
  } | null>(null);
  const signedAgreementSignRef = React.useRef<HTMLDivElement | null>(null);

  useAgreementPrintMode();

  async function openSignedAgreementModal(doc: SignedAgreementRecord) {
    setSignedAgreementLoadingId(doc.id);
    setSignedAgreementModalData(null);
    const res = await getSignedAgreementModalPayloadAction({
      customerId: customer.id,
      signedAgreementId: doc.id,
    });
    setSignedAgreementLoadingId(null);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    setSignedAgreementModalData({ record: res.record, signatureSrc: res.signatureSrc });
    setSignedAgreementModalOpen(true);
  }

  function onSignedAgreementModalOpenChange(next: boolean) {
    setSignedAgreementModalOpen(next);
    if (!next) {
      setSignedAgreementModalData(null);
    }
  }

  function printSignedAgreementModal() {
    const title = signedAgreementModalData?.record.proposalTitle?.trim() || "Services Agreement";
    printAgreementDocument({ documentTitle: title });
  }

  function scrollSignedAgreementModalToSignature() {
    signedAgreementSignRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const url = customer.avatarUrl?.trim();
  const canImg =
    url &&
    (url.includes("googleusercontent.com") || url.includes("firebasestorage.googleapis.com"));
  return (
    <>
      <div className="space-y-8">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
        <Link href="/admin/customers">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Customers
        </Link>
      </Button>

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
        <CustomerContactDetailsCard
          customer={customer}
          convertLeadBusy={busy === "convert-lead"}
          onConvertLead={() => void convertLead()}
        />

        <div className="flex flex-col gap-4">
          <Card className="border-border/80 bg-card/80 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden />
                Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Stripe</Label>
                  {customer.stripeCustomerId?.trim() ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                      Linked
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not linked</Badge>
                  )}
                </div>
                {stripeLastSyncedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Last synced{" "}
                    {new Date(stripeLastSyncedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                ) : !customer.stripeCustomerId?.trim() ? (
                  <p className="text-xs text-muted-foreground">
                    Link a Stripe customer id to sync subscriptions and invoices.
                  </p>
                ) : null}
              </div>
              {customer.stripeCustomerId?.trim() ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={workspaceGhostButtonClassName}
                    disabled={stripeIntegrationsBusy}
                    onClick={() =>
                      window.open(
                        `https://dashboard.stripe.com/customers/${customer.stripeCustomerId?.trim()}`,
                        "_blank",
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                    Open in Stripe
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={workspaceGhostButtonClassName}
                    disabled={stripeIntegrationsBusy}
                    onClick={() => void resyncStripeCustomer()}
                  >
                    {stripeIntegrationsBusy ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Resync Stripe
                  </Button>
                </div>
              ) : null}
              {stripeIntegrationsError ? <p className="text-sm text-destructive">{stripeIntegrationsError}</p> : null}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/80 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LogIn className="h-5 w-5 text-muted-foreground" aria-hidden />
                Portal access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>User Access</Label>
                {customer.portalUserId?.trim() ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    Linked
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not linked</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {customer.portalUserId?.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={workspaceGhostButtonClassName}
                    disabled={portalSetupBusy}
                    onClick={() => void generatePortalPasswordSetupLink()}
                  >
                    {portalSetupBusy ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Generate password link
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={workspaceGhostButtonClassName}
                    disabled={!customer.email?.trim() || enableAccessBusy}
                    title={!customer.email?.trim() ? "Add an email to this customer first." : undefined}
                    onClick={() => void enablePortalAccess()}
                  >
                    {enableAccessBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                    Link user
                  </Button>
                )}
              </div>
              {portalSetupError ? <p className="text-sm text-destructive">{portalSetupError}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(isCustomerDetailTab(v) ? v : "overview")} className="w-full">
        <TabsList className="no-scrollbar h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto bg-muted/30 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="proposals" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Proposals
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Notes
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

        <TabsContent value="overview" className={cn(CUSTOMER_DETAIL_TAB_MIN_HEIGHT_CLASS, "space-y-6")}>
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
                <CustomerTabEmptyState icon={Sparkles} embedded>
                  <p>No activity yet.</p>
                  <p>Notes, calls, emails, and Stripe syncs will show up here as they happen.</p>
                </CustomerTabEmptyState>
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

        <TabsContent value="billing" className={cn(CUSTOMER_DETAIL_TAB_MIN_HEIGHT_CLASS, "space-y-6")}>
          {!customer.stripeCustomerId ? (
            <p className="text-sm text-muted-foreground">
              Link a Stripe customer id under Integrations to hydrate subscriptions and invoices from your webhook
              mirrors.
            </p>
          ) : null}
          <Card className="border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {subscriptions.length === 0 ? (
                <CustomerTabEmptyState icon={CreditCard} embedded>
                  <p>No subscriptions for this customer yet.</p>
                  <p>Link a Stripe customer id under Integrations to sync subscription rows from your webhook mirrors.</p>
                </CustomerTabEmptyState>
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
                          {s.subscriptionEnd || s.currentPeriodEnd
                            ? new Date(s.subscriptionEnd ?? s.currentPeriodEnd ?? 0).toLocaleDateString()
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
                <CustomerTabEmptyState icon={FileText} embedded>
                  <p>No invoices for this customer yet.</p>
                  <p>Invoice rows appear here once Stripe billing activity is linked and synced.</p>
                </CustomerTabEmptyState>
              ) : (
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Issued</th>
                      <th className="py-2 font-medium">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4 capitalize">{inv.status}</td>
                        <td className="py-2 pr-4">{formatMinor(inv.amountDue, inv.currency)}</td>
                        <td className="py-2 pr-4">
                          {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2">
                          {inv.hostedInvoiceUrl || inv.invoicePdf ? (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {inv.hostedInvoiceUrl ? (
                                <Link
                                  href={inv.hostedInvoiceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  View
                                </Link>
                              ) : null}
                              {inv.invoicePdf ? (
                                <Link
                                  href={inv.invoicePdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                >
                                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  PDF
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals" className={cn(CUSTOMER_DETAIL_TAB_MIN_HEIGHT_CLASS, "space-y-4")}>
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Add proposal</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-end">
                <ProposalCreateControls
                templates={templates}
                proposalTemplateId={proposalTemplateId}
                onTemplateChange={setProposalTemplateId}
                busy={busy === "proposal"}
                onCreate={() => void createProposalFromCustomer()}
              />
            </CardContent>
          </Card>
          {proposalsMatched.length === 0 ? (
            <CustomerTabEmptyState icon={FileText}>
              <p>No linked proposals yet.</p>
              <p>
                Use <strong className="text-foreground/90">Add proposal</strong> above, or attach one when creating from
                an opportunity.
              </p>
            </CustomerTabEmptyState>
          ) : (
            <ul className="space-y-2">
              {proposalsMatched.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 font-medium text-foreground">{p.title}</p>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                      <ProposalStageBadge proposal={p} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          listRowIconActionClassName,
                          "hover:bg-destructive/10 hover:text-destructive",
                        )}
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
                      <Button variant="ghost" size="icon" className={listRowIconActionClassName} asChild>
                        <Link
                          href={`/admin/proposals/${p.id}?customer=${encodeURIComponent(customer.id)}`}
                          aria-label={`Edit proposal “${p.title}”`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                      {p.shareToken ? (
                        <Button variant="ghost" size="icon" className={listRowIconActionClassName} asChild>
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
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="notes" className={cn(CUSTOMER_DETAIL_TAB_MIN_HEIGHT_CLASS, "space-y-6")}>
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
                <CustomerTabEmptyState icon={MessageSquare} embedded>
                  <p>Nothing logged yet.</p>
                  <p>Saved entries appear in this timeline below the add form.</p>
                </CustomerTabEmptyState>
              ) : (
                <ul className="space-y-4">
                  {[...notes]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((n) => (
                      <li key={n.id} className="rounded-xl border border-border/50 bg-background/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{n.kind}</span>
                          <time dateTime={new Date(n.createdAt).toISOString()}>
                            {new Date(n.createdAt).toLocaleString()}
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

        <TabsContent value="documents" className={cn(CUSTOMER_DETAIL_TAB_MIN_HEIGHT_CLASS, "space-y-4")}>
          {signedAgreements.length === 0 ? (
            <CustomerTabEmptyState icon={FolderOpen}>
              <p>Signed Services Agreements will appear here when a customer completes signing on a linked proposal.</p>
            </CustomerTabEmptyState>
          ) : (
            <ul className="space-y-2">
              {signedAgreements.map((doc) => {
                const signedLabel =
                  doc.signedAt > 0
                    ? new Date(doc.signedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—";
                return (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 flex-1 font-medium text-foreground">{doc.proposalTitle}</p>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="text-foreground/90">{signedLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="text-foreground/90">{doc.signerName}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                        <Badge
                          variant="outline"
                          className="border-emerald-500/45 bg-emerald-500/10 text-xs font-medium text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200"
                        >
                          Signed
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {doc.totalAmount.formatted}/mo total · {doc.selectedPlan}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={signedAgreementLoadingId === doc.id}
                          aria-label={`View signed agreement “${doc.proposalTitle}”`}
                          onClick={() => void openSignedAgreementModal(doc)}
                        >
                          {signedAgreementLoadingId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="tasks" className={CUSTOMER_DETAIL_TAB_MIN_HEIGHT_CLASS}>
          {tasks.length === 0 ? (
            <CustomerTabEmptyState icon={ListChecks}>
              <p>No tasks linked to this customer yet.</p>
              <p>
                Add tasks from your operational board with <span className="font-mono">customerId</span> set to this
                customer.
              </p>
            </CustomerTabEmptyState>
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

        <TabsContent value="vault" className={CUSTOMER_DETAIL_TAB_MIN_HEIGHT_CLASS}>
          <CustomerTabEmptyState icon={KeyRound}>
            <p>
              Customer credentials for app development, integrations, hosting, and related access details will be stored
              here.
            </p>
          </CustomerTabEmptyState>
        </TabsContent>
      </Tabs>
      </div>

      <Dialog open={portalPasswordLinkModalOpen} onOpenChange={onPortalPasswordLinkModalOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password link</DialogTitle>
            <DialogDescription>
              Share through a secure channel. Anyone with the link can start the password flow for this login email.
            </DialogDescription>
          </DialogHeader>
          {portalSetupLink ? (
            <Textarea readOnly className="min-h-[5.5rem] resize-none font-mono text-xs" value={portalSetupLink} />
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={!portalSetupLink}
              onClick={() => {
                if (portalSetupLink) void navigator.clipboard.writeText(portalSetupLink);
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy link
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Done
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signedAgreementModalOpen} onOpenChange={onSignedAgreementModalOpenChange}>
        <DialogContent
          className={cn(
            "z-50 grid gap-0 overflow-hidden border-0 bg-white p-0 text-zinc-900 shadow-2xl",
            "h-[100dvh] w-screen max-w-none left-0 top-0 translate-x-0 translate-y-0 rounded-none",
            "sm:left-1/2 sm:top-1/2 sm:h-[min(96dvh,960px)] sm:max-h-[96dvh]",
            "sm:w-[min(1536px,calc(100vw-3rem))] sm:max-w-[min(1536px,calc(100vw-3rem))]",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            "print:static print:inset-auto print:h-auto print:max-h-none print:w-full print:max-w-none",
            "print:translate-x-0 print:translate-y-0 print:rounded-none print:shadow-none print:overflow-visible",
            "grid-rows-[auto,1fr] print:grid-rows-1",
            "[&>button[aria-label='Close']]:hidden",
          )}
        >
          {signedAgreementModalData ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6 print:hidden">
                <DialogTitle className="truncate text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
                  {signedAgreementModalData.record.proposalTitle}
                </DialogTitle>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={printSignedAgreementModal}
                    className="hidden h-9 gap-1.5 border-zinc-200 bg-white px-3 text-zinc-900 hover:bg-zinc-50 sm:inline-flex"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={scrollSignedAgreementModalToSignature}
                    className="h-9 gap-1.5 rounded-md px-3 font-semibold shadow-sm"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                  <DialogClose
                    aria-label="Close signed agreement"
                    className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </DialogClose>
                </div>
              </div>
              <div className="min-h-0 overflow-y-auto bg-white print:overflow-visible">
                <div
                  data-agreement-print-target=""
                  className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-10 sm:py-14"
                >
                  <header data-agreement-print-exclude="" className="text-center print:hidden">
                    <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-4xl">
                      Signed agreement
                    </h2>
                    <p className="mt-2 text-sm font-medium text-zinc-500">
                      Re:{" "}
                      <span className="text-zinc-900">{signedAgreementModalData.record.proposalTitle}</span>
                    </p>
                    <p className="mt-3 text-xs text-zinc-500">
                      Signed{" "}
                      {signedAgreementModalData.record.signedAt > 0
                        ? new Date(signedAgreementModalData.record.signedAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}{" "}
                      · Signer: {signedAgreementModalData.record.signerName}
                      {signedAgreementModalData.record.signerEmail ? (
                        <> · Email: {signedAgreementModalData.record.signerEmail}</>
                      ) : null}
                      {signedAgreementModalData.record.signerOrganization ? (
                        <> · Org: {signedAgreementModalData.record.signerOrganization}</>
                      ) : null}{" "}
                      · Monthly total:{" "}
                      {signedAgreementModalData.record.totalAmount.formatted}
                    </p>
                  </header>

                  <section className="mt-10">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Agreement</h3>
                    {(() => {
                      const rawBody = signedAgreementModalData.record.fullAgreementText?.trim() ?? "";
                      const bodyIsHtml = rawBody.includes("<");
                      if (!rawBody) {
                        return (
                          <p className="mt-3 text-sm text-zinc-500">No agreement text snapshot for this record.</p>
                        );
                      }
                      if (bodyIsHtml) {
                        return (
                          <div
                            className={cn(
                              "proposal-rich-text mt-4 max-w-none text-[15px] leading-relaxed text-zinc-700",
                              "[&_h1]:mt-8 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-zinc-900",
                              "[&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900",
                              "[&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900",
                              "[&_p]:mb-3 [&_p:last-child]:mb-0",
                              "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
                              "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
                            )}
                            dangerouslySetInnerHTML={{ __html: sanitizeProposalHtml(rawBody) }}
                          />
                        );
                      }
                      return (
                        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{rawBody}</div>
                      );
                    })()}
                  </section>

                  <AgreementPrintSignatureBlock
                    signatureSrc={signedAgreementModalData.signatureSrc}
                    signerName={signedAgreementModalData.record.signerName}
                    signedAt={signedAgreementModalData.record.signedAt}
                  />

                  <section
                    ref={signedAgreementSignRef}
                    id="customer-signed-agreement-signature"
                    className="mt-12 scroll-mt-24 print:hidden"
                  >
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Signature</h3>
                    {signedAgreementModalData.signatureSrc ? (
                      <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={signedAgreementModalData.signatureSrc}
                          alt={`Signature of ${signedAgreementModalData.record.signerName}`}
                          className="max-h-40 max-w-full object-contain object-left"
                        />
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-500">
                        No signature image on file (or it could not be loaded from storage).
                      </p>
                    )}
                    {signedAgreementModalData.record.signatureMethod ? (
                      <p className="mt-2 text-xs capitalize text-zinc-500">
                        Method: {signedAgreementModalData.record.signatureMethod}
                      </p>
                    ) : null}
                  </section>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
