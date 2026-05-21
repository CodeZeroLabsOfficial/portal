import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { isStaff } from "@/lib/auth/server-session";
import { asNumber, asString, asStringStringMap } from "@/lib/firestore/coerce";
import { logError } from "@/lib/logging";
import { coerceTimestampToMillis, millisFromFirestore } from "@/lib/firestore/timestamp";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { resolveOrCreateFirebaseUserByEmail } from "@/server/auth/resolve-or-create-firebase-user";
import { getStripe } from "@/lib/stripe/server";
import { accountKeyToNormalizedCompany, companyNameToAccountKey } from "@/lib/account-key";
import { normalizeAddressFields } from "@/lib/format";
import type { AccountListRow } from "@/lib/account-list";
import type { CustomerListRow } from "@/lib/customer-list";
import type { CreateAccountFormInput, UpdateAccountFormInput } from "@/lib/schemas/account";
import type { CreateCustomerInput, UpdateCustomerFormInput } from "@/lib/schemas/customer";
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
import { syncStripeCustomerIdFromCrmCustomerDoc } from "@/server/firestore/sync-portal-user-stripe";
import { deleteMirroredStripeCustomer } from "@/server/stripe/delete-stripe-customer-for-crm";
import { ensureStripeCustomer } from "@/server/stripe/proposal-billing";
import { parseProposalRecord } from "@/server/firestore/parse-proposal";
import { parseSignedAgreementRecord } from "@/server/firestore/parse-signed-agreement";
import { parseTaskRecord } from "@/server/firestore/parse-task";
import type { SubscriptionRecord, SubscriptionStatus } from "@/types/subscription";
import type { TaskRecord } from "@/types/task";
import type { PortalUser } from "@/types/user";
import type { SignedAgreementRecord } from "@/types/signed-agreement";

type AdminDb = NonNullable<ReturnType<typeof getFirebaseAdminFirestore>>;

function formatLocation(data: Pick<CustomerRecord, "city" | "region" | "country">): string {
  const parts = [data.city, data.region, data.country].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "";
}

function formatCompanyLocation(
  data: Pick<CustomerRecord, "companyCity" | "companyRegion" | "companyCountry">,
): string {
  const parts = [data.companyCity, data.companyRegion, data.companyCountry].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "";
}

function companyAddressSummary(c: CustomerRecord): string {
  const street = [c.companyAddressLine1, c.companyAddressLine2].filter(Boolean).join(", ");
  const loc = formatCompanyLocation(c);
  const pc = c.companyPostalCode?.trim();
  const chunks = [street, [pc, loc].filter(Boolean).join(" ").trim()].filter(Boolean);
  return chunks.join(" · ") || "—";
}

/**
 * Pre-sort a customer group newest→oldest so callers can scan once instead of
 * re-sorting per field (`pickLatestNonEmpty` was previously sorting 6+ times
 * per group in `getAdminAccountListRows` / `getAccountDetailForKey`).
 */
