import { isStaff } from "@/lib/auth/server-session";
import { asString } from "@/lib/firestore/coerce";
import { millisFromFirestore } from "@/lib/firestore/timestamp";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import type {
  CatalogServicePickerOption,
  CatalogServiceRecord,
  CatalogServiceStatus,
  CatalogServiceTerm,
  CatalogServiceTermMonths,
} from "@/types/catalog-service";
import type { PortalUser } from "@/types/user";

function parseTermMonths(raw: unknown): CatalogServiceTermMonths | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 12 || n === 24) return n;
  return null;
}

function parseTerms(data: Record<string, unknown>): CatalogServiceTerm[] {
  const raw = data.terms;
  if (!Array.isArray(raw)) return [];
  const out: CatalogServiceTerm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const months = parseTermMonths(o.months);
    const monthlyAmountMinor =
      typeof o.monthlyAmountMinor === "number" && Number.isFinite(o.monthlyAmountMinor)
        ? Math.max(0, Math.round(o.monthlyAmountMinor))
        : null;
    if (!months || monthlyAmountMinor === null) continue;
    const stripePriceId = asString(o.stripePriceId)?.trim();
    out.push({
      months,
      monthlyAmountMinor,
      ...(stripePriceId ? { stripePriceId } : {}),
    });
  }
  return out;
}

export function parseCatalogServiceRecord(id: string, data: Record<string, unknown>): CatalogServiceRecord {
  const statusRaw = asString(data.status);
  const status: CatalogServiceStatus =
    statusRaw === "draft" || statusRaw === "active" || statusRaw === "archived" ? statusRaw : "draft";

  const features = Array.isArray(data.features)
    ? data.features
        .filter((f): f is string => typeof f === "string")
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, 40)
    : [];

  const upfront =
    typeof data.upfrontCost12Minor === "number" && Number.isFinite(data.upfrontCost12Minor)
      ? Math.max(0, Math.round(data.upfrontCost12Minor))
      : undefined;

  return {
    id,
    organizationId: asString(data.organizationId) ?? "",
    createdByUid: asString(data.createdByUid) ?? "",
    name: asString(data.name)?.trim() || "Untitled service",
    slug: asString(data.slug)?.trim() || "service",
    status,
    currency: (asString(data.currency) ?? "aud").toLowerCase(),
    sortOrder:
      typeof data.sortOrder === "number" && Number.isFinite(data.sortOrder)
        ? Math.max(0, Math.floor(data.sortOrder))
        : 0,
    includedUsers:
      typeof data.includedUsers === "number" && Number.isFinite(data.includedUsers)
        ? Math.max(0, Math.floor(data.includedUsers))
        : 0,
    includedLocations:
      typeof data.includedLocations === "number" && Number.isFinite(data.includedLocations)
        ? Math.max(0, Math.floor(data.includedLocations))
        : 0,
    includedAdmins:
      typeof data.includedAdmins === "number" && Number.isFinite(data.includedAdmins)
        ? Math.max(0, Math.floor(data.includedAdmins))
        : 0,
    ...(typeof upfront === "number" ? { upfrontCost12Minor: upfront } : {}),
    features,
    terms: parseTerms(data),
    ...(asString(data.stripeProductId)?.trim()
      ? { stripeProductId: asString(data.stripeProductId)!.trim() }
      : {}),
    ...(typeof data.stripeSyncedAt === "number" && Number.isFinite(data.stripeSyncedAt)
      ? { stripeSyncedAt: data.stripeSyncedAt }
      : millisFromFirestore(data, "stripeSyncedAt") > 0
        ? { stripeSyncedAt: millisFromFirestore(data, "stripeSyncedAt") }
        : {}),
    createdAt: millisFromFirestore(data, "createdAt"),
    updatedAt: millisFromFirestore(data, "updatedAt"),
  };
}

export function catalogServiceToPickerOption(service: CatalogServiceRecord): CatalogServicePickerOption | null {
  const durations = service.terms
    .filter((t) => t.stripePriceId?.trim().startsWith("price_"))
    .map((t) => ({
      months: t.months,
      priceId: t.stripePriceId!.trim(),
      currency: service.currency,
      unitAmountMinor: t.monthlyAmountMinor,
    }));
  if (durations.length === 0) return null;
  return {
    serviceId: service.id,
    serviceName: service.name,
    currency: service.currency,
    status: service.status,
    durations,
    includedUsers: service.includedUsers,
    includedLocations: service.includedLocations,
    includedAdmins: service.includedAdmins,
    ...(typeof service.upfrontCost12Minor === "number" ? { upfrontCost12Minor: service.upfrontCost12Minor } : {}),
    features: service.features,
  };
}

export async function listCatalogServicesForOrg(user: PortalUser): Promise<CatalogServiceRecord[]> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return [];
  const orgId = user.organizationId ?? "default";
  try {
    const snap = await db
      .collection(COLLECTIONS.catalogServices)
      .where("organizationId", "==", orgId)
      .limit(200)
      .get();
    return snap.docs
      .map((d) => parseCatalogServiceRecord(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } catch {
    return [];
  }
}

export async function getCatalogServiceForStaff(
  user: PortalUser,
  serviceId: string,
): Promise<CatalogServiceRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db || !isStaff(user)) return null;
  const id = serviceId.trim();
  if (!id) return null;
  try {
    const snap = await db.collection(COLLECTIONS.catalogServices).doc(id).get();
    if (!snap.exists) return null;
    const record = parseCatalogServiceRecord(snap.id, snap.data() as Record<string, unknown>);
    const orgId = user.organizationId ?? "default";
    if (record.organizationId !== orgId) return null;
    return record;
  } catch {
    return null;
  }
}

/** Active services with synced Stripe prices — for billing and proposal pickers. */
export async function listCatalogServicePickerOptionsForOrg(
  user: PortalUser,
): Promise<CatalogServicePickerOption[]> {
  const services = await listCatalogServicesForOrg(user);
  return services
    .filter((s) => s.status === "active")
    .map(catalogServiceToPickerOption)
    .filter((x): x is CatalogServicePickerOption => x !== null);
}

/** Billing resolution by org id (public proposal flows). */
export async function listCatalogServicePickerOptionsForOrganizationId(
  organizationId: string | undefined,
): Promise<CatalogServicePickerOption[]> {
  const db = getFirebaseAdminFirestore();
  if (!db) return [];
  const orgId = organizationId?.trim() || "default";
  try {
    const snap = await db.collection(COLLECTIONS.catalogServices).where("organizationId", "==", orgId).limit(100).get();
    return snap.docs
      .map((d) => parseCatalogServiceRecord(d.id, d.data() as Record<string, unknown>))
      .filter((s) => s.status === "active")
      .map(catalogServiceToPickerOption)
      .filter((x): x is CatalogServicePickerOption => x !== null)
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName, undefined, { sensitivity: "base" }));
  } catch {
    return [];
  }
}

export async function getCatalogServiceByIdForOrganization(
  serviceId: string,
  organizationId: string | undefined,
): Promise<CatalogServiceRecord | null> {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;
  const id = serviceId.trim();
  if (!id) return null;
  const orgId = organizationId?.trim() || "default";
  try {
    const snap = await db.collection(COLLECTIONS.catalogServices).doc(id).get();
    if (!snap.exists) return null;
    const record = parseCatalogServiceRecord(snap.id, snap.data() as Record<string, unknown>);
    if (record.organizationId !== orgId) return null;
    return record;
  } catch {
    return null;
  }
}
