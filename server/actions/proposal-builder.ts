"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { softenPublicFirestoreErrorMessage } from "@/lib/firebase/public-error-messages";
import { omitUndefinedDeep } from "@/lib/omit-undefined-deep";
import { COLLECTIONS } from "@/server/firestore/collections";
import { encodeProposalDocumentForFirestore } from "@/lib/proposal-firestore-document";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import { hydrateAgreementBlocksInDocument } from "@/server/proposal/hydrate-agreement-contract-templates";
import { effectivePricingLineQuantity } from "@/lib/pricing-line-quantity";
import { findProposalBlockById } from "@/lib/proposal-blocks";
import { hashSharePassword, sealProposalAccess, verifySharePassword } from "@/lib/proposal-share-crypto";
import { getAdminProposalRecord } from "@/server/firestore/portal-data";
import { getProposalRecordByShareToken } from "@/server/firestore/parse-proposal";
import {
  applyProposalAcceptCrmSideEffects,
  persistCustomerSubscriptionIntentAfterAccept,
} from "@/server/firestore/proposal-accept-crm";
import { getProposalTemplateNameForOrganization } from "@/server/firestore/proposal-templates";
import { updateOpportunityStage } from "@/server/firestore/crm-opportunities";
import { PROPOSAL_UNLOCK_COOKIE } from "@/lib/proposal-public-session";
import { cloneProposalDocument } from "@/lib/proposal-clone-document";
import {
  isProposalPackageSelectionComplete,
  isPublicProposalPackageSelectionsLocked,
} from "@/lib/proposal-package-selection";
import { loadBillingCatalogForOrganization } from "@/server/catalog/billing-catalog";
import { resolveSubscriptionStripePriceIdForProposalWithStripe } from "@/server/stripe/resolve-proposal-subscription-with-catalog";
import { runAdminWrite } from "@/lib/firebase/admin-write";
import { uploadSignedAgreementSignaturePng } from "@/lib/firebase/admin-storage";
import {
  buildFullAgreementTextSnapshot,
  buildSignedAgreementCommerceSnapshot,
} from "@/lib/signed-agreement-build";
import type { ProposalRecord } from "@/types/proposal";
import type { PortalUser } from "@/types/user";

const saveDocSchema = z.object({
  proposalId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  document: z.unknown(),
});

const passwordSchema = z.object({
  shareToken: z.string().min(8),
  password: z.string().min(1).max(200),
});

const SIGNATURE_DATA_URL_MAX = 750_000;

const acceptSchema = z.object({
  shareToken: z.string().min(8),
  signerName: z.string().trim().min(2).max(200),
  signerEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email().max(320).optional(),
  ),
  signerOrganization: z.string().trim().max(500).optional(),
  signatureDataUrl: z
    .string()
    .max(SIGNATURE_DATA_URL_MAX)
    .optional()
    .refine(
      (s) =>
        s === undefined ||
        (typeof s === "string" && s.startsWith("data:image/png;base64,") && s.length > 32),
      "Invalid signature image.",
    ),
  signatureMethod: z.enum(["draw", "type", "upload"]).optional(),
  clientSignedAt: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
});

const packageSelectionSchema = z.object({
  shareToken: z.string().min(8),
  blockId: z.string().min(4),
  tierId: z.string().min(4).optional(),
  term: z.enum(["12_months", "24_months"]).optional(),
  addonQuantities: z.record(z.string(), z.number().finite().min(0)).optional(),
  addonOptionalOff: z.record(z.string(), z.boolean()).optional(),
});

