import { isStaff } from "@/lib/auth/server-session";
import { asString } from "@/lib/firestore/coerce";
import { millisFromFirestore } from "@/lib/firestore/timestamp";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import type {
  CatalogServiceBillingType,
  CatalogServiceKind,
  CatalogServicePickerOption,
  CatalogServicePricingModel,
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
    if (monthlyAmountMinor === null) continue;
    const stripePriceId = asString(o.stripePriceId)?.trim();
    const lookupKey = asString(o.lookupKey)?.trim();
    out.push({
      ...(months ? { months } : {}),
      monthlyAmountMinor,
      ...(stripePriceId ? { stripePriceId } : {}),
      ...(lookupKey ? { lookupKey } : {}),
    });
  }
  return out;
}

export function parseCatalogServiceRecord(id: string, data: Record<string, unknown>): CatalogServiceRecord {
  const statusRaw = asString(data.status);
  const status: CatalogServiceStatus =
    statusRaw === "draft" || statusRaw === "active" || statusRaw === "archived" ? statusRaw : "draft";

  const serviceTypeRaw = asString(data.serviceType);
  const serviceType: CatalogServiceKind | undefined =
    serviceTypeRaw === "plan" || serviceTypeRaw === "addon" ? serviceTypeRaw : undefined;

  const features =
    serviceType === "addon"
      ? []
      : Array.isArray(data.features)
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

  const billingTypeRaw = asString(data.billingType);
  const billingType: CatalogServiceBillingType | undefined =
    billingTypeRaw === "recurring" || billingTypeRaw === "one_off" ? billingTypeRaw : undefined;

  const pricingModelRaw = asString(data.pricingModel);
  const pricingModel: CatalogServicePricingModel | undefined =
    pricingModelRaw === "flat" || pricingModelRaw === "by_term" ? pricingModelRaw : undefined;

  const terms = parseTerms(data);
  const inferredPricing: CatalogServicePricingModel | undefined =
    pricingModel ?? (terms.length >= 2 ? "by_term" : terms.length === 1 ? "flat" : undefined);

  return {
    id,
    organizationId: asString(data.organizationId) ?? "",
    createdByUid: asString(data.createdByUid) ?? "",
    name: asString(data.name)?.trim() || "Untitled service",
    slug: asString(data.slug)?.trim() || "service",
    ...(serviceType ? { serviceType } : {}),
    ...(asString(data.description)?.trim() ? { description: asString(data.description)!.trim() } : {}),
    ...(billingType ? { billingType } : {}),
    ...(inferredPricing ? { pricingModel: inferredPricing } : {}),
    status,
    currency: (asString(data.currency) ?? "aud").toLowerCase(),
    includedUsers:
      serviceType === "addon"
        ? 0
        : typeof data.includedUsers === "number" && Number.isFinite(data.includedUsers)
          ? Math.max(0, Math.floor(data.includedUsers))
          : 0,
    includedLocations:
      serviceType === "addon"
        ? 0
        : typeof data.includedLocations === "number" && Number.isFinite(data.includedLocations)
          ? Math.max(0, Math.floor(data.includedLocations))
          : 0,
    includedAdmins:
      serviceType === "addon"
        ? 0
        : typeof data.includedAdmins === "number" && Number.isFinite(data.includedAdmins)
          ? Math.max(0, Math.floor(data.includedAdmins))
          : 0,
    ...(typeof upfront === "number" ? { upfrontCost12Minor: upfront } : {}),
    features,
    terms,
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
  const synced = service.terms.filter((t) => t.stripePriceId?.trim().startsWith("price_"));
  if (synced.length === 0) return null;

  const pricingModel =
    service.pricingModel ?? (synced.length >= 2 ? "by_term" : "flat");

  let durations: CatalogServicePickerOption["durations"];
  if (pricingModel === "by_term") {
    durations = synced
      .filter((t): t is CatalogServiceTerm & { months: CatalogServiceTermMonths } => t.months === 12 || t.months === 24)
      .map((t) => ({
        months: t.months,
        priceId: t.stripePriceId!.trim(),
        currency: service.currency,
        unitAmountMinor: t.monthlyAmountMinor,
      }));
  } else {
    const term = synced[0]!;
    const priceId = term.stripePriceId!.trim();
    const unitAmountMinor = term.monthlyAmountMinor;
    durations = [
      { months: 12, priceId, currency: service.currency, unitAmountMinor },
      { months: 24, priceId, currency: service.currency, unitAmountMinor },
    ];
  }

  if (durations.length === 0) return null;

  return {
    serviceId: service.id,
    serviceName: service.name,
    currency: service.currency,
    status: service.status,
    ...(service.serviceType ? { serviceType: service.serviceType } : {}),
    ...(service.billingType ? { billingType: service.billingType } : {}),
    pricingModel,
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
      .collection(COLLECTIONS.services)
      .where("organizationId", "==", orgId)
      .limit(200)
      .get();
    return snap.docs
      .map((d) => parseCatalogServiceRecord(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
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
    const snap = await db.collection(COLLECTIONS.services).doc(id).get();
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
    const snap = await db.collection(COLLECTIONS.services).where("organizationId", "==", orgId).limit(100).get();
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
    const snap = await db.collection(COLLECTIONS.services).doc(id).get();
    if (!snap.exists) return null;
    const record = parseCatalogServiceRecord(snap.id, snap.data() as Record<string, unknown>);
    if (record.organizationId !== orgId) return null;
    return record;
  } catch {
    return null;
  }
}
