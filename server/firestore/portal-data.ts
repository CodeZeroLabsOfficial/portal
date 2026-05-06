import { unstable_noStore as noStore } from "next/cache";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import type { InvoiceRecord } from "@/types/invoice";
import type { PaymentRecord } from "@/types/payment";
import type { ProposalRecord } from "@/types/proposal";
import { parseProposalRecord } from "@/server/firestore/parse-proposal";
import type { SubscriptionRecord } from "@/types/subscription";
import type { SupportTicketRecord, SupportTicketUrgency } from "@/types/support-ticket";
import { parseTaskRecord } from "@/server/firestore/parse-task";
import type { TaskRecord } from "@/types/task";
import type { PortalUser } from "@/types/user";
import type { CustomerListRow } from "@/lib/customer-list";
import {
  getAccountDetailForKey,
  getAdminAccountListRows as loadCrmAccountListRows,
  getAdminCustomerListRows as loadCrmCustomerListRows,
} from "@/server/firestore/crm-customers";

export interface ActivityItem {
  id: string;
  type: "subscription" | "invoice" | "proposal";
  title: string;
  detail: string;
  timestampMs: number;
}

export interface DashboardData {
  activeSubscriptions: number;
  mrrMinorUnits: number;
  openProposals: number;
  conversionRatePercent: number;
  recentActivity: ActivityItem[];
}

export interface CustomerPortalData {
  subscriptions: SubscriptionRecord[];
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  proposals: ProposalRecord[];
}

export interface AdminPortalData {
  customers: PortalUser[];
  subscriptions: SubscriptionRecord[];
  proposals: ProposalRecord[];
  invoices: InvoiceRecord[];
  tasks: TaskRecord[];
  supportTickets: SupportTicketRecord[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getTimestampMs(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
  }
  return 0;
}

function parseSubscription(id: string, data: Record<string, unknown>): SubscriptionRecord {
  return {
    id,
    customerId: asString(data.customerId) ?? "",
    organizationId: asString(data.organizationId),
    status:
      data.status === "trialing" ||
      data.status === "past_due" ||
      data.status === "canceled" ||
      data.status === "incomplete" ||
      data.status === "incomplete_expired" ||
      data.status === "unpaid" ||
      data.status === "paused" ||
      data.status === "active"
        ? data.status
        : "active",
    priceId: asString(data.priceId),
    productName: asString(data.productName),
    currency: asString(data.currency) ?? "aud",
    interval: data.interval === "year" ? "year" : data.interval === "month" ? "month" : undefined,
    currentPeriodEndMs: asNumber(data.currentPeriodEndMs),
    cancelAtPeriodEnd: asBoolean(data.cancelAtPeriodEnd),
    mrrAmount: asNumber(data.mrrAmount),
    updatedAtMs: asNumber(data.updatedAtMs) ?? Date.now(),
  };
}

function parsePayment(id: string, data: Record<string, unknown>): PaymentRecord {
  return {
    id,
    stripePaymentIntentId: asString(data.stripePaymentIntentId) ?? id,
    customerId: asString(data.customerId) ?? "",
    organizationId: asString(data.organizationId),
    currency: asString(data.currency) ?? "aud",
    amount: asNumber(data.amount) ?? 0,
    status: asString(data.status) ?? "processing",
    description: asString(data.description),
    createdAtMs: asNumber(data.createdAtMs) ?? 0,
    updatedAtMs: asNumber(data.updatedAtMs) ?? Date.now(),
  };
}

function parseInvoice(id: string, data: Record<string, unknown>): InvoiceRecord {
  return {
    id,
    stripeInvoiceId: asString(data.stripeInvoiceId) ?? id,
    customerId: asString(data.customerId) ?? "",
    organizationId: asString(data.organizationId),
    status:
      data.status === "draft" ||
      data.status === "open" ||
      data.status === "paid" ||
      data.status === "void" ||
      data.status === "uncollectible"
        ? data.status
        : "open",
    currency: asString(data.currency) ?? "aud",
    amountDue: asNumber(data.amountDue) ?? 0,
    hostedInvoiceUrl: asString(data.hostedInvoiceUrl),
    invoicePdf: asString(data.invoicePdf),
    issuedAtMs: asNumber(data.issuedAtMs) ?? 0,
    paidAtMs: asNumber(data.paidAtMs),
  };
}

function parseProposal(id: string, data: Record<string, unknown>): ProposalRecord {
  return parseProposalRecord(id, data);
}

function parsePortalUser(id: string, data: Record<string, unknown>): PortalUser {
  const role = data.role === "admin" || data.role === "team" || data.role === "customer" ? data.role : "customer";
  return {
    uid: id,
    email: asString(data.email) ?? "",
    displayName: asString(data.displayName),
    photoURL: asString(data.photoURL),
    role,
    organizationId: asString(data.organizationId),
    stripeCustomerId: asString(data.stripeCustomerId),
    createdAtMs: asNumber(data.createdAtMs) ?? 0,
    updatedAtMs: asNumber(data.updatedAtMs) ?? 0,
  };
}

function canReadByOrganization(user: PortalUser): boolean {
  return user.role === "admin" || user.role === "team";
}

type AdminFirestore = NonNullable<ReturnType<typeof getFirebaseAdminFirestore>>;

/** `users/{uid}` with `role: "customer"` — same documents used for customer portal login. */
async function queryUsersInCustomerRole(user: PortalUser, db: AdminFirestore, limit: number) {
  let q = db.collection(COLLECTIONS.users).where("role", "==", "customer").limit(limit);
  if (user.organizationId) {
    q = q.where("organizationId", "==", user.organizationId);
  }
  return q.get();
}

/** CRM table rows from `customers` (single-tenant; all admin/team can list). */
export async function getAdminCustomerListRows(user: PortalUser): Promise<CustomerListRow[]> {
  /** Always read fresh Firestore data — avoids stale RSC / router cache after create or edits. */
  noStore();
  return loadCrmCustomerListRows(user);
}

/** Distinct company names from CRM customers (see `lib/account-list`). */
export async function getAdminAccountListRows(user: PortalUser) {
  noStore();
  return loadCrmAccountListRows(user);
}

export async function getAdminAccountDetail(user: PortalUser, accountKey: string) {
  noStore();
  return getAccountDetailForKey(user, accountKey);
}

async function listSubscriptionsForUser(user: PortalUser): Promise<SubscriptionRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db) {
    return [];
  }

  const col = db.collection(COLLECTIONS.subscriptions);

  let snap;
  if (canReadByOrganization(user) && user.organizationId) {
    snap = await col.where("organizationId", "==", user.organizationId).limit(100).get();
  } else if (user.stripeCustomerId) {
    snap = await col.where("customerId", "==", user.stripeCustomerId).limit(100).get();
  } else {
    snap = await col.limit(0).get();
  }

  return snap.docs.map((doc) => parseSubscription(doc.id, doc.data() as Record<string, unknown>));
}

