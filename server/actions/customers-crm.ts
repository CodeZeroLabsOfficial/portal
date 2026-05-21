"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/auth/server-session";
import { addCustomerNoteSchema, createCustomerSchema, updateCustomerFormSchema } from "@/lib/schemas/customer";
import { zodErrorToMessage } from "@/lib/zod-error";
import { z } from "zod";
import { getStorageFileSignedReadUrl } from "@/lib/firebase/admin-storage";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import {
  appendCustomerNote,
  createCustomerDocument,
  deleteCustomerDocument,
  getCustomerRecordForOrg,
  getSignedAgreementForCustomerContext,
  setCustomerArchived,
  syncStripeCustomerBasics,
  updateCustomerDocument,
  enableCustomerPortalAccess,
} from "@/server/firestore/crm-customers";
import type { SignedAgreementRecord } from "@/types/signed-agreement";
import { getStripe } from "@/lib/stripe/server";

function revalidateCrmCustomerPaths(customerId?: string) {
  revalidatePath("/admin/customers", "layout");
  revalidatePath("/admin/accounts", "layout");
  if (customerId) {
    revalidatePath(`/admin/customers/${customerId}`);
  }
}

export async function createCustomerAction(
  raw: unknown,
): Promise<{ ok: true; customerId: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session to manage customers." };
  }
  const parsed = createCustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }
  const result = await createCustomerDocument(user, parsed.data);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  revalidateCrmCustomerPaths(result.customerId);
  return { ok: true, customerId: result.customerId };
}

export async function updateCustomerAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session to manage customers." };
  }
  const parsed = updateCustomerFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }
  const result = await updateCustomerDocument(user, parsed.data);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  const id = parsed.data.id;
  revalidateCrmCustomerPaths(id);
  return { ok: true };
}

/** Staff-only: link or create Auth user for the CRM email and set `portalUserId`. */
export async function enableCustomerPortalAccessAction(
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session." };
  }
  const id = customerId.trim();
  if (!id) {
    return { ok: false, message: "Customer id is required." };
  }
  const result = await enableCustomerPortalAccess(user, id);
  if (!result.ok) {
    return result;
  }
  revalidateCrmCustomerPaths(id);
  return { ok: true };
}

/** Staff-only: Firebase password-reset link for the Auth user linked to this CRM customer (sensitive — share securely). */
export async function generatePortalPasswordResetLinkAction(
  customerId: string,
): Promise<{ ok: true; link: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session." };
  }
  const id = customerId.trim();
  if (!id) {
    return { ok: false, message: "Customer id is required." };
  }
  const customer = await getCustomerRecordForOrg(user, id);
  if (!customer) {
    return { ok: false, message: "Customer not found." };
  }
  const portalUid = customer.portalUserId?.trim();
  if (!portalUid) {
    return {
      ok: false,
      message: "No portal login is linked. Use Link user on the customer profile first.",
    };
  }
  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return { ok: false, message: "Firebase Admin is not configured." };
  }
  try {
    const u = await auth.getUser(portalUid);
    const email = u.email?.trim().toLowerCase();
    if (!email) {
      return { ok: false, message: "Linked Firebase user has no email address." };
    }
    const link = await auth.generatePasswordResetLink(email);
    return { ok: true, link };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not generate password link.";
    return { ok: false, message };
  }
}

export async function addCustomerNoteAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "Unauthorized." };
  }
  const parsed = addCustomerNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }
  const { customerId, body, kind } = parsed.data;
  const result = await appendCustomerNote(user, customerId, body, kind);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  revalidateCrmCustomerPaths(customerId);
  return { ok: true };
}

export async function archiveCustomerAction(
  customerId: string,
  archived: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };
  const result = await setCustomerArchived(user, customerId, archived);
  if (!result.ok) return { ok: false, message: result.message };
  revalidateCrmCustomerPaths(customerId);
  return { ok: true };
}

export async function deleteCustomerAction(
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };
  const result = await deleteCustomerDocument(user, customerId);
  if (!result.ok) return { ok: false, message: result.message };
  revalidateCrmCustomerPaths();
  revalidatePath("/admin/proposals", "layout");
  revalidatePath("/admin/subscriptions", "layout");
  return { ok: true };
}

