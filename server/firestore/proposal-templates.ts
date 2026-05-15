import type { Firestore } from "firebase-admin/firestore";
import { isStaff } from "@/lib/auth/server-session";
import { asNumber, asString } from "@/lib/firestore/coerce";
import { millisFromFirestore } from "@/lib/firestore/timestamp";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import { parseBranding } from "@/server/firestore/parse-proposal";
import type {
  ProposalTemplateRecord,
  ProposalTemplateStage,
  ProposalTemplateType,
} from "@/types/proposal-template";
import type { PortalUser } from "@/types/user";

function parseProposalTemplateType(data: Record<string, unknown>): ProposalTemplateType {
  const raw = asString(data.templateType)?.trim().toLowerCase();
  if (raw === "contract") return "contract";
  return "proposal";
}

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

  const stageRaw = asString(data.stage);
  const stage: ProposalTemplateStage =
    stageRaw === "draft" || stageRaw === "published" ? stageRaw : "published";

  return {
    id,
    organizationId: asString(data.organizationId) ?? "",
    createdByUid: asString(data.createdByUid) ?? "",
    name: asString(data.name) ?? "Untitled template",
    description: asString(data.description),
    templateType: parseProposalTemplateType(data),
    stage,
    document,
    branding: parseBranding(data.branding),
    createdAt: millisFromFirestore(data, "createdAt"),
    updatedAt: millisFromFirestore(data, "updatedAt"),
  };
}

/**
 * Admin read (e.g. public proposal acceptance) — returns the template `name` when
 * the row exists and belongs to `organizationId`.
 */
export async function getProposalTemplateNameForOrganization(
  db: Firestore,
  organizationId: string,
  templateId: string,
): Promise<string | null> {
  const tid = templateId.trim();
  const org = organizationId.trim();
  if (!tid || !org) return null;
  try {
    const snap = await db.collection(COLLECTIONS.proposalTemplates).doc(tid).get();
    if (!snap.exists) return null;
    const data = snap.data() as Record<string, unknown>;
    const rowOrg = asString(data.organizationId)?.trim() ?? "";
    if (rowOrg !== org) return null;
    const name = asString(data.name)?.trim();
    return name && name.length > 0 ? name : null;
  } catch {
    return null;
  }
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
