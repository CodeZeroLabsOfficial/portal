"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { addCustomerNoteSchema, createCustomerSchema, updateCustomerFormSchema } from "@/lib/schemas/customer";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import {
  appendCustomerNote,
  createCustomerDocument,
  deleteCustomerDocument,
  getCustomerRecordForOrg,
  setCustomerArchived,
  syncStripeCustomerBasics,
  updateCustomerDocument,
} from "@/server/firestore/crm-customers";
import { getStripe } from "@/lib/stripe/server";

function zodErrorToMessage(error: ZodError): string {
  const first = error.errors[0];
  return first ? `${first.path.join(".")}: ${first.message}` : "Invalid input";
}

async function requireStaffForCrm() {
  const user = await getCurrentSessionUser();
  if (!user || !hasRole(user, ["admin", "team"])) {
    return null;
  }
  return user;
}

export async function createCustomerAction(
  raw: unknown,
): Promise<{ ok: true; customerId: string } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
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
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${result.customerId}`);
  return { ok: true, customerId: result.customerId };
}

export async function updateCustomerAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
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
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  revalidatePath(`/admin/customers/${id}/edit`);
  return { ok: true };
}

export async function addCustomerNoteAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
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
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true };
}

export async function archiveCustomerAction(
  customerId: string,
  archived: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };
  const result = await setCustomerArchived(user, customerId, archived);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true };
}

export async function deleteCustomerAction(
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };
  const result = await deleteCustomerDocument(user, customerId);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/admin/customers");
  return { ok: true };
}

export async function linkStripeCustomerIdAction(
  customerId: string,
  stripeCustomerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
  if (!user) return { ok: false, message: "Unauthorized." };
  const trimmed = stripeCustomerId.trim();
  if (!trimmed.startsWith("cus_")) {
    return { ok: false, message: "Stripe customer id should start with cus_." };
  }
  const result = await syncStripeCustomerBasics(user, customerId, trimmed);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true };
}

/**
 * Loads the Stripe Customer object and merges billing name + email onto the CRM record when empty.
 */
export async function pullStripeCustomerProfileAction(
  customerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
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

    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (nameFromStripe && !customer.name?.trim()) patch.name = nameFromStripe;
    if (emailFromStripe && !customer.email?.trim()) patch.email = emailFromStripe;
    if (sc.phone && !customer.phone?.trim()) patch.phone = sc.phone;
    if (sc.address?.line1 && !customer.addressLine1?.trim()) patch.addressLine1 = sc.address.line1;
    if (sc.address?.line2 && !customer.addressLine2?.trim()) patch.addressLine2 = sc.address.line2;
    if (sc.address?.city && !customer.city?.trim()) patch.city = sc.address.city;
    if (sc.address?.state && !customer.region?.trim()) patch.region = sc.address.state;
    if (sc.address?.postal_code && !customer.postalCode?.trim()) patch.postalCode = sc.address.postal_code;
    if (sc.address?.country && !customer.country?.trim()) patch.country = sc.address.country;

    const changedFields = Object.keys(patch).filter((k) => k !== "updatedAt");
    if (changedFields.length === 0) {
      return { ok: true };
    }

    await db.collection(COLLECTIONS.customers).doc(customerId).update(patch);

    await db.collection(COLLECTIONS.customerActivities).add({
      customerId,
      type: "stripe_sync",
      title: "Synced profile fields from Stripe",
      actorUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${customerId}`);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe request failed.";
    return { ok: false, message };
  }
}
