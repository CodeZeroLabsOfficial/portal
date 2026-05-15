import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { isStaff } from "@/lib/auth/server-session";
import { asNumber, asString, asStringStringMap } from "@/lib/firestore/coerce";
import { logError } from "@/lib/logging";
import { coerceTimestampToMillis } from "@/lib/firestore/timestamp";
import { normalizeOpportunityStage } from "@/lib/crm/opportunity-stages";
import { COLLECTIONS } from "@/server/firestore/collections";
import { batchGetCustomerRecordsForStaff } from "@/server/firestore/crm-customers";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import type { CustomerRecord } from "@/types/customer";
import type {
  OpportunityActivityKind,
  OpportunityActivityRecord,
  OpportunityBoardCard,
  OpportunityNoteRecord,
  OpportunityRecord,
} from "@/types/opportunity";
import type { PortalUser } from "@/types/user";

type AdminDb = NonNullable<ReturnType<typeof getFirebaseAdminFirestore>>;

function parseOpportunity(id: string, data: Record<string, unknown>): OpportunityRecord | null {
  const customerId = asString(data.customerId);
  if (!customerId) return null;
  return {
    id,
    customerId,
    organizationId: asString(data.organizationId),
    name: asString(data.name) ?? "Opportunity",
    stage: normalizeOpportunityStage(data.stage),
    amountMinor: asNumber(data.amountMinor),
    currency: (asString(data.currency) ?? "aud").toLowerCase(),
    customFieldsSnapshot: asStringStringMap(data.customFieldsSnapshot),
    notes: asString(data.notes),
    createdAt: coerceTimestampToMillis(data.createdAt),
    updatedAt: coerceTimestampToMillis(data.updatedAt),
    createdByUid: asString(data.createdByUid),
  };
}

export async function listOpportunitiesForStaff(user: PortalUser): Promise<OpportunityRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  try {
    const snap = await db.collection(COLLECTIONS.opportunities).limit(500).get();
    const rows = snap.docs
      .map((d) => parseOpportunity(d.id, d.data() as Record<string, unknown>))
      .filter((r): r is OpportunityRecord => r !== null);
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    logError("crm_list_opportunities_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

async function aggregateCountForOpportunity(
  db: AdminDb,
  collection: string,
  opportunityId: string,
): Promise<number> {
  const snap = await db.collection(collection).where("opportunityId", "==", opportunityId).count().get();
  const raw = snap.data().count;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

async function mapParallelChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const part = await Promise.all(chunk.map(fn));
    out.push(...part);
  }
  return out;
}

function userSummaryFromDoc(
  id: string,
  data: Record<string, unknown>,
): { displayName: string; photoURL?: string } {
  const email = asString(data.email) ?? "";
  const dn = asString(data.displayName)?.trim();
  const displayName = dn || email || id;
  const photoURL = asString(data.photoURL);
  return { displayName, ...(photoURL ? { photoURL } : {}) };
}

/** Opportunities with customer labels, note/activity counts, and assignee snapshot for the pipeline UI. */
export async function listOpportunityBoardCardsForStaff(user: PortalUser): Promise<OpportunityBoardCard[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];

  const opportunities = await listOpportunitiesForStaff(user);
  if (opportunities.length === 0) return [];

  const customerIds = [...new Set(opportunities.map((o) => o.customerId))];
  const customers = await batchGetCustomerRecordsForStaff(user, customerIds);

  const assigneeUids = new Set<string>();
  for (const o of opportunities) {
    const c = customers.get(o.customerId);
    const uid = o.createdByUid?.trim() || c?.createdByUid?.trim();
    if (uid) assigneeUids.add(uid);
  }

  const userSummaries = new Map<string, { displayName: string; photoURL?: string }>();
  const uidList = [...assigneeUids];
  const chunkSize = 10;
  for (let i = 0; i < uidList.length; i += chunkSize) {
    const chunk = uidList.slice(i, i + chunkSize);
    const refs = chunk.map((uid) => db.collection(COLLECTIONS.users).doc(uid));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (!s.exists) continue;
      userSummaries.set(s.id, userSummaryFromDoc(s.id, s.data() as Record<string, unknown>));
    }
  }

  const noteCountsList = await mapParallelChunks(opportunities, 24, async (o) => {
    const c = await aggregateCountForOpportunity(db, COLLECTIONS.opportunityNotes, o.id);
    return [o.id, c] as const;
  });
  const activityCountsList = await mapParallelChunks(opportunities, 24, async (o) => {
    const c = await aggregateCountForOpportunity(db, COLLECTIONS.opportunityActivities, o.id);
    return [o.id, c] as const;
  });
  const noteCounts = new Map(noteCountsList);
  const activityCounts = new Map(activityCountsList);

  return opportunities.map((o): OpportunityBoardCard => {
    const customer: CustomerRecord | undefined = customers.get(o.customerId);
    const company = customer?.company?.trim();
    const person = customer?.name?.trim() ?? "";
    const accountCompanyName = company || person || "—";
    const leadContactName = person || customer?.email?.trim() || "—";

    const assigneeUid = o.createdByUid?.trim() || customer?.createdByUid?.trim();
    const su = assigneeUid ? userSummaries.get(assigneeUid) : undefined;

    return {
      ...o,
      accountCompanyName,
      leadContactName,
      opportunityNoteCount: noteCounts.get(o.id) ?? 0,
      opportunityActivityCount: activityCounts.get(o.id) ?? 0,
      ...(assigneeUid ? { assigneeUid } : {}),
      ...(su?.displayName ? { assigneeDisplayName: su.displayName } : {}),
      ...(su?.photoURL ? { assigneePhotoUrl: su.photoURL } : {}),
    };
  });
}

