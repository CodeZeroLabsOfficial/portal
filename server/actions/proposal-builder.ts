"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import { hashSharePassword, sealProposalAccess, verifySharePassword } from "@/lib/proposal-share-crypto";
import { getAdminProposalRecord } from "@/server/firestore/portal-data";
import { getProposalRecordByShareToken } from "@/server/firestore/parse-proposal";
import { updateOpportunityStage } from "@/server/firestore/crm-opportunities";
import { PROPOSAL_UNLOCK_COOKIE } from "@/lib/proposal-public-session";

const saveDocSchema = z.object({
  proposalId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  document: z.unknown(),
});

const passwordSchema = z.object({
  shareToken: z.string().min(8),
  password: z.string().min(1).max(200),
});

const acceptSchema = z.object({
  shareToken: z.string().min(8),
  signerName: z.string().trim().min(2).max(200),
});

const packageSelectionSchema = z.object({
  shareToken: z.string().min(8),
  blockId: z.string().min(4),
  tierId: z.string().min(4),
  term: z.enum(["12_months", "24_months"]),
});

async function requireStaff() {
  const user = await getCurrentSessionUser();
  if (!user || !hasRole(user, ["admin", "team"])) return null;
  return user;
}

export async function saveProposalDocumentAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = saveDocSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid proposal payload." };
  }

  const existing = await getAdminProposalRecord(user, parsed.data.proposalId);
  if (!existing) return { ok: false, message: "Proposal not found." };

  const docInput =
    typeof parsed.data.document === "object" && parsed.data.document !== null
      ? (parsed.data.document as Record<string, unknown>)
      : {};
  const normalized = parseProposalDocument({
    ...docInput,
    title: parsed.data.title,
  });

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  await db
    .collection(COLLECTIONS.proposals)
    .doc(parsed.data.proposalId)
    .update({
      title: parsed.data.title,
      document: normalized,
      documentVersion: FieldValue.increment(1),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  revalidatePath("/admin");
  revalidatePath(`/admin/proposals/${parsed.data.proposalId}`);
  return { ok: true };
}

export async function sendProposalAction(
  proposalId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: "Unauthorized." };

  const existing = await getAdminProposalRecord(user, proposalId);
  if (!existing) return { ok: false, message: "Proposal not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.proposals).doc(proposalId);
  const snap = await ref.get();
  const prevSent = (snap.data() as Record<string, unknown> | undefined)?.sentAtMs;

  await ref.update({
    status: "sent",
    sentAtMs: typeof prevSent === "number" ? prevSent : now,
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (existing.opportunityId) {
    try {
      await updateOpportunityStage(user, existing.opportunityId, "proposal_sent");
    } catch {
      /* pipeline stage is best-effort */
    }
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/proposals/${proposalId}`);
  if (existing.opportunityId) {
    revalidatePath(`/admin/opportunities/${existing.opportunityId}`);
  }
  return { ok: true };
}

export async function setProposalSharePasswordAction(
  proposalId: string,
  password: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: "Unauthorized." };

  const existing = await getAdminProposalRecord(user, proposalId);
  if (!existing) return { ok: false, message: "Proposal not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  if (password === null || password === "") {
    await db
      .collection(COLLECTIONS.proposals)
      .doc(proposalId)
      .update({
        sharePasswordHash: FieldValue.delete(),
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
      });
  } else {
    if (password.length < 6) return { ok: false, message: "Password must be at least 6 characters." };
    const sharePasswordHash = hashSharePassword(password);
    await db
      .collection(COLLECTIONS.proposals)
      .doc(proposalId)
      .update({
        sharePasswordHash,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  revalidatePath(`/admin/proposals/${proposalId}`);
  return { ok: true };
}

export async function verifyProposalSharePasswordAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const proposal = await getProposalRecordByShareToken(parsed.data.shareToken);
  if (!proposal) return { ok: false, message: "Proposal not found." };

  if (!proposal.sharePasswordHash) {
    return { ok: true };
  }

  if (!verifySharePassword(parsed.data.password, proposal.sharePasswordHash)) {
    return { ok: false, message: "Incorrect password." };
  }

  const seal = sealProposalAccess(proposal.id);
  const cookieStore = await cookies();
  cookieStore.set(PROPOSAL_UNLOCK_COOKIE, seal, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return { ok: true };
}

export async function acceptProposalPublicAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please enter your full name." };

  const proposal = await getProposalRecordByShareToken(parsed.data.shareToken);
  if (!proposal) return { ok: false, message: "Proposal not found." };
  if (proposal.status === "draft") return { ok: false, message: "This proposal is not available yet." };
  if (proposal.status === "accepted") return { ok: false, message: "Already accepted." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Service unavailable." };

  const now = Date.now();
  await db
    .collection(COLLECTIONS.proposals)
    .doc(proposal.id)
    .update({
      status: "accepted",
      acceptedAtMs: now,
      acceptedByName: parsed.data.signerName,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
    });

  if (proposal.customerId) {
    await db.collection(COLLECTIONS.customerActivities).add({
      customerId: proposal.customerId,
      organizationId: proposal.organizationId,
      type: "other",
      title: "Proposal accepted",
      detail: `${proposal.title} — ${parsed.data.signerName}`,
      createdAt: Timestamp.now(),
    });
  }

  const webhook = process.env.PROPOSAL_ACCEPTED_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "proposal.accepted",
          proposalId: proposal.id,
          opportunityId: proposal.opportunityId,
          customerId: proposal.customerId,
          signerName: parsed.data.signerName,
          atMs: now,
        }),
      });
    } catch {
      /* optional webhook */
    }
  }

  revalidatePath(`/p/${parsed.data.shareToken}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/proposals/${proposal.id}`);
  if (proposal.opportunityId) {
    revalidatePath(`/admin/opportunities/${proposal.opportunityId}`);
  }

  return { ok: true };
}

export async function saveProposalPackageSelectionAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = packageSelectionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid package selection." };
  }

  const proposal = await getProposalRecordByShareToken(parsed.data.shareToken);
  if (!proposal || proposal.status === "draft") {
    return { ok: false, message: "Proposal not available." };
  }

  const block = proposal.document.blocks.find((b) => b.id === parsed.data.blockId);
  if (!block || block.type !== "packages") {
    return { ok: false, message: "Package block not found." };
  }

  const tier = block.tiers.find((t) => t.id === parsed.data.tierId);
  if (!tier) {
    return { ok: false, message: "That package tier no longer exists." };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const ref = db.collection(COLLECTIONS.proposals).doc(proposal.id);
  const snap = await ref.get();
  const prevRaw = snap.data()?.publicSelections;
  const prev =
    prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw)
      ? { ...(prevRaw as Record<string, unknown>) }
      : {};

  const now = Date.now();
  await ref.update({
    publicSelections: {
      ...prev,
      [parsed.data.blockId]: {
        kind: "packages",
        tierId: parsed.data.tierId,
        term: parsed.data.term,
        updatedAtMs: now,
      },
    },
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath(`/p/${parsed.data.shareToken}`);
  revalidatePath(`/admin/proposals/${proposal.id}`);
  return { ok: true };
}

export async function deleteProposalAction(
  proposalId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: "Unauthorized." };

  const trimmed = proposalId?.trim();
  if (!trimmed) return { ok: false, message: "Invalid proposal." };

  const existing = await getAdminProposalRecord(user, trimmed);
  if (!existing) return { ok: false, message: "Proposal not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  try {
    await db.collection(COLLECTIONS.proposals).doc(trimmed).delete();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not delete the proposal.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${trimmed}`);
  if (existing.customerId) {
    revalidatePath(`/admin/customers/${existing.customerId}`);
  }
  if (existing.opportunityId) {
    revalidatePath(`/admin/opportunities/${existing.opportunityId}`);
  }
  return { ok: true };
}
