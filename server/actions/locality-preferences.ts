"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAllCurrencyCodes, getAllTimeZones, isIso3166Alpha2 } from "@/lib/locality-data";
import { updateLocalityPreferencesSchema } from "@/lib/schemas/locality-preferences";
import { zodErrorToMessage } from "@/lib/zod-error";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";

export async function updateLocalityPreferencesAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentSessionUser();
  if (!user) {
    return { ok: false, message: "You need to be signed in to update locality settings." };
  }

  const parsed = updateLocalityPreferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return { ok: false, message: "Database is not configured." };
  }

  const v = parsed.data;
  const tz = v.timeZone.trim();
  const lang = v.languageTag.trim();
  const dateFmt = v.dateFormatPreset;
  const timeFmt = v.timeFormatPreset;
  const region = v.localeRegionCode;
  const currency = v.currencyCode;

  if (tz) {
    const allowedTz = new Set(getAllTimeZones());
    if (!allowedTz.has(tz)) {
      return { ok: false, message: "Choose a valid time zone from the list." };
    }
  }
  if (region && !isIso3166Alpha2(region)) {
    return { ok: false, message: "Choose a valid country or region code." };
  }
  if (currency) {
    const allowedCur = new Set(getAllCurrencyCodes());
    if (!allowedCur.has(currency)) {
      return { ok: false, message: "Choose a valid currency code from the list." };
    }
  }

  const nowMs = Date.now();
  await db.collection(COLLECTIONS.users).doc(user.uid).set(
    {
      timeZone: tz,
      languageTag: lang,
      dateFormatPreset: dateFmt,
      timeFormatPreset: timeFmt,
      localeRegionCode: region,
      currencyCode: currency,
      updatedAtMs: nowMs,
    },
    { merge: true },
  );

  revalidatePath("/admin/settings", "layout");
  revalidatePath("/admin/settings/locality");

  return { ok: true };
}
