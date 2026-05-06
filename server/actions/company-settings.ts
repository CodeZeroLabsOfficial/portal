"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { updateCompanySettingsSchema } from "@/lib/schemas/company-settings";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import { workspaceOrganizationDocId } from "@/server/firestore/organization-settings";

function zodErrorToMessage(error: ZodError): string {
  const first = error.errors[0];
  return first ? `${first.path.join(".")}: ${first.message}` : "Invalid input";
}

export async function updateWorkspaceCompanySettingsAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentSessionUser();
  if (!user) {
    return { ok: false, message: "You need to be signed in to update company settings." };
  }

  const parsed = updateCompanySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return { ok: false, message: "Database is not configured." };
  }

  const v = parsed.data;
  const docId = workspaceOrganizationDocId(user);
  const nowMs = Date.now();

  await db.collection(COLLECTIONS.organizations).doc(docId).set(
    {
      organizationDocId: docId,
      name: v.name.trim(),
      phone: v.phone.trim(),
      email: v.email.trim(),
      website: v.website.trim(),
      taxId: v.taxId.trim(),
      addressLine1: v.addressLine1.trim(),
      addressLine2: v.addressLine2.trim(),
      city: v.city.trim(),
      region: v.region.trim(),
      postalCode: v.postalCode.trim(),
      country: v.country.trim(),
      updatedAtMs: nowMs,
    },
    { merge: true },
  );

  revalidatePath("/admin/settings", "layout");
  revalidatePath("/admin/settings/company");
  revalidatePath("/admin/settings/company/edit");

  return { ok: true };
}
