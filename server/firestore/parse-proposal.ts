import { COLLECTIONS } from "@/server/firestore/collections";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import type {
  ProposalBlock,
  ProposalBranding,
  ProposalPublicSelections,
  ProposalRecord,
  ProposalStatus,
} from "@/types/proposal";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseProposalBlocks(raw: unknown): ProposalBlock[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const doc = parseProposalDocument({ title: "x", blocks: raw });
  return doc.blocks;
}

function parseStatus(raw: unknown): ProposalStatus {
  const s = typeof raw === "string" ? raw : "";
  if (
    s === "draft" ||
    s === "sent" ||
    s === "viewed" ||
    s === "accepted" ||
    s === "declined" ||
    s === "expired"
  ) {
    return s;
  }
  return "sent";
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

function parsePublicSelections(raw: unknown): ProposalPublicSelections | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: ProposalPublicSelections = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    if (o.kind !== "packages") continue;
    const tierId = asString(o.tierId);
    const billing = o.billing === "monthly" || o.billing === "yearly" ? o.billing : undefined;
    if (!tierId || !billing) continue;
    const qRaw = asNumber(o.quantity);
    const quantity = qRaw !== undefined && qRaw >= 1 ? Math.min(1_000_000, Math.floor(qRaw)) : 1;
    out[key] = {
      kind: "packages",
      tierId,
      billing,
      quantity,
      updatedAtMs: asNumber(o.updatedAtMs) ?? Date.now(),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Parse a Firestore `proposals/{id}` document into a typed record (Admin SDK reads).
 */
export function parseProposalRecord(id: string, data: Record<string, unknown>): ProposalRecord {
  const documentRaw = data.document && typeof data.document === "object" ? data.document : {};
  const document = parseProposalDocument({
    ...(documentRaw as object),
    title: asString(data.title) ?? (documentRaw as { title?: string }).title ?? "Untitled proposal",
  });

  return {
    id,
    organizationId: asString(data.organizationId) ?? "",
    createdByUid: asString(data.createdByUid) ?? "",
    title: asString(data.title) ?? document.title ?? "Untitled proposal",
    customerId: asString(data.customerId),
    opportunityId: asString(data.opportunityId),
    recipientEmail: asString(data.recipientEmail) ?? asString(data.customerEmail),
    status: parseStatus(data.status),
    shareToken: asString(data.shareToken) ?? "",
    document,
    branding: parseBranding(data.branding),
    documentVersion: asNumber(data.documentVersion),
    sharePasswordHash: asString(data.sharePasswordHash),
    sentAtMs: asNumber(data.sentAtMs),
    viewCount: asNumber(data.viewCount),
    totalEngagementSeconds: asNumber(data.totalEngagementSeconds),
    lastViewedAtMs: asNumber(data.lastViewedAtMs),
    acceptedAtMs: asNumber(data.acceptedAtMs),
    acceptedByName: asString(data.acceptedByName),
    stripePaymentIntentId: asString(data.stripePaymentIntentId),
    publicSelections: parsePublicSelections(data.publicSelections),
    createdAtMs: asNumber(data.createdAtMs) ?? 0,
    updatedAtMs: asNumber(data.updatedAtMs) ?? 0,
  };
}

export async function getProposalRecordByShareToken(shareToken: string): Promise<ProposalRecord | null> {
  const token = shareToken?.trim();
  if (!token || token.length < 8) return null;

  const db = getFirebaseAdminFirestore();
  if (!db) return null;

  try {
    const snap = await db.collection(COLLECTIONS.proposals).where("shareToken", "==", token).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return parseProposalRecord(doc.id, doc.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}