export async function deleteOpportunityForStaff(
  user: PortalUser,
  opportunityId: string,
): Promise<{ ok: true; customerId: string } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return { ok: false, message: "Not allowed." };
  const existing = await getOpportunityForStaff(user, opportunityId);
  if (!existing) return { ok: false, message: "Opportunity not found." };
  const customerId = existing.customerId;

  try {
    await deleteSubcollectionForOpportunity(db, COLLECTIONS.opportunityNotes, opportunityId);
    await deleteSubcollectionForOpportunity(db, COLLECTIONS.opportunityActivities, opportunityId);
    await db.collection(COLLECTIONS.opportunities).doc(opportunityId).delete();
    return { ok: true, customerId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed.";
    logError("crm_delete_opportunity_failed", { opportunityId, message });
    return { ok: false, message };
  }
}

export async function listOpportunitiesForCustomer(
  user: PortalUser,
  customerId: string,
): Promise<OpportunityRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.opportunities)
      .where("customerId", "==", customerId)
      .limit(80)
      .get();
    const rows = snap.docs
      .map((d) => parseOpportunity(d.id, d.data() as Record<string, unknown>))
      .filter((r): r is OpportunityRecord => r !== null);
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function getOpportunityForStaff(
  user: PortalUser,
  opportunityId: string,
): Promise<OpportunityRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return null;
  const snap = await db.collection(COLLECTIONS.opportunities).doc(opportunityId).get();
  if (!snap.exists) return null;
  return parseOpportunity(snap.id, snap.data() as Record<string, unknown>);
}

export type ConvertLeadResult = { ok: true; customerId: string } | { ok: false; message: string };

/**
 * Promotes `crmType` from lead → contact and deletes every pipeline opportunity linked to this customer
 * (including the auto-created `lead_in` card from lead intake).
 */
