import { isStaff } from "@/lib/auth/server-session";
import { asNumber, asString } from "@/lib/firestore/coerce";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import { parseBranding } from "@/server/firestore/parse-proposal";
import type { ProposalTemplateRecord } from "@/types/proposal-template";
import type { PortalUser } from "@/types/user";

export function parseProposalTemplateRecord(id: string, data: Record<string, unknown>): ProposalTemplateRecord {
  const documentRaw = data.document && typeof data.document === "object" ? data.document : {};
  const docTitle =
    typeof (documentRaw as { title?: unknown }).title === "string"
      ? String((documentRaw as { title: string }).title)
      : "Untitled proposal";
  const document = parseProposalDocument({
    ...(documentRaw as object),
    title: docTitle,
  });

  return {
    id,
    organizationId: asString(data.organizationId) ?? "",
    createdByUid: asString(data.createdByUid) ?? "",
    name: asString(data.name) ?? "Untitled template",
    description: asString(data.description),
    document,
    branding: parseBranding(data.branding),
    createdAtMs: asNumber(data.createdAtMs) ?? 0,
    updatedAtMs: asNumber(data.updatedAtMs) ?? 0,
  };
}

export async function listProposalTemplatesForOrg(user: PortalUser): Promise<ProposalTemplateRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  const orgId = user.organizationId ?? "default";
  try {
    const snap = await db
      .collection(COLLECTIONS.proposalTemplates)
      .where("organizationId", "==", orgId)
      .limit(100)
      .get();
    return snap.docs.map((d) => parseProposalTemplateRecord(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getProposalTemplateForStaff(
  user: PortalUser,
  templateId: string,
): Promise<ProposalTemplateRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return null;
  const orgId = user.organizationId ?? "default";
  try {
    const ref = db.collection(COLLECTIONS.proposalTemplates).doc(templateId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const data = snap.data() as Record<string, unknown>;
    if (asString(data.organizationId) !== orgId) return null;
    return parseProposalTemplateRecord(snap.id, data);
  } catch {
    return null;
  }
}