async function listInvoicesForUser(user: PortalUser): Promise<InvoiceRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db) {
    return [];
  }

  const col = db.collection(COLLECTIONS.invoices);
  let snap;
  if (canReadByOrganization(user) && user.organizationId) {
    snap = await col.where("organizationId", "==", user.organizationId).limit(100).get();
  } else if (user.stripeCustomerId) {
    snap = await col.where("customerId", "==", user.stripeCustomerId).limit(100).get();
  } else {
    snap = await col.limit(0).get();
  }

  return snap.docs.map((doc) => parseInvoice(doc.id, doc.data() as Record<string, unknown>));
}

async function listPaymentsForUser(user: PortalUser): Promise<PaymentRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db) {
    return [];
  }

  const col = db.collection(COLLECTIONS.payments);
  let snap;
  if (canReadByOrganization(user) && user.organizationId) {
    snap = await col.where("organizationId", "==", user.organizationId).limit(100).get();
  } else if (user.stripeCustomerId) {
    snap = await col.where("customerId", "==", user.stripeCustomerId).limit(100).get();
  } else {
    snap = await col.limit(0).get();
  }

  return snap.docs.map((doc) => parsePayment(doc.id, doc.data() as Record<string, unknown>));
}

async function listProposalsForUser(user: PortalUser): Promise<ProposalRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db) {
    return [];
  }

  const col = db.collection(COLLECTIONS.proposals);
  let snap;
  if (canReadByOrganization(user) && user.organizationId) {
    snap = await col.where("organizationId", "==", user.organizationId).limit(100).get();
  } else {
    snap = await col.where("createdByUid", "==", user.uid).limit(100).get();
  }

  return snap.docs.map((doc) => parseProposal(doc.id, doc.data() as Record<string, unknown>));
}

function parseSupportTicket(id: string, data: Record<string, unknown>): SupportTicketRecord {
  const raw = (asString(data.urgency) ?? asString(data.priority) ?? "medium").toLowerCase();
  let urgency: SupportTicketUrgency = "medium";
  if (raw.includes("crit") || raw === "p0" || raw === "critical") {
    urgency = "critical";
  } else if (raw.includes("high") || raw === "p1" || raw === "high") {
    urgency = "high";
  } else if (raw.includes("low") || raw === "p3" || raw === "low") {
    urgency = "low";
  }

  return {
    id,
    organizationId: asString(data.organizationId),
    status: asString(data.status) ?? "open",
    urgency,
    updatedAtMs: asNumber(data.updatedAtMs) ?? Date.now(),
  };
}