export async function saveProposalDocumentAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
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
  const hydrated = await hydrateAgreementBlocksInDocument(
    normalized,
    user.organizationId ?? "default",
  );

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "proposal_save_failed",
    { proposalId: parsed.data.proposalId },
    "Could not save proposal.",
    () =>
      db
        .collection(COLLECTIONS.proposals)
        .doc(parsed.data.proposalId)
        .update({
          title: parsed.data.title,
          document: omitUndefinedDeep(encodeProposalDocumentForFirestore(hydrated)) as Record<string, unknown>,
          documentVersion: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        }),
  );
  if (!write.ok) return write;

  revalidatePath("/admin");
  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${parsed.data.proposalId}`);
  return { ok: true };
}

export async function sendProposalAction(
  proposalId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const existing = await getAdminProposalRecord(user, proposalId);
  if (!existing) return { ok: false, message: "Proposal not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.proposals).doc(proposalId);
  const snap = await ref.get();
  const prevSent = (snap.data() as Record<string, unknown> | undefined)?.sentAt;

  const write = await runAdminWrite(
    "proposal_send_failed",
    { proposalId },
    "Could not publish proposal.",
    () =>
      ref.update({
        status: "published",
        sentAt: typeof prevSent === "number" ? prevSent : now,
        updatedAt: FieldValue.serverTimestamp(),
      }),
  );
  if (!write.ok) return write;

  if (existing.opportunityId) {
    try {
      await updateOpportunityStage(user, existing.opportunityId, "proposal_sent");
    } catch {
      /* pipeline stage is best-effort */
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/proposals");
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
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const existing = await getAdminProposalRecord(user, proposalId);
  if (!existing) return { ok: false, message: "Proposal not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  if (password === null || password === "") {
    const write = await runAdminWrite(
      "proposal_share_password_clear_failed",
      { proposalId },
      "Could not clear the share password.",
      () =>
        db
          .collection(COLLECTIONS.proposals)
          .doc(proposalId)
          .update({
            sharePasswordHash: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          }),
    );
    if (!write.ok) return write;
  } else {
    if (password.length < 6) return { ok: false, message: "Password must be at least 6 characters." };
    const sharePasswordHash = hashSharePassword(password);
    const write = await runAdminWrite(
      "proposal_share_password_set_failed",
      { proposalId },
      "Could not set the share password.",
      () =>
        db
          .collection(COLLECTIONS.proposals)
          .doc(proposalId)
          .update({
            sharePasswordHash,
            updatedAt: FieldValue.serverTimestamp(),
          }),
    );
    if (!write.ok) return write;
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
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg =
      first?.message === "Invalid signature image."
        ? "Could not read the signature image. Try clearing and signing again."
        : first?.path?.[0] === "signerEmail"
          ? "Please enter a valid email address."
          : "Please enter your full name.";
    return { ok: false, message: msg };
  }

  const proposal = await getProposalRecordByShareToken(parsed.data.shareToken);
  if (!proposal) return { ok: false, message: "Proposal not found." };
  if (proposal.status === "draft") return { ok: false, message: "This proposal is not available yet." };
  if (proposal.status === "accepted") return { ok: false, message: "Already accepted." };

  const hydratedDocument = await hydrateAgreementBlocksInDocument(
    proposal.document,
    proposal.organizationId,
  );
  const proposalForAgreement =
    hydratedDocument === proposal.document ? proposal : { ...proposal, document: hydratedDocument };

  if (!isProposalPackageSelectionComplete(proposal)) {
    return {
      ok: false,
      message: "Please select a plan in the proposal above before signing the agreement.",
    };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Service unavailable." };

  const now = Date.now();
  const sigUrl = parsed.data.signatureDataUrl;
  const sigMethod = parsed.data.signatureMethod;
  const clientSignedAt = parsed.data.clientSignedAt;
  const hasSignaturePayload = Boolean(sigUrl && sigMethod);
  if (sigUrl && !sigMethod) {
    return { ok: false, message: "Invalid signature payload." };
  }
  if (sigMethod && !sigUrl) {
    return { ok: false, message: "Invalid signature payload." };
  }

  const write = await runAdminWrite(
    "proposal_accept_failed",
    { proposalId: proposal.id, shareToken: parsed.data.shareToken },
    "Could not record acceptance.",
    () =>
      db
        .collection(COLLECTIONS.proposals)
        .doc(proposal.id)
        .update({
          status: "accepted",
          acceptedAt: now,
          acceptedByName: parsed.data.signerName,
          ...(hasSignaturePayload
            ? {
                acceptedSignatureDataUrl: sigUrl,
                acceptedSignatureMethod: sigMethod,
                ...(typeof clientSignedAt === "number"
                  ? { acceptedClientSignedAt: clientSignedAt }
                  : {}),
              }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        }),
  );
  if (!write.ok) {
    return { ok: false, message: softenPublicFirestoreErrorMessage(write.message) };
  }

  await applyProposalAcceptCrmSideEffects(db, proposal, parsed.data.signerName);

  const stripeSubscriptionPriceId = await resolveSubscriptionStripePriceIdForProposalWithStripe(proposal);
  const billingCatalog = await loadBillingCatalogForOrganization(proposal.organizationId);
  const commerceSnapshot = buildSignedAgreementCommerceSnapshot(
    proposalForAgreement,
    billingCatalog.catalogServices,
  );
  if (proposal.customerId && stripeSubscriptionPriceId) {
    await persistCustomerSubscriptionIntentAfterAccept(
      db,
      proposal,
      stripeSubscriptionPriceId,
      commerceSnapshot.selectedPlan,
      now,
    );
  }

  if (hasSignaturePayload && sigUrl) {
    const commerce = commerceSnapshot;
    const fullAgreementText = buildFullAgreementTextSnapshot(proposalForAgreement);

    let customerName: string | undefined;
    if (proposal.customerId) {
      try {
        const csnap = await db.collection(COLLECTIONS.customers).doc(proposal.customerId).get();
        if (csnap.exists) {
          const c = csnap.data() as Record<string, unknown>;
          const company = typeof c.company === "string" ? c.company.trim() : "";
          const name = typeof c.name === "string" ? c.name.trim() : "";
          customerName = company || name || undefined;
        }
      } catch {
        /* best-effort */
      }
    }

    const INLINE_SIGNATURE_MAX = 480_000;
    let signatureImage: string | null = null;
    let signatureImageStoragePath: string | null = null;

    const uploaded = await uploadSignedAgreementSignaturePng({
      proposalId: proposal.id,
      dataUrlPng: sigUrl,
    });
    if (uploaded?.storagePath) {
      signatureImageStoragePath = uploaded.storagePath;
    } else if (sigUrl.length <= INLINE_SIGNATURE_MAX) {
      signatureImage = sigUrl;
    }

    const signedAgreementPayload: Record<string, unknown> = {
      organizationId: proposal.organizationId,
      proposalId: proposal.id,
      shareToken: proposal.shareToken,
      proposalTitle: proposal.title,
      customerId: proposal.customerId ?? null,
      customerEmail: proposal.recipientEmail?.trim().toLowerCase() ?? null,
      customerName: customerName ?? null,
      selectedPlan: commerce.selectedPlan,
      addons: commerce.addons,
      totalAmount: commerce.totalAmount,
      signerName: parsed.data.signerName,
      signerEmail:
        parsed.data.signerEmail?.trim().toLowerCase() ??
        proposal.recipientEmail?.trim().toLowerCase() ??
        null,
      signerOrganization: parsed.data.signerOrganization?.trim() || null,
      signatureMethod: sigMethod ?? null,
      signedAt: now,
      clientSignedAt: typeof clientSignedAt === "number" ? clientSignedAt : null,
      fullAgreementText: fullAgreementText ?? null,
      signatureImage,
      signatureImageStoragePath,
      stripeSubscriptionPriceId: stripeSubscriptionPriceId ?? null,
    };

    await runAdminWrite(
      "signed_agreement_write_failed",
      { proposalId: proposal.id },
      "Could not store signed agreement record.",
      () => db.collection(COLLECTIONS.signedAgreements).add(signedAgreementPayload),
    );
  }

  if (proposal.customerId) {
    const signerDisplayName = parsed.data.signerName.trim();
    const sourceTemplateId = proposal.sourceTemplateId?.trim();
    const templateName =
      sourceTemplateId
        ? await getProposalTemplateNameForOrganization(db, proposal.organizationId, sourceTemplateId)
        : null;
    const activityDetail = (sourceTemplateId ? templateName : null) ?? proposal.title.trim();

    /** Activity entry is best-effort — failure here must not roll back the
     *  acceptance we just recorded. */
    await runAdminWrite(
      "proposal_accept_activity_failed",
      { proposalId: proposal.id, customerId: proposal.customerId },
      "Could not record acceptance activity.",
      () =>
        db.collection(COLLECTIONS.customerActivities).add({
          customerId: proposal.customerId,
          organizationId: proposal.organizationId,
          type: "other",
          title: `Proposal accepted by ${signerDisplayName}`,
          detail: activityDetail,
          createdAt: Timestamp.now(),
        }),
    );
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
          signerEmail: parsed.data.signerEmail ?? proposal.recipientEmail?.trim().toLowerCase() ?? null,
          atMs: now,
          signatureMethod: sigMethod ?? null,
          hasSignatureImage: Boolean(sigUrl),
          clientSignedAt: clientSignedAt ?? null,
        }),
      });
    } catch {
      /* optional webhook */
    }
  }

  revalidatePath(`/p/${parsed.data.shareToken}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/proposals/${proposal.id}`);
  if (proposal.customerId) {
    revalidatePath(`/admin/customers/${proposal.customerId}`);
  }
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
  if (isPublicProposalPackageSelectionsLocked(proposal.status)) {
    return { ok: false, message: "This proposal is locked — plan and add-on selections cannot be changed." };
  }

  const block = findProposalBlockById(proposal.document.blocks, parsed.data.blockId);
  if (!block || block.type !== "packages") {
    return { ok: false, message: "Package block not found." };
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

  const prevEntry = prev[parsed.data.blockId] as
    | { tierId?: string; term?: string; addonQuantities?: Record<string, number>; addonOptionalOff?: Record<string, boolean> }
    | undefined;

  const nextTierId = parsed.data.tierId ?? prevEntry?.tierId;
  if (!nextTierId || typeof nextTierId !== "string") {
    return { ok: false, message: "Select a package tier first." };
  }

  const tier = block.tiers.find((t) => t.id === nextTierId);
  if (!tier) {
    return { ok: false, message: "That package tier no longer exists." };
  }

  const nextTerm =
    parsed.data.term === "12_months" || parsed.data.term === "24_months"
      ? parsed.data.term
      : prevEntry?.term === "12_months" || prevEntry?.term === "24_months"
        ? prevEntry.term
        : "24_months";

  const addonLines = block.addonLineItems ?? [];
  const mergedQty: Record<string, number> = {};
  for (const li of addonLines) {
    const incoming = parsed.data.addonQuantities?.[li.id];
    const fromPrev = prevEntry?.addonQuantities?.[li.id];
    if (typeof incoming === "number" && Number.isFinite(incoming)) {
      mergedQty[li.id] = Math.max(0, Math.floor(incoming));
    } else if (typeof fromPrev === "number" && Number.isFinite(fromPrev)) {
      mergedQty[li.id] = Math.max(0, Math.floor(fromPrev));
    } else {
      mergedQty[li.id] = effectivePricingLineQuantity(li);
    }
  }

  const now = Date.now();
  const selectionPayload: Record<string, unknown> = {
    kind: "packages",
    tierId: nextTierId,
    term: nextTerm,
    updatedAt: now,
  };
  if (addonLines.length > 0 && Object.keys(mergedQty).length > 0) {
    selectionPayload.addonQuantities = mergedQty;
  }

  const write = await runAdminWrite(
    "proposal_package_selection_failed",
    { proposalId: proposal.id, blockId: parsed.data.blockId, tierId: nextTierId },
    "Could not save your selection.",
    () =>
      ref.update({
        publicSelections: {
          ...prev,
          [parsed.data.blockId]: selectionPayload,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }),
  );
  if (!write.ok) return write;

  revalidatePath(`/p/${parsed.data.shareToken}`);
  revalidatePath(`/admin/proposals/${proposal.id}`);
  return { ok: true };
}

function staffCanAccessProposal(user: PortalUser, p: ProposalRecord): boolean {
  if (user.organizationId) return p.organizationId === user.organizationId;
  return p.createdByUid === user.uid;
}

const PROPOSAL_TITLE_MAX = 500;
const PROPOSAL_CLONE_TITLE_SUFFIX = " (copy)";

export async function deleteProposalAction(
  proposalId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const trimmed = proposalId?.trim();
  if (!trimmed) return { ok: false, message: "Invalid proposal." };

  const existing = await getAdminProposalRecord(user, trimmed);
  if (!existing || !staffCanAccessProposal(user, existing)) {
    return { ok: false, message: "Proposal not found." };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "proposal_delete_failed",
    { proposalId: trimmed },
    "Could not delete the proposal.",
    () => db.collection(COLLECTIONS.proposals).doc(trimmed).delete(),
  );
  if (!write.ok) return write;

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

export async function cloneProposalAction(
  proposalId: string,
): Promise<{ ok: true; proposalId: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const trimmed = proposalId?.trim();
  if (!trimmed) return { ok: false, message: "Invalid proposal." };

  const existing = await getAdminProposalRecord(user, trimmed);
  if (!existing || !staffCanAccessProposal(user, existing)) {
    return { ok: false, message: "Proposal not found." };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const baseTitle =
    (existing.title || existing.document.title || "Untitled proposal").trim() || "Untitled proposal";
  const maxBase = Math.max(1, PROPOSAL_TITLE_MAX - PROPOSAL_CLONE_TITLE_SUFFIX.length);
  const newTitle =
    baseTitle.length + PROPOSAL_CLONE_TITLE_SUFFIX.length <= PROPOSAL_TITLE_MAX
      ? `${baseTitle}${PROPOSAL_CLONE_TITLE_SUFFIX}`
      : `${baseTitle.slice(0, maxBase)}${PROPOSAL_CLONE_TITLE_SUFFIX}`;

  const clonedDoc = cloneProposalDocument(existing.document);
  clonedDoc.title = newTitle;

  const now = Date.now();
  const shareToken = randomUUID().replace(/-/g, "");
  const ref = db.collection(COLLECTIONS.proposals).doc();

  const payload: Record<string, unknown> = {
    organizationId: existing.organizationId,
    createdByUid: user.uid,
    title: newTitle,
    status: "draft",
    shareToken,
    document: omitUndefinedDeep(encodeProposalDocumentForFirestore(clonedDoc)),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (existing.customerId) payload.customerId = existing.customerId;
  if (existing.opportunityId) payload.opportunityId = existing.opportunityId;
  if (existing.recipientEmail?.trim()) payload.recipientEmail = existing.recipientEmail.trim().toLowerCase();
  if (existing.branding) {
    const b = omitUndefinedDeep(existing.branding) as Record<string, unknown>;
    if (Object.keys(b).length > 0) payload.branding = b;
  }
  if (existing.sourceTemplateId) payload.sourceTemplateId = existing.sourceTemplateId;

  const write = await runAdminWrite(
    "proposal_clone_failed",
    { sourceProposalId: trimmed, proposalId: ref.id },
    "Could not clone the proposal.",
    () => ref.set(payload),
  );
  if (!write.ok) return write;

  revalidatePath("/admin");
  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${ref.id}`);
  if (existing.customerId) {
    revalidatePath(`/admin/customers/${existing.customerId}`);
  }
  if (existing.opportunityId) {
    revalidatePath(`/admin/opportunities/${existing.opportunityId}`);
  }
  return { ok: true, proposalId: ref.id };
}
