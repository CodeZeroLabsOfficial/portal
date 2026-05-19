"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaffSession } from "@/lib/auth/server-session";
import { slugifyCatalogServiceName } from "@/lib/catalog-service-slug";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { runAdminWrite } from "@/lib/firebase/admin-write";
import { getStripe } from "@/lib/stripe/server";
import { saveCatalogServiceSchema, saveInputToServiceTerms } from "@/lib/schemas/catalog-service";
import { zodErrorToMessage } from "@/lib/zod-error";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getCatalogServiceForStaff } from "@/server/firestore/catalog-services";
import { syncCatalogServiceToStripe } from "@/server/stripe/catalog-service-stripe-sync";

function revalidateCatalogPaths(serviceId?: string) {
  revalidatePath("/admin/services", "layout");
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/subscriptions", "layout");
  revalidatePath("/admin/proposals", "layout");
  revalidatePath("/admin/templates", "layout");
}

export async function createCatalogServiceAction(): Promise<
  { ok: true; serviceId: string } | { ok: false; message: string }
> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const ref = db.collection(COLLECTIONS.catalogServices).doc();
  const name = "New service";
  const write = await runAdminWrite(
    "catalog_service_create_failed",
    { serviceId: ref.id, uid: user.uid },
    "Could not create the service.",
    () =>
      ref.set({
        organizationId: user.organizationId ?? "default",
        createdByUid: user.uid,
        name,
        slug: slugifyCatalogServiceName(name),
        status: "draft",
        currency: "aud",
        sortOrder: 0,
        includedUsers: 0,
        includedLocations: 0,
        includedAdmins: 0,
        features: [],
        terms: [
          { months: 12, monthlyAmountMinor: 0 },
          { months: 24, monthlyAmountMinor: 0 },
        ],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
  );
  if (!write.ok) return write;

  revalidateCatalogPaths(ref.id);
  return { ok: true, serviceId: ref.id };
}

export async function saveCatalogServiceAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = saveCatalogServiceSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const serviceId = parsed.data.serviceId?.trim();
  if (!serviceId) return { ok: false, message: "Service id is required." };

  const existing = await getCatalogServiceForStaff(user, serviceId);
  if (!existing) return { ok: false, message: "Service not found." };

  const slug =
    parsed.data.slug?.trim() ||
    existing.slug ||
    slugifyCatalogServiceName(parsed.data.name);
  const terms = saveInputToServiceTerms(parsed.data).map((t) => {
    const prev = existing.terms.find((p) => p.months === t.months);
    return {
      ...t,
      ...(prev?.stripePriceId ? { stripePriceId: prev.stripePriceId } : {}),
    };
  });

  const features = parsed.data.features.map((f) => f.trim()).filter(Boolean);

  const write = await runAdminWrite(
    "catalog_service_save_failed",
    { serviceId, uid: user.uid },
    "Could not save the service.",
    () =>
      db
        .collection(COLLECTIONS.catalogServices)
        .doc(serviceId)
        .set(
          {
            name: parsed.data.name.trim(),
            slug,
            currency: parsed.data.currency.toLowerCase(),
            sortOrder: parsed.data.sortOrder,
            includedUsers: parsed.data.includedUsers,
            includedLocations: parsed.data.includedLocations,
            includedAdmins: parsed.data.includedAdmins,
            ...(typeof parsed.data.upfrontCost12Minor === "number"
              ? { upfrontCost12Minor: Math.round(parsed.data.upfrontCost12Minor) }
              : {}),
            features,
            terms,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
  );
  if (!write.ok) return write;

  revalidateCatalogPaths(serviceId);
  return { ok: true };
}

export async function activateCatalogServiceAction(
  serviceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const id = serviceId.trim();
  if (!id) return { ok: false, message: "Service id is required." };

  const existing = await getCatalogServiceForStaff(user, id);
  if (!existing) return { ok: false, message: "Service not found." };

  if (existing.terms.length === 0) {
    return { ok: false, message: "Add 12- and 24-month pricing before activating." };
  }

  const stripe = getStripe();
  if (!stripe) return { ok: false, message: "Stripe is not configured on the server." };

  const sync = await syncCatalogServiceToStripe(stripe, existing);
  if (!sync.ok) return sync;

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "catalog_service_activate_failed",
    { serviceId: id, uid: user.uid },
    "Could not activate the service.",
    () =>
      db.collection(COLLECTIONS.catalogServices).doc(id).set(
        {
          status: "active",
          stripeProductId: sync.stripeProductId,
          terms: sync.terms,
          stripeSyncedAt: sync.stripeSyncedAt,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
  );
  if (!write.ok) return write;

  revalidateCatalogPaths(id);
  return { ok: true };
}

export async function syncCatalogServiceStripeAction(
  serviceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const id = serviceId.trim();
  const existing = await getCatalogServiceForStaff(user, id);
  if (!existing) return { ok: false, message: "Service not found." };

  const stripe = getStripe();
  if (!stripe) return { ok: false, message: "Stripe is not configured on the server." };

  const sync = await syncCatalogServiceToStripe(stripe, existing);
  if (!sync.ok) return sync;

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "catalog_service_sync_failed",
    { serviceId: id, uid: user.uid },
    "Could not sync to Stripe.",
    () =>
      db.collection(COLLECTIONS.catalogServices).doc(id).set(
        {
          stripeProductId: sync.stripeProductId,
          terms: sync.terms,
          stripeSyncedAt: sync.stripeSyncedAt,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
  );
  if (!write.ok) return write;

  revalidateCatalogPaths(id);
  return { ok: true };
}

export async function archiveCatalogServiceAction(
  serviceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const id = serviceId.trim();
  const existing = await getCatalogServiceForStaff(user, id);
  if (!existing) return { ok: false, message: "Service not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "catalog_service_archive_failed",
    { serviceId: id, uid: user.uid },
    "Could not archive the service.",
    () =>
      db.collection(COLLECTIONS.catalogServices).doc(id).set(
        {
          status: "archived",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
  );
  if (!write.ok) return write;

  revalidateCatalogPaths(id);
  return { ok: true };
}