function sortGroupNewestFirst(customers: CustomerRecord[]): CustomerRecord[] {
  return [...customers].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function pickLatestNonEmpty(
  sortedNewestFirst: CustomerRecord[],
  pick: (row: CustomerRecord) => string | undefined,
): string {
  for (const row of sortedNewestFirst) {
    const v = pick(row)?.trim();
    if (v) return v;
  }
  return "";
}

function displayCompanyNameForGroup(sortedNewestFirst: CustomerRecord[]): string {
  const raw = sortedNewestFirst[0]?.company?.trim();
  return raw || "—";
}

function pickPrimaryContact(group: CustomerRecord[]): {
  contactName: string;
  contactId?: string;
  additionalContactCount: number;
} {
  const realContacts = sortGroupNewestFirst(group.filter((r) => !r.accountOnly));
  const active = realContacts.filter((r) => r.status === "active");
  const pool = active.length > 0 ? active : realContacts;
  const primary = pool[0];
  if (!primary) {
    return { contactName: "", additionalContactCount: 0 };
  }
  return {
    contactName: primary.name.trim(),
    contactId: primary.id,
    additionalContactCount: Math.max(0, pool.length - 1),
  };
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
  const customFields = asStringStringMap(data.customFields);
  const status = data.status === "archived" ? "archived" : "active";
  const crmType: CustomerCrmType = data.crmType === "lead" ? "lead" : "contact";
  const accountOnly = data.accountOnly === true;
  const contactAddress = normalizeAddressFields({
    addressLine1: asString(data.addressLine1),
    addressLine2: asString(data.addressLine2),
    city: asString(data.city),
    region: asString(data.region),
    postalCode: asString(data.postalCode),
    country: asString(data.country),
  });
  return {
    id,
    ...(organizationId ? { organizationId } : {}),
    ...(accountOnly ? { accountOnly: true } : {}),
    name,
    email,
    company: asString(data.company),
    companyPhone: asString(data.companyPhone),
    companyEmail: asString(data.companyEmail),
    companyWebsite: asString(data.companyWebsite),
    companyAbn: asString(data.companyAbn),
    companyAcn: asString(data.companyAcn),
    companyAddressLine1: asString(data.companyAddressLine1),
    companyAddressLine2: asString(data.companyAddressLine2),
    companyCity: asString(data.companyCity),
    companyRegion: asString(data.companyRegion),
    companyPostalCode: asString(data.companyPostalCode),
    companyCountry: asString(data.companyCountry),
    phone: asString(data.phone),
    addressLine1: contactAddress.addressLine1 || undefined,
    addressLine2: contactAddress.addressLine2 || undefined,
    city: contactAddress.city || undefined,
    region: contactAddress.region || undefined,
    postalCode: contactAddress.postalCode || undefined,
    country: contactAddress.country || undefined,
    tags,
    customFields,
    portalUserId: asString(data.portalUserId),
    stripeCustomerId: asString(data.stripeCustomerId),
    ...(typeof data.stripeSyncedAt === "number" && Number.isFinite(data.stripeSyncedAt)
      ? { stripeSyncedAt: data.stripeSyncedAt }
      : millisFromFirestore(data, "stripeSyncedAt") > 0
        ? { stripeSyncedAt: millisFromFirestore(data, "stripeSyncedAt") }
        : {}),
    avatarUrl: asString(data.avatarUrl),
    crmType,
    status,
    createdAt: coerceTimestampToMillis(data.createdAt),
    updatedAt: coerceTimestampToMillis(data.updatedAt),
    createdByUid: asString(data.createdByUid),
  };
}

/** When a customer has multiple subscriptions, show the most actionable status first. */
const SUBSCRIPTION_ROLLUP_PRIORITY: SubscriptionStatus[] = [
  "past_due",
  "unpaid",
  "incomplete",
  "active",
  "trialing",
  "scheduled",
  "paused",
  "canceled",
  "incomplete_expired",
];

function rollupForStripeCustomer(
  stripeCustomerId: string | undefined,
  subscriptions: SubscriptionRecord[],
): CustomerSubscriptionRollup {
  if (!stripeCustomerId) return "none";
  const rel = subscriptions.filter((s) => s.customerId === stripeCustomerId);
  if (rel.length === 0) return "none";

  const statuses = new Set(rel.map((s) => s.status));
  if (statuses.size === 1) return [...statuses][0]!;

  for (const status of SUBSCRIPTION_ROLLUP_PRIORITY) {
    if (statuses.has(status)) return status;
  }
  return "active";
}

function customerToListRow(
  customer: CustomerRecord,
  subscriptions: SubscriptionRecord[],
): CustomerListRow {
  const location = formatLocation(customer);
  const company = customer.company?.trim() || undefined;
  const accountKey = company ? companyNameToAccountKey(company) || undefined : undefined;
  return {
    id: customer.id,
    name: customer.name.trim() || customer.email.trim() || customer.id,
    email: customer.email.trim() || "—",
    phone: customer.phone?.trim() || "—",
    location: location.trim() || "—",
    avatarUrl: customer.avatarUrl,
    company,
    accountKey,
    tags: customer.tags,
    status: customer.status,
    subscriptionRollup: rollupForStripeCustomer(customer.stripeCustomerId, subscriptions),
    crmType: customer.crmType,
    portalUserId: customer.portalUserId,
    stripeCustomerId: customer.stripeCustomerId,
  };
}

function parseSubscriptionFirestore(id: string, data: Record<string, unknown>): SubscriptionRecord {
  return {
    id,
    customerId: asString(data.customerId) ?? "",
    organizationId: asString(data.organizationId),
    status:
      data.status === "scheduled" ||
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
    subscriptionStart: asNumber(data.subscriptionStart),
    subscriptionEnd: asNumber(data.subscriptionEnd),
    currentPeriodEnd: asNumber(data.currentPeriodEnd),
    cancelAtPeriodEnd: typeof data.cancelAtPeriodEnd === "boolean" ? data.cancelAtPeriodEnd : undefined,
    paymentCollectionPaused:
      typeof data.paymentCollectionPaused === "boolean" ? data.paymentCollectionPaused : undefined,
    monthlyAmountMinor: asNumber(data.monthlyAmountMinor),
    ...(millisFromFirestore(data, "createdAt") > 0
      ? { createdAt: millisFromFirestore(data, "createdAt") }
      : {}),
    collectionMethod:
      data.collectionMethod === "charge_automatically" || data.collectionMethod === "send_invoice"
        ? data.collectionMethod
        : undefined,
    defaultPaymentMethodType: asString(data.defaultPaymentMethodType),
    mrrAmount: asNumber(data.mrrAmount),
    updatedAt: millisFromFirestore(data, "updatedAt") || Date.now(),
  };
}

/** Top-level Stripe subscription mirrors — same source as the admin subscriptions directory. */
export async function listAllSubscriptionsForStaff(db: AdminDb): Promise<SubscriptionRecord[]> {
  const snap = await db.collection(COLLECTIONS.subscriptions).limit(500).get();
  return snap.docs.map((doc) => parseSubscriptionFirestore(doc.id, doc.data() as Record<string, unknown>));
}

/** Resolved CRM profile for a mirrored Stripe Customer id (`cus_…`). */
export interface StripeCustomerLink {
  customerId: string;
  label: string;
  /** Company name when set, else contact name / email — for subscription directory column. */
  accountName: string;
}

export interface AdminSubscriptionsSnapshot {
  subscriptions: SubscriptionRecord[];
  stripeCustomerLinks: Record<string, StripeCustomerLink>;
}

/** Mirrored Stripe subscriptions with CRM links for the admin subscriptions view. */
export async function getAdminSubscriptionsSnapshot(
  user: PortalUser,
): Promise<AdminSubscriptionsSnapshot | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return null;
  }
  try {
    const customers = await listCustomerRecordsForStaffSorted(user);
    if (!customers) return null;

    const stripeCustomerLinks: Record<string, StripeCustomerLink> = {};
    for (const c of customers) {
      const sid = c.stripeCustomerId?.trim();
      if (!sid || stripeCustomerLinks[sid]) continue;
      const label = [c.name?.trim(), c.company?.trim()].filter(Boolean).join(" · ") || c.email?.trim() || c.id;
      const accountName = c.company?.trim() || c.name?.trim() || c.email?.trim() || "—";
      stripeCustomerLinks[sid] = {
        customerId: c.id,
        label: label.slice(0, 160),
        accountName: accountName.slice(0, 160),
      };
    }

    const subscriptions = await listAllSubscriptionsForStaff(db);
    subscriptions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    return { subscriptions, stripeCustomerLinks };
  } catch (error) {
    logError("admin_subscriptions_snapshot_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/** All CRM customer documents for staff dashboards and directory rollups. */
export async function listCrmCustomerRecordsForStaff(user: PortalUser): Promise<CustomerRecord[]> {
  const rows = await listCustomerRecordsForStaffSorted(user);
  return rows ?? [];
}

async function listCustomerRecordsForStaffSorted(
  user: PortalUser,
): Promise<CustomerRecord[] | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return null;
  }
  try {
    const customerSnap = await db.collection(COLLECTIONS.customers).limit(500).get();
    return customerSnap.docs
      .map((doc) => parseCustomerRecord(doc.id, doc.data() as Record<string, unknown>))
      .filter((c): c is CustomerRecord => c !== null)
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  } catch (error) {
    logError("crm_list_customers_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function getAdminCustomerListRows(user: PortalUser): Promise<CustomerListRow[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return [];
  }
  try {
    const [customers, subscriptions] = await Promise.all([
      listCustomerRecordsForStaffSorted(user),
      listAllSubscriptionsForStaff(db),
    ]);
    if (!customers) return [];
    return customers
      .filter((c) => !c.accountOnly)
      .map((c) => customerToListRow(c, subscriptions));
  } catch (error) {
    logError("crm_list_customers_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function getAdminAccountListRows(user: PortalUser): Promise<AccountListRow[]> {
  const customers = await listCustomerRecordsForStaffSorted(user);
  if (!customers) return [];

  const byNorm = new Map<string, CustomerRecord[]>();
  for (const c of customers) {
    const name = c.company?.trim();
    if (!name) continue;
    const norm = name.toLowerCase();
    const bucket = byNorm.get(norm) ?? [];
    bucket.push(c);
    byNorm.set(norm, bucket);
  }

  const rows: AccountListRow[] = [];
  for (const [, group] of byNorm) {
    const sorted = sortGroupNewestFirst(group);
    const displayName = displayCompanyNameForGroup(sorted);
    const key = companyNameToAccountKey(displayName);
    if (!key) continue;
    let addressSummary = "—";
    for (const c of sorted) {
      const s = companyAddressSummary(c);
      if (s !== "—") {
        addressSummary = s;
        break;
      }
    }
    const { contactName, contactId, additionalContactCount } = pickPrimaryContact(group);
    rows.push({
      key,
      displayName,
      addressSummary,
      companyPhone: pickLatestNonEmpty(sorted, (r) => r.companyPhone),
      companyEmail: pickLatestNonEmpty(sorted, (r) => r.companyEmail),
      companyWebsite: pickLatestNonEmpty(sorted, (r) => r.companyWebsite),
      contactName,
      ...(contactId ? { contactId } : {}),
      additionalContactCount,
    });
  }

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
  return rows;
}

export interface AccountDetailAggregate {
  key: string;
  displayName: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  companyCity?: string;
  companyRegion?: string;
  companyPostalCode?: string;
  companyCountry?: string;
  contacts: CustomerRecord[];
}

export async function getAccountDetailForKey(
  user: PortalUser,
  accountKey: string,
): Promise<AccountDetailAggregate | null> {
  const customers = await listCustomerRecordsForStaffSorted(user);
  if (!customers) return null;

  const norm = accountKeyToNormalizedCompany(accountKey);
  if (!norm) return null;

  const group = customers.filter((c) => c.company?.trim().toLowerCase() === norm);
  if (group.length === 0) return null;

  const sorted = sortGroupNewestFirst(group);
  const displayName = displayCompanyNameForGroup(sorted);
  const contacts = sorted.filter((c) => !c.accountOnly);
  return {
    key: companyNameToAccountKey(displayName),
    displayName,
    companyPhone: pickLatestNonEmpty(sorted, (r) => r.companyPhone),
    companyEmail: pickLatestNonEmpty(sorted, (r) => r.companyEmail),
    companyWebsite: pickLatestNonEmpty(sorted, (r) => r.companyWebsite),
    companyAddressLine1: pickLatestNonEmpty(sorted, (r) => r.companyAddressLine1) || undefined,
    companyAddressLine2: pickLatestNonEmpty(sorted, (r) => r.companyAddressLine2) || undefined,
    companyCity: pickLatestNonEmpty(sorted, (r) => r.companyCity) || undefined,
    companyRegion: pickLatestNonEmpty(sorted, (r) => r.companyRegion) || undefined,
    companyPostalCode: pickLatestNonEmpty(sorted, (r) => r.companyPostalCode) || undefined,
    companyCountry: pickLatestNonEmpty(sorted, (r) => r.companyCountry) || undefined,
    contacts,
  };
}

export async function createAccountDocument(
  user: PortalUser,
  input: CreateAccountFormInput,
): Promise<
  | { ok: true; accountKey: string; alreadyExisted: boolean }
  | { ok: false; message: string }
> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return { ok: false, message: "CRM is only available to admin or team members." };
  }

  const companyTrimmed = input.company.trim();
  if (!companyTrimmed) {
    return { ok: false, message: "Company name is required." };
  }
  const accountKey = companyNameToAccountKey(companyTrimmed);
  if (!accountKey) {
    return { ok: false, message: "Company name is required." };
  }

  const customers = await listCustomerRecordsForStaffSorted(user);
  if (!customers) {
    return { ok: false, message: "Could not load customers." };
  }
  const existingGroup = customers.filter(
    (c) => c.company?.trim().toLowerCase() === companyTrimmed.toLowerCase(),
  );
  if (existingGroup.length > 0) {
    return { ok: true, accountKey, alreadyExisted: true };
  }

  const col = db.collection(COLLECTIONS.customers);
  const docRef = col.doc();
  const payload = {
    name: "",
    email: "",
    company: companyTrimmed,
    companyPhone: input.companyPhone?.trim() || null,
    companyEmail: input.companyEmail?.trim()?.toLowerCase() || null,
    companyWebsite: input.companyWebsite?.trim() || null,
    companyAddressLine1: input.companyAddressLine1?.trim() || null,
    companyAddressLine2: input.companyAddressLine2?.trim() || null,
    companyCity: input.companyCity?.trim() || null,
    companyRegion: input.companyRegion?.trim() || null,
    companyPostalCode: input.companyPostalCode?.trim() || null,
    companyCountry: input.companyCountry?.trim() || null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    country: null,
    tags: [] as string[],
    customFields: {} as Record<string, string>,
    portalUserId: null,
    stripeCustomerId: null,
    avatarUrl: null,
    status: "active",
    crmType: "contact" as CustomerCrmType,
    accountOnly: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByUid: user.uid,
  };

  try {
    await docRef.set(payload);
    await db.collection(COLLECTIONS.customerActivities).add({
      customerId: docRef.id,
      type: "created",
      title: "Account created",
      detail: companyTrimmed,
      actorUid: user.uid,
      createdAt: Timestamp.now(),
    });
    return { ok: true, accountKey, alreadyExisted: false };
  } catch (error) {
    logError("crm_create_account_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Failed to create account." };
  }
}

export async function updateAccountDetailsForGroup(
  user: PortalUser,
  input: UpdateAccountFormInput,
): Promise<{ ok: true; newAccountKey: string } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return { ok: false, message: "CRM is only available to admin or team members." };
  }

  const norm = accountKeyToNormalizedCompany(input.accountKey);
  if (!norm) {
    return { ok: false, message: "Invalid account." };
  }

  const customers = await listCustomerRecordsForStaffSorted(user);
  if (!customers) {
    return { ok: false, message: "Could not load customers." };
  }

  const contacts = customers.filter((c) => c.company?.trim().toLowerCase() === norm);
  if (contacts.length === 0) {
    return { ok: false, message: "Account not found." };
  }

  const companyTrimmed = input.company.trim();
  const newAccountKey = companyNameToAccountKey(companyTrimmed);
  if (!newAccountKey) {
    return { ok: false, message: "Company name is required." };
  }

  const payload: Record<string, unknown> = {
    company: companyTrimmed,
    companyPhone: input.companyPhone?.trim() || null,
    companyEmail: input.companyEmail?.trim()?.toLowerCase() || null,
    companyWebsite: input.companyWebsite?.trim() || null,
    companyAddressLine1: input.companyAddressLine1?.trim() || null,
    companyAddressLine2: input.companyAddressLine2?.trim() || null,
    companyCity: input.companyCity?.trim() || null,
    companyRegion: input.companyRegion?.trim() || null,
    companyPostalCode: input.companyPostalCode?.trim() || null,
    companyCountry: input.companyCountry?.trim() || null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    await Promise.all(
      contacts.map(async (c) => {
        await db.collection(COLLECTIONS.customers).doc(c.id).update(payload);
        await db.collection(COLLECTIONS.customerActivities).add({
          customerId: c.id,
          type: "updated",
          title: "Account company details updated",
          detail: companyTrimmed,
          actorUid: user.uid,
          createdAt: Timestamp.now(),
        });
      }),
    );
    return { ok: true, newAccountKey };
  } catch (error) {
    logError("crm_update_account_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Failed to update account details." };
  }
}

