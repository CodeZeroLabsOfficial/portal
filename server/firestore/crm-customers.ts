import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logError } from "@/lib/logging";
import { coerceTimestampToMillis } from "@/lib/firestore/timestamp";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import type { CustomerListRow } from "@/lib/customer-list";
import type { CreateCustomerInput } from "@/lib/schemas/customer";
import type { InvoiceRecord } from "@/types/invoice";
import type { ProposalRecord } from "@/types/proposal";
import type {
  CustomerActivityRecord,
  CustomerCrmType,
  CustomerNoteRecord,
  CustomerRecord,
  CustomerSubscriptionRollup,
} from "@/types/customer";
import { deleteOpportunitiesForCustomerDb } from "@/server/firestore/crm-opportunities";
import type { SubscriptionRecord } from "@/types/subscription";
import type { TaskRecord } from "@/types/task";
import type { PortalUser } from "@/types/user";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Single-tenant CRM: any admin/team member can manage customers (no `organizationId` gate). */
function canStaffAccessCrm(user: PortalUser): boolean {
  return user.role === "admin" || user.role === "team";
}

type AdminDb = NonNullable<ReturnType<typeof getFirebaseAdminFirestore>>;

function formatLocation(data: Pick<CustomerRecord, "city" | "region" | "country">): string {
  const parts = [data.city, data.region, data.country].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "";
}

function parseCustomerRecord(id: string, data: Record<string, unknown>): CustomerRecord | null {
  if (typeof data !== "object" || data === null) return null;
  const organizationId = asString(data.organizationId)?.trim();
  const name = asString(data.name) ?? "";
  const email = asString(data.email) ?? "";
  const tagsRaw = data.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((t): t is string => typeof t === "string" && t.length > 0).slice(0, 30)
    : [];
  const cfRaw = data.customFields;
  const customFields: Record<string, string> =
    cfRaw && typeof cfRaw === "object" && !Array.isArray(cfRaw)
      ? Object.fromEntries(
          Object.entries(cfRaw as Record<string, unknown>)
            .filter(([k, v]) => typeof k === "string" && typeof v === "string")
            .map(([k, v]) => [k, v as string]),
        )
      : {};
  const status = data.status === "archived" ? "archived" : "active";
  const crmType: CustomerCrmType = data.crmType === "lead" ? "lead" : "contact";
  return {
    id,
    ...(organizationId ? { organizationId } : {}),
    name,
    email,
    company: asString(data.company),
    phone: asString(data.phone),
    addressLine1: asString(data.addressLine1),
    addressLine2: asString(data.addressLine2),
    city: asString(data.city),
    region: asString(data.region),
    postalCode: asString(data.postalCode),
    country: asString(data.country),
    tags,
    customFields,
    portalUserId: asString(data.portalUserId),
    stripeCustomerId: asString(data.stripeCustomerId),
    avatarUrl: asString(data.avatarUrl),
    crmType,
    status,
    createdAtMs: coerceTimestampToMillis(data.createdAt ?? data.createdAtMs),
    updatedAtMs: coerceTimestampToMillis(data.updatedAt ?? data.updatedAtMs),
    createdByUid: asString(data.createdByUid),
  };
}

function rollupForStripeCustomer(
  stripeCustomerId: string | undefined,
  subscriptions: SubscriptionRecord[],
): CustomerSubscriptionRollup {
  if (!stripeCustomerId) return "none";
  const rel = subscriptions.filter((s) => s.customerId === stripeCustomerId);
  if (rel.length === 0) return "none";
  const statuses = new Set(rel.map((s) => s.status));
  if (statuses.size > 1) return "mixed";
  const only = [...statuses][0];
  if (
    only === "active" ||
    only === "trialing" ||
    only === "past_due" ||
    only === "canceled"
  ) {
    return only;
  }
  return "mixed";
}

function customerToListRow(
  customer: CustomerRecord,
  subscriptions: SubscriptionRecord[],
): CustomerListRow {
  const location = formatLocation(customer);
  return {
    id: customer.id,
    name: customer.name.trim() || customer.email.trim() || customer.id,
    email: customer.email.trim() || "—",
    phone: customer.phone?.trim() || "—",
    location: location.trim() || "—",
    gender: "—",
    avatarUrl: customer.avatarUrl,
    company: customer.company,
    tags: customer.tags,
    status: customer.status,
    subscriptionRollup: rollupForStripeCustomer(customer.stripeCustomerId, subscriptions),
    crmType: customer.crmType,
    portalUserId: customer.portalUserId,
    stripeCustomerId: customer.stripeCustomerId,
  };
}