export async function linkStripeCustomerIdAction(
  customerId: string,
  stripeCustomerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };
  const trimmed = stripeCustomerId.trim();
  if (!trimmed.startsWith("cus_")) {
    return { ok: false, message: "Stripe customer id should start with cus_." };
  }
  const result = await syncStripeCustomerBasics(user, customerId, trimmed);
  if (!result.ok) return { ok: false, message: result.message };
  revalidateCrmCustomerPaths(customerId);
  return { ok: true };
}

/**
 * Loads the Stripe Customer object and merges billing name + email onto the CRM record when empty.
 */
export async function pullStripeCustomerProfileAction(
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer?.stripeCustomerId) {
    return { ok: false, message: "Link a Stripe customer id first." };
  }

  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, message: "Stripe is not configured on the server." };
  }

  try {
    const sc = await stripe.customers.retrieve(customer.stripeCustomerId);
    if (sc.deleted || typeof sc === "string") {
      return { ok: false, message: "Stripe customer was deleted or unavailable." };
    }

    const db = getFirebaseAdminFirestore();
    if (!db) return { ok: false, message: "Database unavailable." };

    const nameFromStripe =
      sc.name?.trim() ||
      [sc.metadata?.first_name, sc.metadata?.last_name].filter(Boolean).join(" ").trim();
    const emailFromStripe = typeof sc.email === "string" ? sc.email.trim().toLowerCase() : "";

    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      stripeSyncedAt: Date.now(),
    };
    if (nameFromStripe && !customer.name?.trim()) patch.name = nameFromStripe;
    if (emailFromStripe && !customer.email?.trim()) patch.email = emailFromStripe;
    if (sc.phone && !customer.phone?.trim()) patch.phone = sc.phone;
    if (sc.address?.line1 && !customer.addressLine1?.trim()) patch.addressLine1 = sc.address.line1;
    if (sc.address?.line2 && !customer.addressLine2?.trim()) patch.addressLine2 = sc.address.line2;
    if (sc.address?.city && !customer.city?.trim()) patch.city = sc.address.city;
    if (sc.address?.state && !customer.region?.trim()) patch.region = sc.address.state;
    if (sc.address?.postal_code && !customer.postalCode?.trim()) patch.postalCode = sc.address.postal_code;
    if (sc.address?.country && !customer.country?.trim()) patch.country = sc.address.country;

    await db.collection(COLLECTIONS.customers).doc(customerId).update(patch);

    const profileFieldsChanged = Object.keys(patch).filter(
      (k) => k !== "updatedAt" && k !== "stripeSyncedAt",
    ).length;
    await db.collection(COLLECTIONS.customerActivities).add({
      customerId,
      type: "stripe_sync",
      title: profileFieldsChanged
        ? "Synced profile fields from Stripe"
        : "Resynced Stripe customer",
      actorUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    revalidateCrmCustomerPaths(customerId);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe request failed.";
    return { ok: false, message };
  }
}

const signedAgreementViewSchema = z.object({
  customerId: z.string().min(1),
  signedAgreementId: z.string().min(1),
});

/**
 * Loads a signed agreement for the staff CRM modal (body + resolved signature image URL).
 * Omits inline signature data from the returned record to keep the payload small.
 */
export async function getSignedAgreementModalPayloadAction(
  raw: unknown,
): Promise<
  | { ok: true; record: SignedAgreementRecord; signatureSrc: string | null }
  | { ok: false; message: string }
> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session." };
  }
  const parsed = signedAgreementViewSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }
  const { customerId, signedAgreementId } = parsed.data;
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) {
    return { ok: false, message: "Customer not found." };
  }
  const row = await getSignedAgreementForCustomerContext(
    user,
    customerId,
    signedAgreementId,
    customer.organizationId,
  );
  if (!row) {
    return { ok: false, message: "Signed agreement not found." };
  }

  let signatureSrc: string | null = null;
  if (row.signatureImage?.startsWith("data:image/")) {
    signatureSrc = row.signatureImage;
  } else if (row.signatureImageStoragePath) {
    signatureSrc = await getStorageFileSignedReadUrl(row.signatureImageStoragePath);
  }

  const { signatureImage: _sig, signatureImageStoragePath: _path, ...rest } = row;
  return { ok: true, record: rest as SignedAgreementRecord, signatureSrc };
}