export async function getCustomerRecordForOrg(
  user: PortalUser,
  customerId: string,
): Promise<CustomerRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return null;
  const ref = db.collection(COLLECTIONS.customers).doc(customerId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const parsed = parseCustomerRecord(snap.id, snap.data() as Record<string, unknown>);
  return parsed;
}

/** Token-based subscription checkout — verifies org scope vs proposal. */
export async function getCustomerRecordForPublicProposalCheckout(
  customerId: string,
  proposalOrganizationId: string | undefined,
): Promise<CustomerRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;
  const id = customerId.trim();
  if (!id) return null;
  const snap = await db.collection(COLLECTIONS.customers).doc(id).get();
  if (!snap.exists) return null;
  const row = parseCustomerRecord(snap.id, snap.data() as Record<string, unknown>);
  if (!row) return null;
  const pOrg = proposalOrganizationId?.trim();
  const cOrg = row.organizationId?.trim();
  if (pOrg && cOrg && pOrg !== cOrg) return null;
  return row;
}

/** Batch-load CRM customers by id (Firestore `getAll`, chunks of 10). */
export async function batchGetCustomerRecordsForStaff(
  user: PortalUser,
  customerIds: string[],
): Promise<Map<string, CustomerRecord>> {
  const db = getFirebaseAdminFirestore();
  const out = new Map<string, CustomerRecord>();
  if (!db || !isStaff(user) || customerIds.length === 0) return out;
  const unique = [...new Set(customerIds.map((id) => id.trim()).filter(Boolean))];
  const chunkSize = 10;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection(COLLECTIONS.customers).doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const row = parseCustomerRecord(snap.id, snap.data() as Record<string, unknown>);
      if (row) out.set(row.id, row);
    }
  }
  return out;
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
    createdAt: coerceTimestampToMillis(data.createdAt),
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
    createdAt: coerceTimestampToMillis(data.createdAt),
  };
}