async function listAllSubscriptionsForStaff(db: AdminDb): Promise<SubscriptionRecord[]> {
  const snap = await db.collection(COLLECTIONS.subscriptions).limit(200).get();
  return snap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      customerId: asString(data.customerId) ?? "",
      organizationId: asString(data.organizationId),
      status:
        data.status === "trialing" ||
        data.status === "past_due" ||
        data.status === "canceled" ||
        data.status === "incomplete" ||
        data.status === "incomplete_expired" ||
        data.status === "unpaid" ||
        data.status === "paused"
          ? data.status
          : "active",
      priceId: asString(data.priceId),
      productName: asString(data.productName),
      currency: asString(data.currency) ?? "aud",
      interval: data.interval === "year" ? "year" : data.interval === "month" ? "month" : undefined,
      currentPeriodEndMs: asNumber(data.currentPeriodEndMs),
      cancelAtPeriodEnd: typeof data.cancelAtPeriodEnd === "boolean" ? data.cancelAtPeriodEnd : undefined,
      updatedAtMs: asNumber(data.updatedAtMs) ?? Date.now(),
    } satisfies SubscriptionRecord;
  });
}

export async function getAdminCustomerListRows(user: PortalUser): Promise<CustomerListRow[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) {
    return [];
  }
  try {
    const [customerSnap, subscriptions] = await Promise.all([
      db.collection(COLLECTIONS.customers).limit(500).get(),
      listAllSubscriptionsForStaff(db),
    ]);
    const customers = customerSnap.docs
      .map((doc) => parseCustomerRecord(doc.id, doc.data() as Record<string, unknown>))
      .filter((c): c is CustomerRecord => c !== null)
      .sort((a, b) => (b.updatedAtMs || b.createdAtMs) - (a.updatedAtMs || a.createdAtMs));
    return customers.map((c) => customerToListRow(c, subscriptions));
  } catch (error) {
    logError("crm_list_customers_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function getCustomerRecordForOrg(
  user: PortalUser,
  customerId: string,
): Promise<CustomerRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return null;
  const ref = db.collection(COLLECTIONS.customers).doc(customerId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const parsed = parseCustomerRecord(snap.id, snap.data() as Record<string, unknown>);
  return parsed;
}

function parseNote(id: string, data: Record<string, unknown>): CustomerNoteRecord | null {
  const customerId = asString(data.customerId);
  if (!customerId) return null;
  const organizationId = asString(data.organizationId);
  const kind = data.kind === "call" || data.kind === "email" ? data.kind : "note";
  return {
    id,
    customerId,
    ...(organizationId ? { organizationId } : {}),
    authorUid: asString(data.authorUid) ?? "",
    body: asString(data.body) ?? "",
    kind,
    createdAtMs: coerceTimestampToMillis(data.createdAt ?? data.createdAtMs),
  };
}

function parseActivity(id: string, data: Record<string, unknown>): CustomerActivityRecord | null {
  const customerId = asString(data.customerId);
  if (!customerId) return null;
  const organizationId = asString(data.organizationId);
  const typeRaw = asString(data.type) ?? "other";
  const type =
    typeRaw === "created" ||
    typeRaw === "updated" ||
    typeRaw === "note" ||
    typeRaw === "stripe_sync" ||
    typeRaw === "auth_linked" ||
    typeRaw === "archived" ||
    typeRaw === "lead_converted" ||
    typeRaw === "opportunity_created"
      ? typeRaw
      : "other";
  return {
    id,
    customerId,
    ...(organizationId ? { organizationId } : {}),
    type,
    title: asString(data.title) ?? "Activity",
    detail: asString(data.detail),
    actorUid: asString(data.actorUid),
    createdAtMs: coerceTimestampToMillis(data.createdAt ?? data.createdAtMs),
  };
}

export async function listCustomerNotes(
  user: PortalUser,
  customerId: string,
  limit = 80,
): Promise<CustomerNoteRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return [];
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.customerNotes)
      .where("customerId", "==", customerId)
      .limit(limit)
      .get();
    const rows = snap.docs
      .map((d) => parseNote(d.id, d.data() as Record<string, unknown>))
      .filter((n): n is CustomerNoteRecord => n !== null);
    return rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch {
    return [];
  }
}