export async function convertLeadToContact(user: PortalUser, customerId: string): Promise<ConvertLeadResult> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return { ok: false, message: "CRM is only available to admin or team members." };
  }

  const customerRef = db.collection(COLLECTIONS.customers).doc(customerId);
  const customerSnap = await customerRef.get();
  if (!customerSnap.exists) {
    return { ok: false, message: "Customer not found." };
  }
  const customerData = customerSnap.data() as Record<string, unknown>;
  if (customerData.crmType !== "lead") {
    return { ok: false, message: "This profile is already a contact." };
  }

  const detailLabel =
    asString(customerData.company)?.trim() ||
    asString(customerData.name)?.trim() ||
    asString(customerData.email)?.trim() ||
    "Lead";

  let opportunityDocIds: string[] = [];

  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(customerRef);
      if (!fresh.exists) {
        throw new Error("Customer removed during conversion.");
      }
      const data = fresh.data() as Record<string, unknown>;
      if (data.crmType !== "lead") {
        throw new Error("Already converted.");
      }

      const oppsQuery = db.collection(COLLECTIONS.opportunities).where("customerId", "==", customerId).limit(500);
      const oppsSnap = await tx.get(oppsQuery);
      if (oppsSnap.size >= 500) {
        throw new Error("Too many linked opportunities to convert automatically. Delete some first.");
      }

      opportunityDocIds = oppsSnap.docs.map((d) => d.id);

      tx.update(customerRef, {
        crmType: "contact",
        updatedAt: FieldValue.serverTimestamp(),
      });

      for (const doc of oppsSnap.docs) {
        tx.delete(doc.ref);
      }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Conversion failed.";
    return { ok: false, message };
  }

  await Promise.all(
    opportunityDocIds.flatMap((id) => [
      deleteSubcollectionForOpportunity(db, COLLECTIONS.opportunityNotes, id),
      deleteSubcollectionForOpportunity(db, COLLECTIONS.opportunityActivities, id),
    ]),
  );

  const activityAt = Timestamp.now();
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId,
    type: "lead_converted",
    title: "Lead converted to contact",
    detail: `${detailLabel} — removed from pipeline`,
    actorUid: user.uid,
    createdAt: activityAt,
  });

  return { ok: true, customerId };
}

