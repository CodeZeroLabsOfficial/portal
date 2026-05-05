import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import type { ProposalBranding } from "@/types/proposal";
import type { ProposalTemplateRecord } from "@/types/proposal-template";
import type { PortalUser } from "@/types/user";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseBranding(raw: unknown): ProposalBranding | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const b = raw as Record<string, unknown>;
  const logoUrl = asString(b.logoUrl);
  const primaryColor = asString(b.primaryColor);
  const fontFamily = asString(b.fontFamily);
  if (!logoUrl && !primaryColor && !fontFamily) return undefined;
  return { logoUrl, primaryColor, fontFamily };
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

function canAccessTemplates(user: PortalUser): boolean {
  return user.role === "admin" || user.role === "team";
}

export async function listProposalTemplatesForOrg(user: PortalUser): Promise<ProposalTemplateRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !canAccessTemplates(user)) return [];
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
  if (!db || !canAccessTemplates(user)) return null;
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