export async function listCustomerActivities(
  user: PortalUser,
  customerId: string,
  limit = 80,
): Promise<CustomerActivityRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return [];
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.customerActivities)
      .where("customerId", "==", customerId)
      .limit(limit)
      .get();
    const rows = snap.docs
      .map((d) => parseActivity(d.id, d.data() as Record<string, unknown>))
      .filter((a): a is CustomerActivityRecord => a !== null);
    return rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch {
    return [];
  }
}

function parseInvoice(id: string, data: Record<string, unknown>): InvoiceRecord {
  return {
    id,
    stripeInvoiceId: asString(data.stripeInvoiceId) ?? id,
    customerId: asString(data.customerId) ?? "",
    organizationId: asString(data.organizationId),
    status:
      data.status === "draft" ||
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

export async function listInvoicesForStripeCustomer(
  user: PortalUser,
  stripeCustomerId: string | undefined,
): Promise<InvoiceRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user) || !stripeCustomerId) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.invoices)
      .where("customerId", "==", stripeCustomerId)
      .limit(50)
      .get();
    return snap.docs.map((d) => parseInvoice(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function listSubscriptionsForStripeCustomer(
  user: PortalUser,
  stripeCustomerId: string | undefined,
): Promise<SubscriptionRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user) || !stripeCustomerId) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.subscriptions)
      .where("customerId", "==", stripeCustomerId)
      .limit(50)
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        customerId: asString(data.customerId) ?? "",
        organizationId: asString(data.organizationId),
        status:
          data.status === "trialing" ||
          data.status === "past_due" ||
          data.status === "canceled" ||
          data.status === "incomplete" ||
          data.status === "incomplete_expired" ||
          data.status === "unpaid" ||
          data.status === "paused"
            ? data.status
            : "active",
        priceId: asString(data.priceId),
        productName: asString(data.productName),
        currency: asString(data.currency) ?? "aud",
        interval: data.interval === "year" ? "year" : data.interval === "month" ? "month" : undefined,
        currentPeriodEndMs: asNumber(data.currentPeriodEndMs),
        cancelAtPeriodEnd: typeof data.cancelAtPeriodEnd === "boolean" ? data.cancelAtPeriodEnd : undefined,
        updatedAtMs: asNumber(data.updatedAtMs) ?? Date.now(),
      } satisfies SubscriptionRecord;
    });
  } catch {
    return [];
  }
}

export async function listProposalsForOrganization(user: PortalUser): Promise<ProposalRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return [];
  try {
    const snap = await db.collection(COLLECTIONS.proposals).limit(100).get();
    return snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const statusCandidate = data.status;
      const status =
        statusCandidate === "draft" ||
        statusCandidate === "viewed" ||
        statusCandidate === "accepted" ||
        statusCandidate === "declined" ||
        statusCandidate === "expired"
          ? statusCandidate
          : "sent";
      return {
        id: doc.id,
        organizationId: asString(data.organizationId) ?? "",
        createdByUid: asString(data.createdByUid) ?? "",
        title: asString(data.title) ?? "Untitled proposal",
        customerId: asString(data.customerId),
        opportunityId: asString(data.opportunityId),
        recipientEmail: asString(data.recipientEmail) ?? asString(data.customerEmail),
        status,
        shareToken: asString(data.shareToken) ?? "",
        document: {
          title: asString(data.title) ?? "Untitled proposal",
          blocks: [],
        },
        createdAtMs: asNumber(data.createdAtMs) ?? 0,
        updatedAtMs: asNumber(data.updatedAtMs) ?? 0,
      } satisfies ProposalRecord;
    });
  } catch {
    return [];
  }
}

function parseTask(id: string, data: Record<string, unknown>): TaskRecord {
  return {
    id,
    organizationId: asString(data.organizationId),
    customerId: asString(data.customerId),
    title: asString(data.title) ?? "Task",
    status: asString(data.status) ?? "open",
    dueAtMs: asNumber(data.dueAtMs),
    updatedAtMs: asNumber(data.updatedAtMs) ?? Date.now(),
  };
}