async function listTasksForUser(user: PortalUser): Promise<TaskRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canReadByOrganization(user) || !user.organizationId) {
    return [];
  }
  try {
    const snap = await db
      .collection(COLLECTIONS.tasks)
      .where("organizationId", "==", user.organizationId)
      .limit(200)
      .get();
    return snap.docs.map((doc) => parseTaskRecord(doc.id, doc.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

async function listSupportTicketsForUser(user: PortalUser): Promise<SupportTicketRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canReadByOrganization(user) || !user.organizationId) {
    return [];
  }
  try {
    const snap = await db
      .collection(COLLECTIONS.supportTickets)
      .where("organizationId", "==", user.organizationId)
      .limit(200)
      .get();
    return snap.docs.map((doc) => parseSupportTicket(doc.id, doc.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getDashboardData(user: PortalUser): Promise<DashboardData> {
  const [subscriptions, invoices, proposals] = await Promise.all([
    listSubscriptionsForUser(user),
    listInvoicesForUser(user),
    listProposalsForUser(user),
  ]);

  const activeSubscriptions = subscriptions.filter(
    (item) => item.status === "active" || item.status === "trialing",
  ).length;
  const openProposals = proposals.filter(
    (item) => item.status === "draft" || item.status === "sent" || item.status === "viewed",
  ).length;
  const acceptedCount = proposals.filter((item) => item.status === "accepted").length;
  const closedCount = proposals.filter(
    (item) => item.status === "accepted" || item.status === "declined" || item.status === "expired",
  ).length;
  const conversionRatePercent = closedCount > 0 ? Math.round((acceptedCount / closedCount) * 100) : 0;

  const mrrMinorUnits = subscriptions.reduce((sum, item) => {
    const record = item as SubscriptionRecord & { mrrAmount?: number; amount?: number };
    return sum + (record.mrrAmount ?? record.amount ?? 0);
  }, 0);

  const activity: ActivityItem[] = [
    ...subscriptions.map((item) => ({
      id: `subscription-${item.id}`,
      type: "subscription" as const,
      title: item.productName ? `Subscription: ${item.productName}` : "Subscription updated",
      detail: `${item.status} · ${item.currency.toUpperCase()}`,
      timestampMs: item.updatedAtMs,
    })),
    ...invoices.map((item) => ({
      id: `invoice-${item.id}`,
      type: "invoice" as const,
      title: `Invoice ${item.status}`,
      detail: `${item.currency.toUpperCase()} ${Math.round(item.amountDue / 100)}`,
      timestampMs: item.paidAtMs ?? item.issuedAtMs,
    })),
    ...proposals.map((item) => ({
      id: `proposal-${item.id}`,
      type: "proposal" as const,
      title: item.title,
      detail: `Status: ${item.status}`,
      timestampMs: getTimestampMs(item as unknown as Record<string, unknown>, "updatedAtMs", "createdAtMs"),
    })),
  ]
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .slice(0, 8);

  return {
    activeSubscriptions,
    mrrMinorUnits,
    openProposals,
    conversionRatePercent,
    recentActivity: activity,
  };
}

export async function getCustomerPortalData(user: PortalUser): Promise<CustomerPortalData> {
  const [subscriptions, invoices, payments, proposals] = await Promise.all([
    listSubscriptionsForUser(user),
    listInvoicesForUser(user),
    listPaymentsForUser(user),
    listProposalsForUser(user),
  ]);

  return { subscriptions, invoices, payments, proposals };
}

export async function getAdminPortalData(user: PortalUser): Promise<AdminPortalData> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canReadByOrganization(user)) {
    return {
      customers: [],
      subscriptions: [],
      proposals: [],
      invoices: [],
      tasks: [],
      supportTickets: [],
    };
  }

  const usersSnap = await queryUsersInCustomerRole(user, db, 200);
  const customers = usersSnap.docs.map((doc) => parsePortalUser(doc.id, doc.data() as Record<string, unknown>));

  const [subscriptions, proposals, invoices, tasks, supportTickets] = await Promise.all([
    listSubscriptionsForUser(user),
    listProposalsForUser(user),
    listInvoicesForUser(user),
    listTasksForUser(user),
    listSupportTicketsForUser(user),
  ]);

  return {
    customers,
    subscriptions,
    proposals,
    invoices,
    tasks,
    supportTickets,
  };
}

/** Single proposal for admin proposal detail — uses full `document.blocks` parsing. */
export async function getAdminProposalRecord(
  user: PortalUser,
  proposalId: string,
): Promise<ProposalRecord | null> {
  noStore();
  const db = getFirebaseAdminFirestore();
  if (!db || !canReadByOrganization(user)) return null;
  try {
    const snap = await db.collection(COLLECTIONS.proposals).doc(proposalId).get();
    if (!snap.exists) return null;
    return parseProposal(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}
