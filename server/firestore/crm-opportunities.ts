import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logError } from "@/lib/logging";
import { coerceTimestampToMillis } from "@/lib/firestore/timestamp";
import { normalizeOpportunityStage } from "@/lib/crm/opportunity-stages";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import type { CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type { PortalUser } from "@/types/user";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function canStaffAccessCrm(user: PortalUser): boolean {
  return user.role === "admin" || user.role === "team";
}

type AdminDb = NonNullable<ReturnType<typeof getFirebaseAdminFirestore>>;

function parseOpportunity(id: string, data: Record<string, unknown>): OpportunityRecord | null {
  const customerId = asString(data.customerId);
  if (!customerId) return null;
  const cfRaw = data.customFieldsSnapshot;
  const customFieldsSnapshot: Record<string, string> =
    cfRaw && typeof cfRaw === "object" && !Array.isArray(cfRaw)
      ? Object.fromEntries(
          Object.entries(cfRaw as Record<string, unknown>)
            .filter(([k, v]) => typeof k === "string" && typeof v === "string")
            .map(([k, v]) => [k, v as string]),
        )
      : {};
  return {
    id,
    customerId,
    organizationId: asString(data.organizationId),
    name: asString(data.name) ?? "Opportunity",
    stage: normalizeOpportunityStage(data.stage),
    amountMinor: asNumber(data.amountMinor),
    currency: (asString(data.currency) ?? "aud").toLowerCase(),
    customFieldsSnapshot,
    notes: asString(data.notes),
    createdAtMs: coerceTimestampToMillis(data.createdAt ?? data.createdAtMs),
    updatedAtMs: coerceTimestampToMillis(data.updatedAt ?? data.updatedAtMs),
    createdByUid: asString(data.createdByUid),
  };
}

export async function listOpportunitiesForStaff(user: PortalUser): Promise<OpportunityRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return [];
  try {
    const snap = await db.collection(COLLECTIONS.opportunities).limit(500).get();
    const rows = snap.docs
      .map((d) => parseOpportunity(d.id, d.data() as Record<string, unknown>))
      .filter((r): r is OpportunityRecord => r !== null);
    return rows.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch (error) {
    logError("crm_list_opportunities_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function listOpportunitiesForCustomer(
  user: PortalUser,
  customerId: string,
): Promise<OpportunityRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return [];
  try {
    const snap = await db
      .collection(COLLECTIONS.opportunities)
      .where("customerId", "==", customerId)
      .limit(80)
      .get();
    const rows = snap.docs
      .map((d) => parseOpportunity(d.id, d.data() as Record<string, unknown>))
      .filter((r): r is OpportunityRecord => r !== null);
    return rows.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch {
    return [];
  }
}

export async function getOpportunityForStaff(
  user: PortalUser,
  opportunityId: string,
): Promise<OpportunityRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return null;
  const snap = await db.collection(COLLECTIONS.opportunities).doc(opportunityId).get();
  if (!snap.exists) return null;
  return parseOpportunity(snap.id, snap.data() as Record<string, unknown>);
}

export interface ConvertLeadInput {
  opportunityName: string;
  /** Initial pipeline stage for the new opportunity (default `contacted`). */
  initialStage?: import("@/types/opportunity").OpportunityStage;
  amountMinor?: number;
  currency?: string;
  notes?: string;
}

export type ConvertLeadResult =
  | { ok: true; customerId: string; opportunityId: string }
  | { ok: false; message: string };

/**
 * Promotes `crmType` from lead → contact and creates a linked opportunity (single Firestore transaction).
 */
export async function convertLeadToContactWithOpportunity(
  user: PortalUser,
  customerId: string,
  input: ConvertLeadInput,
): Promise<ConvertLeadResult> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) {
    return { ok: false, message: "CRM is only available to admin or team members." };
  }

  const name = input.opportunityName.trim();
  if (!name) {
    return { ok: false, message: "Opportunity name is required." };
  }

  const customerRef = db.collection(COLLECTIONS.customers).doc(customerId);
  const customerSnap = await customerRef.get();
  if (!customerSnap.exists) {
    return { ok: false, message: "Customer not found." };
  }
  const customerData = customerSnap.data() as Record<string, unknown>;
  const crmType = customerData.crmType === "lead" ? "lead" : "contact";
  if (crmType !== "lead") {
    return { ok: false, message: "This profile is already a contact." };
  }

  const customFieldsRaw = customerData.customFields;
  const customFieldsSnapshot: Record<string, string> =
    customFieldsRaw && typeof customFieldsRaw === "object" && !Array.isArray(customFieldsRaw)
      ? Object.fromEntries(
          Object.entries(customFieldsRaw as Record<string, unknown>)
            .filter(([k, v]) => typeof k === "string" && typeof v === "string")
            .map(([k, v]) => [k, v as string]),
        )
      : {};

  const orgId = asString(customerData.organizationId) ?? user.organizationId ?? undefined;
  const initialStage = input.initialStage ?? "discovery";

  let opportunityIdResult = "";

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

      tx.update(customerRef, {
        crmType: "contact",
        updatedAt: FieldValue.serverTimestamp(),
      });

      const oppRef = db.collection(COLLECTIONS.opportunities).doc();
      opportunityIdResult = oppRef.id;

      const now = Timestamp.now();
      const payload: Record<string, unknown> = {
        customerId,
        name,
        stage: initialStage,
        customFieldsSnapshot,
        currency: (input.currency ?? "aud").toLowerCase(),
        createdAt: now,
        updatedAt: now,
        createdByUid: user.uid,
      };
      if (typeof input.amountMinor === "number" && Number.isFinite(input.amountMinor)) {
        payload.amountMinor = Math.round(input.amountMinor);
      }
      if (input.notes?.trim()) payload.notes = input.notes.trim();
      if (orgId) payload.organizationId = orgId;

      tx.set(oppRef, payload);
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Conversion failed.";
    return { ok: false, message };
  }

  const activityAt = Timestamp.now();
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId,
    type: "lead_converted",
    title: "Lead converted to contact",
    detail: name,
    actorUid: user.uid,
    createdAt: activityAt,
  });
  await db.collection(COLLECTIONS.customerActivities).add({
    customerId,
    type: "opportunity_created",
    title: "Opportunity created",
    detail: name,
    actorUid: user.uid,
    createdAt: Timestamp.fromMillis(activityAt.toMillis() + 1),
  });

  return { ok: true, customerId, opportunityId: opportunityIdResult };
}

export async function updateOpportunityStage(
  user: PortalUser,
  opportunityId: string,
  stage: import("@/types/opportunity").OpportunityStage,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return { ok: false, message: "Not allowed." };
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

export async function deleteOpportunitiesForCustomerDb(db: AdminDb, customerId: string): Promise<void> {
  const snap = await db.collection(COLLECTIONS.opportunities).where("customerId", "==", customerId).limit(400).get();
  if (snap.empty) return;
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  if (snap.size >= 400) await deleteOpportunitiesForCustomerDb(db, customerId);
}

/** Merge latest customer custom fields into the opportunity snapshot (optional upkeep). */
export async function syncOpportunityCustomFieldsFromCustomer(
  user: PortalUser,
  opportunityId: string,
  customer: CustomerRecord,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canStaffAccessCrm(user)) return { ok: false, message: "Not allowed." };
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