export async function listTasksForCustomer(user: PortalUser, customerId: string): Promise<TaskRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.tasks)
      .where("customerId", "==", customerId)
      .limit(80)
      .get();
    return snap.docs.map((d) => parseTask(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

export interface CreateCustomerResult {
  ok: true;
  customerId: string;
}

export interface CreateCustomerError {
  ok: false;
  message: string;
}

export async function createCustomerDocument(
  user: PortalUser,
  input: CreateCustomerInput,
): Promise<CreateCustomerResult | CreateCustomerError> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) {
    return { ok: false, message: "CRM is only available to admin or team members." };
  }
  const customFields: Record<string, string> = {};
  for (const pair of input.customFields ?? []) {
    if (pair.key.trim()) customFields[pair.key.trim()] = pair.value ?? "";
  }

  let portalUserId: string | undefined;
  if (input.linkAuthByEmail) {
    const auth = getFirebaseAdminAuth();
    if (auth) {
      try {
        const existing = await auth.getUserByEmail(input.email.trim().toLowerCase());
        portalUserId = existing.uid;
      } catch {
        portalUserId = undefined;
      }
    }
  }

  const col = db.collection(COLLECTIONS.customers);
  const docRef = col.doc();
  const payload = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company?.trim() || null,
    phone: input.phone?.trim() || null,
    addressLine1: input.addressLine1?.trim() || null,
    addressLine2: input.addressLine2?.trim() || null,
    city: input.city?.trim() || null,
    region: input.region?.trim() || null,
    postalCode: input.postalCode?.trim() || null,
    country: input.country?.trim() || null,
    tags: input.tags ?? [],
    customFields,
    portalUserId: portalUserId ?? null,
    stripeCustomerId: null,
    avatarUrl: null,
    status: "active",
    crmType: input.saveAsLead ? "lead" : "contact",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByUid: user.uid,
  };

  await docRef.set(payload);

  const firstActivityAt = Timestamp.now();
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId: docRef.id,
    type: "created",
    title: "Customer created",
    detail: input.name.trim(),
    actorUid: user.uid,
    createdAt: firstActivityAt,
  });

  if (portalUserId) {
    await db.collection(COLLECTIONS.customerActivities).add({
      customerId: docRef.id,
      type: "auth_linked",
      title: "Linked Firebase Auth user",
      detail: input.email.trim().toLowerCase(),
      actorUid: user.uid,
      createdAt: Timestamp.fromMillis(firstActivityAt.toMillis() + 1),
    });
  }

  return { ok: true, customerId: docRef.id };
}

export async function appendCustomerNote(
  user: PortalUser,
  customerId: string,
  body: string,
  kind: CustomerNoteRecord["kind"],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) {
    return { ok: false, message: "Not allowed." };
  }
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return { ok: false, message: "Customer not found." };
  const noteAt = Timestamp.now();
  await db.collection(COLLECTIONS.customerNotes).add({
    customerId,
    authorUid: user.uid,
    body: body.trim(),
    kind,
    createdAt: noteAt,
  });
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId,
    type: "note",
    title: kind === "call" ? "Call logged" : kind === "email" ? "Email logged" : "Note added",
    detail: body.trim().slice(0, 280),
    actorUid: user.uid,
    createdAt: Timestamp.fromMillis(noteAt.toMillis() + 1),
  });
  return { ok: true };
}

export async function setCustomerArchived(
  user: PortalUser,
  customerId: string,
  archived: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return { ok: false, message: "Not allowed." };
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return { ok: false, message: "Customer not found." };
  await db.collection(COLLECTIONS.customers).doc(customerId).update({
    status: archived ? "archived" : "active",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId,
    type: "archived",
    title: archived ? "Archived" : "Restored",
    actorUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
}

export async function deleteCustomerDocument(
  user: PortalUser,
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return { ok: false, message: "Not allowed." };
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return { ok: false, message: "Customer not found." };

  const database = db;

  async function deleteQueryDocs(collection: string): Promise<void> {
    const snap = await database.collection(collection).where("customerId", "==", customerId).limit(400).get();
    if (snap.empty) return;
    const batch = database.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    if (snap.size >= 400) await deleteQueryDocs(collection);
  }

  await deleteQueryDocs(COLLECTIONS.customerNotes);
  await deleteQueryDocs(COLLECTIONS.customerActivities);
  await deleteOpportunitiesForCustomerDb(database, customerId);
  await database.collection(COLLECTIONS.customers).doc(customerId).delete();
  return { ok: true };
}

export async function syncStripeCustomerBasics(
  user: PortalUser,
  customerId: string,
  stripeCustomerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return { ok: false, message: "Not allowed." };
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return { ok: false, message: "Customer not found." };
  await db
    .collection(COLLECTIONS.customers)
    .doc(customerId)
    .update({ stripeCustomerId, updatedAt: FieldValue.serverTimestamp() });
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId,
    type: "stripe_sync",
    title: "Stripe customer linked",
    detail: stripeCustomerId,
    actorUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
}