export async function listCustomerNotes(
  user: PortalUser,
  customerId: string,
  limit = 80,
): Promise<CustomerNoteRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
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
    return rows.sort((a, b) => b.createdAt - a.createdAt);
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
  if (!db || !isStaff(user)) return [];
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
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function parseInvoice(id: string, data: Record<string, unknown>): InvoiceRecord {
  return {
    id,
    stripeInvoiceId: asString(data.stripeInvoiceId) ?? id,
    customerId: asString(data.customerId) ?? "",
    subscriptionId: asString(data.subscriptionId),
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
    issuedAt: millisFromFirestore(data, "issuedAt"),
    paidAt: asNumber(data.paidAt),
  };
}

export async function listInvoicesForStripeCustomer(
  user: PortalUser,
  stripeCustomerId: string | undefined,
): Promise<InvoiceRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user) || !stripeCustomerId) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.invoices)
      .where("customerId", "==", stripeCustomerId)
      .limit(50)
      .get();
    const rows = snap.docs.map((d) => parseInvoice(d.id, d.data() as Record<string, unknown>));
    return rows.sort((a, b) => (b.issuedAt ?? 0) - (a.issuedAt ?? 0));
  } catch {
    return [];
  }
}

export async function listSubscriptionsForStripeCustomer(
  user: PortalUser,
  stripeCustomerId: string | undefined,
): Promise<SubscriptionRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user) || !stripeCustomerId) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.subscriptions)
      .where("customerId", "==", stripeCustomerId)
      .limit(50)
      .get();
    const rows = snap.docs.map((d) => parseSubscriptionFirestore(d.id, d.data() as Record<string, unknown>));
    return rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

