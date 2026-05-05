"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getCustomerRecordForOrg } from "@/server/firestore/crm-customers";
import { getOpportunityForStaff } from "@/server/firestore/crm-opportunities";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { cloneBrandingFromTemplate, cloneProposalDocument } from "@/lib/proposal-clone-document";
import { applyProposalTokensToDocument } from "@/lib/proposal-template-tokens";
import { logError } from "@/lib/logging";
import type { CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type { ProposalBlock, ProposalBranding, ProposalDocument } from "@/types/proposal";

async function requireStaffForCrm() {
  const user = await getCurrentSessionUser();
  if (!user || !hasRole(user, ["admin", "team"])) return null;
  return user;
}

/** Firestore rejects `undefined` anywhere under a document — strip before `set`. */
function omitUndefinedDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item));
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = omitUndefinedDeep(v);
  }
  return out;
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

function buildPrefilledProposalDocument(
  customer: CustomerRecord,
  opportunity: OpportunityRecord,
): ProposalDocument {
  const contactLines = [
    customer.company ? `Company: ${customer.company}` : null,
    `Email: ${customer.email}`,
    customer.phone ? `Phone: ${customer.phone}` : null,
    formatAddressLine(customer) ? `Address: ${formatAddressLine(customer)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const cfMerged = {
    ...customer.customFields,
    ...opportunity.customFieldsSnapshot,
  };
  const cfText = formatCustomFields(cfMerged);

  const blocks: ProposalBlock[] = [
    {
      id: randomUUID(),
      type: "header",
      text: opportunity.name,
    },
    {
      id: randomUUID(),
      type: "text",
      body: `Prepared for ${customer.name}\n\n${contactLines}`,
    },
  ];

  if (cfText) {
    blocks.push({
      id: randomUUID(),
      type: "text",
      body: `Details\n${cfText}`,
    });
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
    blocks.push({
      id: randomUUID(),
      type: "text",
      body: `Opportunity\n${oppMeta.join("\n")}`,
    });
  }

  return {
    title: `${opportunity.name} — ${customer.company ?? customer.name}`,
    blocks,
  };
}

function buildCustomerOnlyProposalDocument(customer: CustomerRecord): ProposalDocument {
  const contactLines = [
    customer.company ? `Company: ${customer.company}` : null,
    `Email: ${customer.email}`,
    customer.phone ? `Phone: ${customer.phone}` : null,
    formatAddressLine(customer) ? `Address: ${formatAddressLine(customer)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const cfText = formatCustomFields(customer.customFields);

  const blocks: ProposalBlock[] = [
    {
      id: randomUUID(),
      type: "header",
      text: "Proposal",
    },
    {
      id: randomUUID(),
      type: "text",
      body: `Prepared for ${customer.name}\n\n${contactLines}`,
    },
  ];

  if (cfText) {
    blocks.push({
      id: randomUUID(),
      type: "text",
      body: `Details\n${cfText}`,
    });
  }

  return {
    title: `${customer.company ?? customer.name} — Proposal`,
    blocks,
  };
}

/**
 * Creates a draft proposal row from CRM customer + optional template (`{{name}}`, `{{email}}`, `{{company}}`, …).
 */
export async function createDraftProposalFromCustomerAction(
  customerId: string,
  templateId?: string | null,
): Promise<{ ok: true; proposalId: string } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
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
    document = applyProposalTokensToDocument(cloneProposalDocument(template.document), { customer });
    branding = cloneBrandingFromTemplate(template.branding);
    sourceTemplateId = template.id;
  } else {
    document = buildCustomerOnlyProposalDocument(customer);
  }

  try {
    const organizationId = user.organizationId ?? "default";
    const now = Date.now();
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
      document: omitUndefinedDeep(document),
      createdAtMs: now,
      updatedAtMs: now,
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
    return {
      ok: false,
      message:
        err instanceof Error && err.message
          ? err.message
          : "Could not save the proposal. If this persists, check Firestore rules and that the document has no invalid fields.",
    };
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
  const user = await requireStaffForCrm();
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
    });
    branding = cloneBrandingFromTemplate(template.branding);
    sourceTemplateId = template.id;
  } else {
    document = buildPrefilledProposalDocument(customer, opportunity);
  }

  try {
    const organizationId = user.organizationId ?? "default";
    const now = Date.now();
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
      document: omitUndefinedDeep(document),
      createdAtMs: now,
      updatedAtMs: now,
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
    revalidatePath(`/admin/opportunities/${opportunityId}`);

    return { ok: true, proposalId: ref.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError("createDraftProposalFromOpportunityAction_failed", { message: msg });
    return {
      ok: false,
      message:
        err instanceof Error && err.message
          ? err.message
          : "Could not save the proposal. If this persists, check Firestore rules and that the document has no invalid fields.",
    };
  }
}