export async function updateOpportunityStage(
  user: PortalUser,
  opportunityId: string,
  stage: import("@/types/opportunity").OpportunityStage,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return { ok: false, message: "Not allowed." };
  const existing = await getOpportunityForStaff(user, opportunityId);
  if (!existing) return { ok: false, message: "Opportunity not found." };

  await db
    .collection(COLLECTIONS.opportunities)
    .doc(opportunityId)
    .update({
      stage,
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { ok: true };
}

async function deleteSubcollectionForOpportunity(
  db: AdminDb,
  collection: string,
  opportunityId: string,
): Promise<void> {
  const snap = await db.collection(collection).where("opportunityId", "==", opportunityId).limit(400).get();
  if (snap.empty) return;
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  if (snap.size >= 400) await deleteSubcollectionForOpportunity(db, collection, opportunityId);
}

export async function deleteOpportunitiesForCustomerDb(db: AdminDb, customerId: string): Promise<void> {
  const snap = await db.collection(COLLECTIONS.opportunities).where("customerId", "==", customerId).limit(400).get();
  if (snap.empty) return;
  await Promise.all(
    snap.docs.map(async (doc) => {
      await Promise.all([
        deleteSubcollectionForOpportunity(db, COLLECTIONS.opportunityNotes, doc.id),
        deleteSubcollectionForOpportunity(db, COLLECTIONS.opportunityActivities, doc.id),
      ]);
    }),
  );
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  if (snap.size >= 400) await deleteOpportunitiesForCustomerDb(db, customerId);
}

function parseOpportunityNote(id: string, data: Record<string, unknown>): OpportunityNoteRecord | null {
  const opportunityId = asString(data.opportunityId);
  if (!opportunityId) return null;
  const organizationId = asString(data.organizationId);
  return {
    id,
    opportunityId,
    ...(organizationId ? { organizationId } : {}),
    authorUid: asString(data.authorUid) ?? "",
    body: asString(data.body) ?? "",
    createdAt: coerceTimestampToMillis(data.createdAt),
  };
}

function parseOpportunityActivity(
  id: string,
  data: Record<string, unknown>,
): OpportunityActivityRecord | null {
  const opportunityId = asString(data.opportunityId);
  if (!opportunityId) return null;
  const organizationId = asString(data.organizationId);
  const kindRaw = asString(data.kind);
  const kind: OpportunityActivityKind =
    kindRaw === "meeting" || kindRaw === "call" || kindRaw === "email" || kindRaw === "other"
      ? kindRaw
      : "other";
  const createdAt = coerceTimestampToMillis(data.createdAt);
  const occurredAt = coerceTimestampToMillis(data.occurredAt) || createdAt;
  return {
    id,
    opportunityId,
    ...(organizationId ? { organizationId } : {}),
    kind,
    title: asString(data.title) ?? "Activity",
    detail: asString(data.detail),
    occurredAt,
    authorUid: asString(data.authorUid) ?? "",
    createdAt,
  };
}

export async function listOpportunityNotes(
  user: PortalUser,
  opportunityId: string,
  limit = 80,
): Promise<OpportunityNoteRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  const opp = await getOpportunityForStaff(user, opportunityId);
  if (!opp) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.opportunityNotes)
      .where("opportunityId", "==", opportunityId)
      .limit(limit)
      .get();
    const rows = snap.docs
      .map((d) => parseOpportunityNote(d.id, d.data() as Record<string, unknown>))
      .filter((n): n is OpportunityNoteRecord => n !== null);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logError("crm_list_opportunity_notes_failed", {
      opportunityId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function listOpportunityActivities(
  user: PortalUser,
  opportunityId: string,
  limit = 80,
): Promise<OpportunityActivityRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  const opp = await getOpportunityForStaff(user, opportunityId);
  if (!opp) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.opportunityActivities)
      .where("opportunityId", "==", opportunityId)
      .limit(limit)
      .get();
    const rows = snap.docs
      .map((d) => parseOpportunityActivity(d.id, d.data() as Record<string, unknown>))
      .filter((a): a is OpportunityActivityRecord => a !== null);
    return rows.sort((a, b) => b.occurredAt - a.occurredAt);
  } catch (error) {
    logError("crm_list_opportunity_activities_failed", {
      opportunityId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function appendOpportunityNote(
  user: PortalUser,
  opportunityId: string,
  body: string,
): Promise<{ ok: true; noteId: string } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return { ok: false, message: "Not allowed." };
  }
  const opp = await getOpportunityForStaff(user, opportunityId);
  if (!opp) return { ok: false, message: "Opportunity not found." };
  const trimmedBody = body.trim();
  if (!trimmedBody) return { ok: false, message: "Note cannot be empty." };

  const now = Timestamp.now();
  const payload: Record<string, unknown> = {
    opportunityId,
    authorUid: user.uid,
    body: trimmedBody,
    createdAt: now,
  };
  if (opp.organizationId) payload.organizationId = opp.organizationId;

  const ref = await db.collection(COLLECTIONS.opportunityNotes).add(payload);
  await db
    .collection(COLLECTIONS.opportunities)
    .doc(opportunityId)
    .update({ updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, noteId: ref.id };
}

export async function appendOpportunityActivity(
  user: PortalUser,
  opportunityId: string,
  input: {
    kind: OpportunityActivityKind;
    title: string;
    detail?: string;
    occurredAt?: number;
  },
): Promise<{ ok: true; activityId: string } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) {
    return { ok: false, message: "Not allowed." };
  }
  const opp = await getOpportunityForStaff(user, opportunityId);
  if (!opp) return { ok: false, message: "Opportunity not found." };

  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) return { ok: false, message: "Title is required." };

  const occurredAt =
    typeof input.occurredAt === "number" && Number.isFinite(input.occurredAt)
      ? Timestamp.fromMillis(input.occurredAt)
      : Timestamp.now();
  const now = Timestamp.now();

  const payload: Record<string, unknown> = {
    opportunityId,
    kind: input.kind,
    title: trimmedTitle,
    actorUid: user.uid,
    authorUid: user.uid,
    occurredAt,
    createdAt: now,
  };
  if (input.detail?.trim()) payload.detail = input.detail.trim();
  if (opp.organizationId) payload.organizationId = opp.organizationId;

  const ref = await db.collection(COLLECTIONS.opportunityActivities).add(payload);
  await db
    .collection(COLLECTIONS.opportunities)
    .doc(opportunityId)
    .update({ updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, activityId: ref.id };
}

/** Merge latest customer custom fields into the opportunity snapshot (optional upkeep). */
export async function syncOpportunityCustomFieldsFromCustomer(
  user: PortalUser,
  opportunityId: string,
  customer: CustomerRecord,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return { ok: false, message: "Not allowed." };
  const opp = await getOpportunityForStaff(user, opportunityId);
  if (!opp || opp.customerId !== customer.id) return { ok: false, message: "Opportunity not found." };

  await db
    .collection(COLLECTIONS.opportunities)
    .doc(opportunityId)
    .update({
      customFieldsSnapshot: customer.customFields ?? {},
      updatedAt: FieldValue.serverTimestamp(),
    });
  return { ok: true };
}
