import type { PortalUser } from "@/types/user";
import type { WorkspaceCompanySettings } from "@/types/organization";
import { asNumber, asString } from "@/lib/firestore/coerce";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";

/** Document id: trimmed `organizationId`, or `"default"` for single-tenant / unset org. */
export function workspaceOrganizationDocId(user: PortalUser): string {
  const id = user.organizationId?.trim();
  return id && id.length > 0 ? id : "default";
}

const emptySettings = (organizationDocId: string): WorkspaceCompanySettings => ({
  organizationDocId,
  name: "",
  phone: "",
  email: "",
  website: "",
  acn: "",
  abn: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  updatedAtMs: 0,
});

export async function getWorkspaceCompanySettings(user: PortalUser): Promise<WorkspaceCompanySettings | null> {
  const db = getFirebaseAdminFirestore();
  if (!db) {
    return null;
  }

  const docId = workspaceOrganizationDocId(user);
  const snap = await db.collection(COLLECTIONS.organizations).doc(docId).get();
  if (!snap.exists) {
    return emptySettings(docId);
  }

  const data = snap.data() ?? {};
  return {
    organizationDocId: docId,
    name: asString(data.name) ?? "",
    phone: asString(data.phone) ?? "",
    email: asString(data.email) ?? "",
    website: asString(data.website) ?? "",
    acn: asString(data.acn) ?? asString(data.taxId) ?? "",
    abn: asString(data.abn) ?? "",
    addressLine1: asString(data.addressLine1) ?? "",
    addressLine2: asString(data.addressLine2) ?? "",
    city: asString(data.city) ?? "",
    region: asString(data.region) ?? "",
    postalCode: asString(data.postalCode) ?? "",
    country: asString(data.country) ?? "",
    updatedAtMs: asNumber(data.updatedAtMs) ?? 0,
  };
}
