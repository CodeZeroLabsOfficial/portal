import { isStaff } from "@/lib/auth/server-session";
import { asString } from "@/lib/firestore/coerce";
import { millisFromFirestore } from "@/lib/firestore/timestamp";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import type { ContractTemplateRecord } from "@/types/contract-template";
import type { ProposalTemplateStage } from "@/types/proposal-template";
import type { PortalUser } from "@/types/user";

export function parseContractTemplateRecord(id: string, data: Record<string, unknown>): ContractTemplateRecord {
  let document: ContractTemplateRecord["document"];
  if (data.document && typeof data.document === "object") {
    try {
      document = parseProposalDocument(data.document);
    } catch {
      document = undefined;
    }
  }

  const stageRaw = asString(data.stage);
  const stage: ProposalTemplateStage =
    stageRaw === "draft" || stageRaw === "published" ? stageRaw : "published";

  return {
    id,
    organizationId: asString(data.organizationId) ?? "",
    createdByUid: asString(data.createdByUid) ?? "",
    name: asString(data.name) ?? "Untitled contract",
    description: asString(data.description),
    agreementTitle: asString(data.agreementTitle)?.trim() || "Services Agreement",
    stage,
    document,
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

/** Batch load contract templates for agreement hydration (public proposals, template save). */
export async function getContractTemplatesForOrgByIds(
  organizationId: string,
  templateIds: string[],
): Promise<ContractTemplateRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || templateIds.length === 0) return [];

  const orgId = organizationId?.trim() || "default";
  const unique = [...new Set(templateIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  try {
    const refs = unique.map((id) => db.collection(COLLECTIONS.contractTemplates).doc(id));
    const snaps = await db.getAll(...refs);
    const out: ContractTemplateRecord[] = [];
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data() as Record<string, unknown>;
      if (asString(data.organizationId) !== orgId) continue;
      out.push(parseContractTemplateRecord(snap.id, data));
    }
    return out;
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
