"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { updateUserProfileSchema } from "@/lib/schemas/user-profile";
import { zodErrorToMessage } from "@/lib/zod-error";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { runAdminWrite } from "@/lib/firebase/admin-write";
import { COLLECTIONS } from "@/server/firestore/collections";
import { Timestamp } from "firebase-admin/firestore";

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

  const nowTs = Timestamp.now();
  const write = await runAdminWrite(
    "user_profile_save_failed",
    { uid: user.uid },
    "Could not save profile.",
    () =>
      db.collection(COLLECTIONS.users).doc(user.uid).set(
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
          updatedAt: nowTs,
        },
        { merge: true },
      ),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/settings", "layout");
  revalidatePath("/admin/settings/profile");
  revalidatePath("/admin/settings/profile/edit");

  return { ok: true };
}
