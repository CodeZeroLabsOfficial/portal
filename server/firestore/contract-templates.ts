import { isStaff } from "@/lib/auth/server-session";
import { asString } from "@/lib/firestore/coerce";
import { millisFromFirestore } from "@/lib/firestore/timestamp";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import type { ContractTemplateRecord } from "@/types/contract-template";
import type { PortalUser } from "@/types/user";

export function parseContractTemplateRecord(id: string, data: Record<string, unknown>): ContractTemplateRecord {
  return {
    id,
    organizationId: asString(data.organizationId) ?? "",
    createdByUid: asString(data.createdByUid) ?? "",
    name: asString(data.name) ?? "Untitled contract",
    description: asString(data.description),
    agreementTitle: asString(data.agreementTitle)?.trim() || "Services Agreement",
    introHtml: asString(data.introHtml),
    legalHtml: asString(data.legalHtml) ?? "",
    createdAt: millisFromFirestore(data, "createdAt"),
    updatedAt: millisFromFirestore(data, "updatedAt"),
  };
}

export async function listContractTemplatesForOrg(user: PortalUser): Promise<ContractTemplateRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  const orgId = user.organizationId ?? "default";
  try {
    const snap = await db
      .collection(COLLECTIONS.contractTemplates)
      .where("organizationId", "==", orgId)
      .limit(200)
      .get();
    return snap.docs.map((d) => parseContractTemplateRecord(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getContractTemplateForStaff(
  user: PortalUser,
  templateId: string,
): Promise<ContractTemplateRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return null;
  const orgId = user.organizationId ?? "default";
  try {
    const ref = db.collection(COLLECTIONS.contractTemplates).doc(templateId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const data = snap.data() as Record<string, unknown>;
    if (asString(data.organizationId) !== orgId) return null;
    return parseContractTemplateRecord(snap.id, data);
  } catch {
    return null;
  }
}
