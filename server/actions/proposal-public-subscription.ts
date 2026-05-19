"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { utcDateIsoFromMillis } from "@/lib/date-utc-iso";
import { resolveFirstPackageSubscriptionFromProposal } from "@/lib/proposal-subscription-from-catalog";
import { zodErrorToMessage } from "@/lib/zod-error";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { getStripe } from "@/lib/stripe/server";
import {
  getCustomerRecordForPublicProposalCheckout,
  persistStripeCustomerIdOnCustomer,
} from "@/server/firestore/crm-customers";
import { getProposalRecordByShareToken } from "@/server/firestore/parse-proposal";
import { ensureStripeCustomer } from "@/server/stripe/proposal-billing";
import { loadBillingCatalogForOrganization } from "@/server/catalog/billing-catalog";
import { createSubscriptionScheduleForCustomer } from "@/server/stripe/subscription-schedule-create";

const bodySchema = z
  .object({
    shareToken: z.string().min(8),
    collectionMethod: z.enum(["charge_automatically", "send_invoice"]).default("charge_automatically"),
    daysUntilDue: z.number().int().min(1).max(90).optional(),
    defaultPaymentMethodId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.collectionMethod === "send_invoice" && typeof v.daysUntilDue !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daysUntilDue"],
        message: "Days until due is required for send invoice.",
      });
    }
  });

function revalidateAfterPublicSubscription(proposalId: string, shareToken: string, customerId: string) {
  revalidatePath(`/p/${shareToken}`);
  revalidatePath("/admin/subscriptions", "layout");
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath(`/admin/proposals/${proposalId}`);
}

/**
 * Creates the same Stripe subscription schedule as **Add subscription**, using
 * the accepted proposal’s plan selection, customer link, and agreement date
 * as the billing start date.
 */
export async function createProposalPublicSubscriptionAction(
  raw: unknown,
): Promise<{ ok: true; subscriptionId: string } | { ok: false; message: string }> {
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }

  const { shareToken, ...billing } = parsed.data;

  const proposal = await getProposalRecordByShareToken(shareToken);
  if (!proposal || proposal.status === "draft") {
    return { ok: false, message: "Proposal not found." };
  }
  if (proposal.status !== "accepted") {
    return { ok: false, message: "Accept the proposal before starting a subscription." };
  }
  if (!proposal.customerId?.trim()) {
    return { ok: false, message: "This proposal is not linked to a customer." };
  }
  if (typeof proposal.acceptedAt !== "number" || !Number.isFinite(proposal.acceptedAt)) {
    return { ok: false, message: "Missing acceptance timestamp." };
  }

  const db = getFirebaseAdminFirestore();
  const stripe = getStripe();
  if (!db) return { ok: false, message: "Service unavailable." };
  if (!stripe) return { ok: false, message: "Billing is not configured." };

  const crm = await getCustomerRecordForPublicProposalCheckout(
    proposal.customerId,
    proposal.organizationId,
  );
  if (!crm) return { ok: false, message: "Customer not found." };

  const billingCatalog = await loadBillingCatalogForOrganization(proposal.organizationId);
  if (
    billingCatalog.catalogServices.length === 0 &&
    billingCatalog.stripeProductCatalog.length === 0
  ) {
    return { ok: false, message: "No subscription services are configured." };
  }

  const pick = resolveFirstPackageSubscriptionFromProposal(
    proposal,
    billingCatalog.catalogServices,
    billingCatalog.stripeProductCatalog,
  );
  if (!pick) {
    return {
      ok: false,
      message:
        "Could not resolve a subscription from this proposal. Link plan tiers to a catalogue service (or legacy Stripe product) and ensure a plan is selected.",
    };
  }

  const startDateIso = utcDateIsoFromMillis(proposal.acceptedAt);

  const { stripeCustomerId, created } = await ensureStripeCustomer(stripe, crm, proposal.organizationId);
  if (created || crm.stripeCustomerId !== stripeCustomerId) {
    await persistStripeCustomerIdOnCustomer(crm.id, stripeCustomerId);
  }

  const customerRow = { ...crm, stripeCustomerId };

  const scheduleResult = await createSubscriptionScheduleForCustomer({
    stripe,
    db,
    customer: customerRow,
    organizationId: proposal.organizationId,
    stripePriceId: pick.priceId,
    startDateIso,
    durationMonths: pick.durationMonths,
    collectionMethod: billing.collectionMethod,
    daysUntilDue: billing.collectionMethod === "send_invoice" ? billing.daysUntilDue ?? 14 : undefined,
    defaultPaymentMethodId:
      billing.collectionMethod === "charge_automatically"
        ? billing.defaultPaymentMethodId
        : undefined,
    extraScheduleMetadata: {
      proposal_id: proposal.id,
      ...(proposal.shareToken ? { proposal_share_token: proposal.shareToken } : {}),
    },
    activityTitle: "Created subscription from proposal acceptance",
    activityDetail: (id) => `Stripe subscription reference (${id})`,
  });

  if (!scheduleResult.ok) return scheduleResult;

  revalidateAfterPublicSubscription(proposal.id, proposal.shareToken, crm.id);
  return scheduleResult;
}
