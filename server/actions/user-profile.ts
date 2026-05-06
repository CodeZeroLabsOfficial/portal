"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { updateUserProfileSchema } from "@/lib/schemas/user-profile";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";

function zodErrorToMessage(error: ZodError): string {
  const first = error.errors[0];
  return first ? `${first.path.join(".")}: ${first.message}` : "Invalid input";
}

export async function updateCurrentUserProfileAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentSessionUser();
  if (!user) {
    return { ok: false, message: "You need to be signed in to update your profile." };
  }

  const parsed = updateUserProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return { ok: false, message: "Database is not configured." };
  }

  const v = parsed.data;
  const parts = [v.firstName.trim(), v.lastName.trim()].filter(Boolean);
  const displayName = parts.length > 0 ? parts.join(" ") : "";

  const nowMs = Date.now();
  await db.collection(COLLECTIONS.users).doc(user.uid).set(
    {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      phone: v.phone.trim(),
      website: v.website.trim(),
      dateOfBirth: v.dateOfBirth.trim(),
      addressLine1: v.addressLine1.trim(),
      addressLine2: v.addressLine2.trim(),
      city: v.city.trim(),
      region: v.region.trim(),
      postalCode: v.postalCode.trim(),
      country: v.country.trim(),
      displayName,
      updatedAtMs: nowMs,
    },
    { merge: true },
  );

  revalidatePath("/admin/settings", "layout");
  revalidatePath("/admin/settings/profile");
  revalidatePath("/admin/settings/profile/edit");

  return { ok: true };
}
