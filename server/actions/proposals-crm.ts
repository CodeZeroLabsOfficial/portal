"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaffSession } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getCustomerRecordForOrg } from "@/server/firestore/crm-customers";
import { omitUndefinedDeep } from "@/lib/omit-undefined-deep";
import { getOpportunityForStaff, appendOpportunityActivity, updateOpportunityStage } from "@/server/firestore/crm-opportunities";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { cloneBrandingFromTemplate, cloneProposalDocument } from "@/lib/proposal-clone-document";
import { encodeProposalDocumentForFirestore } from "@/lib/proposal-firestore-document";
import { applyProposalTokensToDocument } from "@/lib/proposal-template-tokens";
import { hydrateAgreementBlocksInDocument } from "@/server/proposal/hydrate-agreement-contract-templates";
import { escapeHtml } from "@/lib/escape-html";
import { logError } from "@/lib/logging";
import type { CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type { ProposalBlock, ProposalBranding, ProposalDocument } from "@/types/proposal";
import type { PortalUser } from "@/types/user";

/** Label for automated CRM copy — prefers display name, then first/last, then email. */
function staffDisplayNameForActivity(user: PortalUser): string {
  const fromDisplay = user.displayName?.trim();
  if (fromDisplay) return fromDisplay;
  const fn = user.firstName?.trim() ?? "";
  const ln = user.lastName?.trim() ?? "";
  const combined = [fn, ln].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const email = user.email?.trim();
  if (email) return email;
  return "Team member";
}

function formatAddressLine(c: CustomerRecord): string {
  const parts = [c.addressLine1, c.addressLine2, c.city, c.region, c.postalCode, c.country].filter(
    Boolean,
  ) as string[];
  return parts.join(", ");
}

function formatCustomFields(cf: Record<string, string>): string {
  const entries = Object.entries(cf).filter(([k]) => k.trim());
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
}

/** Shared `Prepared for …` block used by every default proposal document. */
function buildContactLines(customer: CustomerRecord): string {
  const address = formatAddressLine(customer);
  return [
    customer.company ? `Company: ${customer.company}` : null,
    `Email: ${customer.email}`,
    customer.phone ? `Phone: ${customer.phone}` : null,
    address ? `Address: ${address}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrefilledProposalDocument(
  customer: CustomerRecord,
  opportunity: OpportunityRecord,
): ProposalDocument {
  const contactLines = buildContactLines(customer);
  const cfText = formatCustomFields({
    ...customer.customFields,
    ...opportunity.customFieldsSnapshot,
  });

  const blocks: ProposalBlock[] = [
    {
      id: randomUUID(),
      type: "header",
      text: opportunity.name,
      html: `<h2>${escapeHtml(opportunity.name)}</h2>`,
    },
    { id: randomUUID(), type: "text", body: `Prepared for ${customer.name}\n\n${contactLines}` },
  ];

  if (cfText) {
    blocks.push({ id: randomUUID(), type: "text", body: `Details\n${cfText}` });
  }

  const oppMeta: string[] = [];
  if (typeof opportunity.amountMinor === "number") {
    oppMeta.push(
      `Estimated value: ${(opportunity.amountMinor / 100).toLocaleString(undefined, {
        style: "currency",
        currency: opportunity.currency.toUpperCase(),
      })}`,
    );
  }
  if (opportunity.notes?.trim()) {
    oppMeta.push(`Notes: ${opportunity.notes.trim()}`);
  }
  if (oppMeta.length) {
    blocks.push({ id: randomUUID(), type: "text", body: `Opportunity\n${oppMeta.join("\n")}` });
  }

  return {
    title: `${opportunity.name} — ${customer.company ?? customer.name}`,
    blocks,
  };
}

function buildCustomerOnlyProposalDocument(customer: CustomerRecord): ProposalDocument {
  const contactLines = buildContactLines(customer);
  const cfText = formatCustomFields(customer.customFields);

  const blocks: ProposalBlock[] = [
    { id: randomUUID(), type: "header", text: "Proposal", html: "<h2>Proposal</h2>" },
    { id: randomUUID(), type: "text", body: `Prepared for ${customer.name}\n\n${contactLines}` },
  ];

  if (cfText) {
    blocks.push({ id: randomUUID(), type: "text", body: `Details\n${cfText}` });
  }

  return {
    title: `${customer.company ?? customer.name} — Proposal`,
    blocks,
  };
}

/** Generic error mapper for the two `createDraftProposal…Action` handlers. */
function proposalSaveErrorMessage(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : "Could not save the proposal. If this persists, check Firestore rules and that the document has no invalid fields.";
}

/**
 * Creates a draft proposal row from CRM customer + optional template (`{{client}}`, `{{email}}`, `{{company}}`, `{{date}}`, …).
 */
export async function createDraftProposalFromCustomerAction(
  customerId: string,
  templateId?: string | null,
): Promise<{ ok: true; proposalId: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return { ok: false, message: "Customer not found." };

  const recipientEmail = (customer.email ?? "").trim().toLowerCase();
  if (!recipientEmail) {
    return { ok: false, message: "Add an email address to this contact before creating a proposal." };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  let document: ProposalDocument;
  let branding: ProposalBranding | undefined;
  let sourceTemplateId: string | undefined;

  const tid = templateId?.trim();
  if (tid) {
    const template = await getProposalTemplateForStaff(user, tid);
    if (!template) return { ok: false, message: "Template not found." };
    document = applyProposalTokensToDocument(cloneProposalDocument(template.document), {
      customer,
      timeZone: user.timeZone?.trim() || undefined,
    });
    branding = cloneBrandingFromTemplate(template.branding);
    sourceTemplateId = template.id;
  } else {
    document = buildCustomerOnlyProposalDocument(customer);
  }

  try {
    const organizationId = user.organizationId ?? "default";
    const shareToken = randomUUID().replace(/-/g, "");

    const ref = db.collection(COLLECTIONS.proposals).doc();
    const payload: Record<string, unknown> = {
      organizationId,
      createdByUid: user.uid,
      title: document.title,
      customerId: customer.id,
      recipientEmail,
      status: "draft",
      shareToken,
      document: omitUndefinedDeep(encodeProposalDocumentForFirestore(document)),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (branding) {
      const b = omitUndefinedDeep(branding) as ProposalBranding;
      if (Object.keys(b as object).length > 0) payload.branding = b;
    }
    if (sourceTemplateId) payload.sourceTemplateId = sourceTemplateId;

    await ref.set(payload);

    revalidatePath("/admin");
    revalidatePath("/admin/proposals");
    revalidatePath(`/admin/proposals/${ref.id}`);
    revalidatePath(`/admin/customers/${customer.id}`);

    return { ok: true, proposalId: ref.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError("createDraftProposalFromCustomerAction_failed", { message: msg });
    return { ok: false, message: proposalSaveErrorMessage(err) };
  }
}

/**
 * Creates a draft proposal row with blocks pre-filled from the CRM customer, merged custom fields, and opportunity.
 * Optional `templateId` replaces the default generated layout with a cloned template (tokens applied).
 */
export async function createDraftProposalFromOpportunityAction(
  opportunityId: string,
  templateId?: string | null,
): Promise<{ ok: true; proposalId: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const opportunity = await getOpportunityForStaff(user, opportunityId);
  if (!opportunity) return { ok: false, message: "Opportunity not found." };

  const customer = await getCustomerRecordForOrg(user, opportunity.customerId);
  if (!customer) return { ok: false, message: "Customer not found." };

  const recipientEmail = (customer.email ?? "").trim().toLowerCase();
  if (!recipientEmail) {
    return {
      ok: false,
      message: "This opportunity's contact needs an email address before creating a proposal.",
    };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  let document: ProposalDocument;
  let branding: ProposalBranding | undefined;
  let sourceTemplateId: string | undefined;

  const tid = templateId?.trim();
  if (tid) {
    const template = await getProposalTemplateForStaff(user, tid);
    if (!template) return { ok: false, message: "Template not found." };
    document = applyProposalTokensToDocument(cloneProposalDocument(template.document), {
      customer,
      opportunity,
      timeZone: user.timeZone?.trim() || undefined,
    });
    branding = cloneBrandingFromTemplate(template.branding);
    sourceTemplateId = template.id;
  } else {
    document = buildPrefilledProposalDocument(customer, opportunity);
  }

  const organizationId = user.organizationId ?? "default";
  document = await hydrateAgreementBlocksInDocument(document, organizationId);

  try {
    const shareToken = randomUUID().replace(/-/g, "");

    const ref = db.collection(COLLECTIONS.proposals).doc();
    const payload: Record<string, unknown> = {
      organizationId,
      createdByUid: user.uid,
      title: document.title,
      customerId: customer.id,
      opportunityId: opportunity.id,
      recipientEmail,
      status: "draft",
      shareToken,
      document: omitUndefinedDeep(encodeProposalDocumentForFirestore(document)),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (branding) {
      const b = omitUndefinedDeep(branding) as ProposalBranding;
      if (Object.keys(b as object).length > 0) payload.branding = b;
    }
    if (sourceTemplateId) payload.sourceTemplateId = sourceTemplateId;

    await ref.set(payload);

    try {
      const activityRes = await appendOpportunityActivity(user, opportunityId, {
        kind: "other",
        title: `Proposal created by ${staffDisplayNameForActivity(user)}`,
        detail: document.title.trim(),
      });
      if (!activityRes.ok) {
        logError("createDraftProposalFromOpportunity_activity_failed", {
          opportunityId,
          message: activityRes.message,
        });
      }
    } catch (e) {
      logError("createDraftProposalFromOpportunity_activity_failed", {
        opportunityId,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const stageRes = await updateOpportunityStage(user, opportunityId, "proposal_sent");
      if (!stageRes.ok) {
        logError("createDraftProposalFromOpportunity_stage_failed", {
          opportunityId,
          message: stageRes.message,
        });
      }
    } catch (e) {
      logError("createDraftProposalFromOpportunity_stage_failed", {
        opportunityId,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/proposals");
    revalidatePath(`/admin/proposals/${ref.id}`);
    revalidatePath(`/admin/customers/${customer.id}`);
    revalidatePath(`/admin/opportunities/${opportunityId}`);

    return { ok: true, proposalId: ref.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError("createDraftProposalFromOpportunityAction_failed", { message: msg });
    return { ok: false, message: proposalSaveErrorMessage(err) };
  }
}
