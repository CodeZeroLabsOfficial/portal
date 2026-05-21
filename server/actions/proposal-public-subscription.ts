"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveAgreementSubscriptionStartDateIso } from "@/lib/agreement-subscription-start-date";
import { findFirstAgreementBlock } from "@/lib/proposal-blocks";
import { resolveProposalCommerce } from "@/lib/proposal-commerce";
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
import { chargeProposalOneOffItems } from "@/server/stripe/proposal-one-off-billing";
import {
  createSubscriptionScheduleForCustomer,
  parseStartDateToUtcMs,
} from "@/server/stripe/subscription-schedule-create";

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

export type CreateProposalPublicSubscriptionResult =
  | { ok: true; subscriptionId: string; oneOffInvoiceId?: string; oneOffWarning?: string }
  | { ok: false; message: string };

/**
 * Creates a Stripe subscription schedule for the plan and recurring add-ons, then
 * invoices one-time charges (upfront fees and one-off catalogue add-ons).
 */
export async function createProposalPublicSubscriptionAction(
  raw: unknown,
): Promise<CreateProposalPublicSubscriptionResult> {
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

  const commerce = resolveProposalCommerce(
    proposal,
    billingCatalog.catalogServices,
    billingCatalog.stripeProductCatalog,
  );
  if (!commerce?.pick) {
    return {
      ok: false,
      message:
        commerce?.billingErrors[0] ??
        "Could not resolve a subscription from this proposal. Link plan tiers to a catalogue service (or legacy Stripe product) and ensure a plan is selected.",
    };
  }

  if (commerce.billingErrors.length > 0) {
    return { ok: false, message: commerce.billingErrors[0]! };
  }

  const agreementBlock = findFirstAgreementBlock(proposal.document.blocks);
  const startResolved = resolveAgreementSubscriptionStartDateIso({
    mode: agreementBlock?.subscriptionStartDateMode,
    customDateIso: agreementBlock?.subscriptionStartCustomDate,
    acceptedAtMs: proposal.acceptedAt,
  });
  if (!startResolved.ok) return startResolved;

  const startAt = parseStartDateToUtcMs(startResolved.startDateIso);
  if (!startAt) {
    return { ok: false, message: "Invalid subscription start date." };
  }
  const todayStartMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  if (startAt < todayStartMs) {
    return { ok: false, message: "Subscription start date cannot be in the past." };
  }

  const { stripeCustomerId, created } = await ensureStripeCustomer(stripe, crm, proposal.organizationId);
  if (created || crm.stripeCustomerId !== stripeCustomerId) {
    await persistStripeCustomerIdOnCustomer(crm.id, stripeCustomerId);
  }

  const customerRow = { ...crm, stripeCustomerId };
  const additionalSubscriptionItems = commerce.subscriptionItems
    .filter((item) => item.priceId !== commerce.pick!.priceId)
    .map((item) => ({ priceId: item.priceId, quantity: item.quantity }));

  const scheduleResult = await createSubscriptionScheduleForCustomer({
    stripe,
    db,
    customer: customerRow,
    organizationId: proposal.organizationId,
    stripePriceId: commerce.pick.priceId,
    additionalSubscriptionItems,
    startDateIso: startResolved.startDateIso,
    durationMonths: commerce.pick.durationMonths,
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

  let oneOffInvoiceId: string | undefined;
  let oneOffWarning: string | undefined;

  if (commerce.oneOffItems.length > 0) {
    const oneOffResult = await chargeProposalOneOffItems({
      stripe,
      stripeCustomerId,
      items: commerce.oneOffItems,
      organizationId: proposal.organizationId,
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      collectionMethod: billing.collectionMethod,
      daysUntilDue: billing.collectionMethod === "send_invoice" ? billing.daysUntilDue ?? 14 : undefined,
      defaultPaymentMethodId:
        billing.collectionMethod === "charge_automatically"
          ? billing.defaultPaymentMethodId
          : undefined,
    });
    if (!oneOffResult.ok) {
      oneOffWarning = `Subscription was created, but one-time charges could not be invoiced: ${oneOffResult.message}`;
    } else {
      oneOffInvoiceId = oneOffResult.invoiceId;
    }
  }

  revalidateAfterPublicSubscription(proposal.id, proposal.shareToken, crm.id);
  return {
    ok: true,
    subscriptionId: scheduleResult.subscriptionId,
    ...(oneOffInvoiceId ? { oneOffInvoiceId } : {}),
    ...(oneOffWarning ? { oneOffWarning } : {}),
  };
}