/**
 * Proposals for this CRM profile: `customerId` on the row, or legacy / email-only matches on `recipientEmail`.
 * (Avoids loading a global `limit(100)` slice of the collection, which could omit newly created rows.)
 */
export async function listProposalsLinkedToCustomer(
  user: PortalUser,
  customerId: string,
  recipientEmail: string,
): Promise<ProposalRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  const emailLower = recipientEmail.trim().toLowerCase();

  try {
    const byCustomerSnap = await db
      .collection(COLLECTIONS.proposals)
      .where("customerId", "==", customerId)
      .limit(100)
      .get();

    const byEmailSnap =
      emailLower.length > 0
        ? await db
            .collection(COLLECTIONS.proposals)
            .where("recipientEmail", "==", emailLower)
            .limit(100)
            .get()
        : null;

    const seen = new Set<string>();
    const rows: ProposalRecord[] = [];
    const docs = [...byCustomerSnap.docs, ...(byEmailSnap?.docs ?? [])];
    for (const doc of docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      rows.push(parseProposalRecord(doc.id, doc.data() as Record<string, unknown>));
    }
    return rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch (err) {
    logError("listProposalsLinkedToCustomer", { err: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Signed Services Agreements for this CRM customer (`customerId` on the snapshot row).
 */
export async function listSignedAgreementsForCustomer(
  user: PortalUser,
  customerId: string,
): Promise<SignedAgreementRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.signedAgreements)
      .where("customerId", "==", customerId)
      .limit(80)
      .get();
    const rows: SignedAgreementRecord[] = [];
    for (const d of snap.docs) {
      const parsed = parseSignedAgreementRecord(d.id, d.data() as Record<string, unknown>);
      if (parsed) rows.push(parsed);
    }
    return rows.sort((a, b) => b.signedAt - a.signedAt);
  } catch (err) {
    logError("list_signed_agreements_for_customer_failed", {
      customerId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Loads one signed agreement for the customer detail document viewer.
 * Enforces `customerId` match and staff `organizationId` when present on the user.
 */
export async function getSignedAgreementForCustomerContext(
  user: PortalUser,
  customerId: string,
  signedAgreementId: string,
  customerOrganizationId?: string,
): Promise<SignedAgreementRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return null;
  const id = signedAgreementId.trim();
  if (!id) return null;
  try {
    const snap = await db.collection(COLLECTIONS.signedAgreements).doc(id).get();
    if (!snap.exists) return null;
    const row = parseSignedAgreementRecord(snap.id, snap.data() as Record<string, unknown>);
    if (!row) return null;
    if (row.customerId !== customerId) return null;
    if (user.organizationId && row.organizationId !== user.organizationId) return null;
    const custOrg = customerOrganizationId?.trim();
    if (custOrg && row.organizationId !== custOrg) return null;
    return row;
  } catch (err) {
    logError("get_signed_agreement_for_customer_failed", {
      customerId,
      signedAgreementId: id,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function listTasksForCustomer(user: PortalUser, customerId: string): Promise<TaskRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.tasks)
      .where("customerId", "==", customerId)
      .limit(80)
      .get();
    return snap.docs.map((d) => parseTaskRecord(d.id, d.data() as Record<string, unknown>));
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

function contactAddressPayloadFromInput(input: {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}): {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
} {
  const n = normalizeAddressFields({
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    country: input.country,
  });
  return {
    addressLine1: n.addressLine1?.trim() || null,
    addressLine2: n.addressLine2?.trim() || null,
    city: n.city?.trim() || null,
    region: n.region?.trim() || null,
    postalCode: n.postalCode?.trim() || null,
    country: n.country?.trim() || null,
  };
}

export async function createCustomerDocument(
  user: PortalUser,
  input: CreateCustomerInput,
): Promise<CreateCustomerResult | CreateCustomerError> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return { ok: false, message: "CRM is only available to admin or team members." };
  }
  const customFields: Record<string, string> = {};

  const crmType: CustomerCrmType = input.saveAsLead ? "lead" : "contact";

  const col = db.collection(COLLECTIONS.customers);
  const docRef = col.doc();
  const payload = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company?.trim() || null,
    companyPhone: input.companyPhone?.trim() || null,
    companyEmail: input.companyEmail?.trim()?.toLowerCase() || null,
    companyWebsite: input.companyWebsite?.trim() || null,
    companyAbn: input.companyAbn?.trim() || null,
    companyAcn: input.companyAcn?.trim() || null,
    companyAddressLine1: input.companyAddressLine1?.trim() || null,
    companyAddressLine2: input.companyAddressLine2?.trim() || null,
    companyCity: input.companyCity?.trim() || null,
    companyRegion: input.companyRegion?.trim() || null,
    companyPostalCode: input.companyPostalCode?.trim() || null,
    companyCountry: input.companyCountry?.trim() || null,
    phone: input.phone?.trim() || null,
    ...contactAddressPayloadFromInput(input),
    tags: input.tags ?? [],
    customFields,
    portalUserId: null,
    stripeCustomerId: null,
    avatarUrl: null,
    status: "active",
    crmType,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByUid: user.uid,
  };

  await docRef.set(payload);

  let leadOpportunityCreated = false;
  if (crmType === "lead") {
    try {
      const now = Timestamp.now();
      const opportunityName =
        payload.company?.trim() || payload.name.trim() || payload.email.trim() || "New lead";
      const opportunityPayload: Record<string, unknown> = {
        customerId: docRef.id,
        name: opportunityName,
        stage: "lead_in",
        customFieldsSnapshot: customFields,
        currency: "aud",
        createdAt: now,
        updatedAt: now,
        createdByUid: user.uid,
      };
      if (user.organizationId) {
        opportunityPayload.organizationId = user.organizationId;
      }
      await db.collection(COLLECTIONS.opportunities).add(opportunityPayload);
      leadOpportunityCreated = true;
    } catch (err) {
      logError("create_customer_lead_opportunity_failed", {
        customerId: docRef.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const stripe = getStripe();
  if (stripe) {
    try {
      const crmForStripe: CustomerRecord = {
        id: docRef.id,
        name: payload.name,
        email: payload.email,
        tags: payload.tags,
        customFields,
        crmType,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const { stripeCustomerId, created } = await ensureStripeCustomer(stripe, crmForStripe);
      if (created) {
        await docRef.update({
          stripeCustomerId,
          stripeSyncedAt: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      logError("create_customer_stripe_sync_failed", {
        customerId: docRef.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const firstActivityAt = Timestamp.now();
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId: docRef.id,
    type: "created",
    title: crmType === "lead" ? "Lead created" : "Customer created",
    detail: input.name.trim(),
    actorUid: user.uid,
    createdAt: firstActivityAt,
  });

  if (leadOpportunityCreated) {
    await db.collection(COLLECTIONS.customerActivities).add({
      customerId: docRef.id,
      type: "opportunity_created",
      title: "Opportunity created",
      detail: payload.name || payload.email,
      actorUid: user.uid,
      createdAt: Timestamp.fromMillis(firstActivityAt.toMillis() + 2),
    });
  }

  await syncStripeCustomerIdFromCrmCustomerDoc(db, docRef.id);

  return {
    ok: true,
    customerId: docRef.id,
  };
}

export async function updateCustomerDocument(
  user: PortalUser,
  input: UpdateCustomerFormInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return { ok: false, message: "CRM is only available to admin or team members." };
  }

  const { id: customerId, ...rest } = input;
  const existing = await getCustomerRecordForOrg(user, customerId);
  if (!existing) {
    return { ok: false, message: "Customer not found." };
  }

  const payload: Record<string, unknown> = {
    name: rest.name.trim(),
    email: rest.email.trim().toLowerCase(),
    company: rest.company?.trim() || null,
    companyPhone: rest.companyPhone?.trim() || null,
    companyEmail: rest.companyEmail?.trim()?.toLowerCase() || null,
    companyWebsite: rest.companyWebsite?.trim() || null,
    companyAbn: rest.companyAbn?.trim() || null,
    companyAcn: rest.companyAcn?.trim() || null,
    companyAddressLine1: rest.companyAddressLine1?.trim() || null,
    companyAddressLine2: rest.companyAddressLine2?.trim() || null,
    companyCity: rest.companyCity?.trim() || null,
    companyRegion: rest.companyRegion?.trim() || null,
    companyPostalCode: rest.companyPostalCode?.trim() || null,
    companyCountry: rest.companyCountry?.trim() || null,
    phone: rest.phone?.trim() || null,
    ...contactAddressPayloadFromInput(rest),
    tags: rest.tags ?? [],
    customFields: existing.customFields ?? {},
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection(COLLECTIONS.customers).doc(customerId).update(payload);

  const updatedAt = Timestamp.now();
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId,
    type: "updated",
    title: "Profile updated",
    actorUid: user.uid,
    createdAt: updatedAt,
  });

  await syncStripeCustomerIdFromCrmCustomerDoc(db, customerId);

  return { ok: true };
}

/**
 * One-click portal: resolve Firebase user by CRM email (create if missing) and set `portalUserId`.
 * No-op when access is already linked.
 */
export async function enableCustomerPortalAccess(
  user: PortalUser,
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return { ok: false, message: "CRM is only available to admin or team members." };
  }

  const id = customerId.trim();
  if (!id) {
    return { ok: false, message: "Customer id is required." };
  }

  const existing = await getCustomerRecordForOrg(user, id);
  if (!existing) {
    return { ok: false, message: "Customer not found." };
  }
  if (existing.portalUserId?.trim()) {
    return { ok: true };
  }

  const email = existing.email?.trim().toLowerCase();
  if (!email) {
    return { ok: false, message: "Customer email is required to enable access." };
  }

  const resolved = await resolveOrCreateFirebaseUserByEmail(email, {
    active: true,
    createIfMissing: true,
  });
  if (!resolved.ok) {
    return { ok: false, message: resolved.message };
  }
  if (!resolved.uid) {
    return { ok: false, message: "Could not link or create an account for this email." };
  }

  await db.collection(COLLECTIONS.customers).doc(id).update({
    portalUserId: resolved.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedAt = Timestamp.now();
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId: id,
    type: "auth_linked",
    title: resolved.createdNew ? "Created User Access" : "Linked User Access",
    detail: email,
    actorUid: user.uid,
    createdAt: updatedAt,
  });

  await syncStripeCustomerIdFromCrmCustomerDoc(db, id);

  return { ok: true };
}

export async function appendCustomerNote(
  user: PortalUser,
  customerId: string,
  body: string,
  kind: CustomerNoteRecord["kind"],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
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
  if (!db || !isStaff(user)) return { ok: false, message: "Not allowed." };
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

async function deleteQueryDocsWhere(
  db: AdminDb,
  collection: string,
  field: string,
  value: string,
): Promise<void> {
  const snap = await db.collection(collection).where(field, "==", value).limit(400).get();
  if (snap.empty) return;
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  if (snap.size >= 400) await deleteQueryDocsWhere(db, collection, field, value);
}

/** Deletes proposals linked by `customerId` or legacy `recipientEmail` match. */
export async function deleteProposalsForCustomerDb(
  db: AdminDb,
  customerId: string,
  recipientEmail: string,
): Promise<void> {
  await deleteQueryDocsWhere(db, COLLECTIONS.proposals, "customerId", customerId);
  const emailLower = recipientEmail.trim().toLowerCase();
  if (emailLower) {
    await deleteQueryDocsWhere(db, COLLECTIONS.proposals, "recipientEmail", emailLower);
  }
}

export async function deleteCustomerDocument(
  user: PortalUser,
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return { ok: false, message: "Not allowed." };
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return { ok: false, message: "Customer not found." };

  if (customer.stripeCustomerId) {
    const stripe = getStripe();
    if (stripe) {
      const stripeDel = await deleteMirroredStripeCustomer(stripe, customer.stripeCustomerId);
      if (!stripeDel.ok) return { ok: false, message: stripeDel.message };
    }
  }

  const database = db;

  await deleteQueryDocsWhere(database, COLLECTIONS.customerNotes, "customerId", customerId);
  await deleteQueryDocsWhere(database, COLLECTIONS.customerActivities, "customerId", customerId);
  await deleteQueryDocsWhere(database, COLLECTIONS.signedAgreements, "customerId", customerId);
  await deleteQueryDocsWhere(database, COLLECTIONS.tasks, "customerId", customerId);
  await deleteProposalsForCustomerDb(database, customerId, customer.email);
  await deleteOpportunitiesForCustomerDb(database, customerId);

  const stripeCustomerId = customer.stripeCustomerId?.trim();
  if (stripeCustomerId) {
    await deleteQueryDocsWhere(database, COLLECTIONS.subscriptions, "customerId", stripeCustomerId);
    await deleteQueryDocsWhere(database, COLLECTIONS.invoices, "customerId", stripeCustomerId);
    await deleteQueryDocsWhere(database, COLLECTIONS.payments, "customerId", stripeCustomerId);
    await database.collection(COLLECTIONS.stripeCustomers).doc(stripeCustomerId).delete().catch(() => {});
  }

  await database.collection(COLLECTIONS.customers).doc(customerId).delete();
  return { ok: true };
}

/** Persists Stripe customer id from server flows that cannot use {@link syncStripeCustomerBasics} (no staff user). */
export async function persistStripeCustomerIdOnCustomer(
  customerId: string,
  stripeCustomerId: string,
): Promise<void> {
  const db = getFirebaseAdminFirestore();
  if (!db) return;
  const id = customerId.trim();
  const sid = stripeCustomerId.trim();
  if (!id || !sid) return;
  await db
    .collection(COLLECTIONS.customers)
    .doc(id)
    .set(
      { stripeCustomerId: sid, stripeSyncedAt: Date.now(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  await syncStripeCustomerIdFromCrmCustomerDoc(db, id);
}

export async function syncStripeCustomerBasics(
  user: PortalUser,
  customerId: string,
  stripeCustomerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return { ok: false, message: "Not allowed." };
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return { ok: false, message: "Customer not found." };
  await db
    .collection(COLLECTIONS.customers)
    .doc(customerId)
    .update({
      stripeCustomerId,
      stripeSyncedAt: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId,
    type: "stripe_sync",
    title: "Stripe customer linked",
    detail: stripeCustomerId,
    actorUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  await syncStripeCustomerIdFromCrmCustomerDoc(db, customerId);
  return { ok: true };
}
