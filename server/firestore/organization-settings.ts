import type { PortalUser } from "@/types/user";
import type { WorkspaceCompanySettings } from "@/types/organization";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

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
  taxId: "",
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
    taxId: asString(data.taxId) ?? "",
    addressLine1: asString(data.addressLine1) ?? "",
    addressLine2: asString(data.addressLine2) ?? "",
    city: asString(data.city) ?? "",
    region: asString(data.region) ?? "",
    postalCode: asString(data.postalCode) ?? "",
    country: asString(data.country) ?? "",
    updatedAtMs: asNumber(data.updatedAtMs) ?? 0,
  };
}
