"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getCustomerRecordForOrg } from "@/server/firestore/crm-customers";
import { getOpportunityForStaff } from "@/server/firestore/crm-opportunities";
import type { CustomerRecord } from "@/types/customer";
import type { OpportunityRecord } from "@/types/opportunity";
import type { ProposalBlock, ProposalDocument } from "@/types/proposal";

async function requireStaffForCrm() {
  const user = await getCurrentSessionUser();
  if (!user || !hasRole(user, ["admin", "team"])) return null;
  return user;
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

export function buildPrefilledProposalDocument(
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

/**
 * Creates a draft proposal row with blocks pre-filled from the CRM customer, merged custom fields, and opportunity.
 */
export async function createDraftProposalFromOpportunityAction(
  opportunityId: string,
): Promise<{ ok: true; proposalId: string } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };

  const opportunity = await getOpportunityForStaff(user, opportunityId);
  if (!opportunity) return { ok: false, message: "Opportunity not found." };

  const customer = await getCustomerRecordForOrg(user, opportunity.customerId);
  if (!customer) return { ok: false, message: "Customer not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const document = buildPrefilledProposalDocument(customer, opportunity);
  const organizationId = user.organizationId ?? "default";
  const now = Date.now();
  const shareToken = randomUUID().replace(/-/g, "");

  const ref = db.collection(COLLECTIONS.proposals).doc();
  await ref.set({
    organizationId,
    createdByUid: user.uid,
    title: document.title,
    customerId: customer.id,
    opportunityId: opportunity.id,
    recipientEmail: customer.email.trim().toLowerCase(),
    status: "draft",
    shareToken,
    document,
    createdAtMs: now,
    updatedAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/proposals/${ref.id}`);
  revalidatePath(`/admin/customers/${customer.id}`);
  revalidatePath(`/admin/opportunities/${opportunityId}`);

  return { ok: true, proposalId: ref.id };
}
