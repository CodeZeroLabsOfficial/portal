import { asNumber, asString } from "@/lib/firestore/coerce";
import type {
  SignedAgreementAddonSnapshot,
  SignedAgreementRecord,
  SignedAgreementTotalAmount,
} from "@/types/signed-agreement";

function parseAddons(raw: unknown): SignedAgreementAddonSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: SignedAgreementAddonSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = asString(o.label)?.trim() || "Add-on";
    const quantity = asNumber(o.quantity);
    const unitAmountMinor = asNumber(o.unitAmountMinor);
    const lineTotalMinor = asNumber(o.lineTotalMinor);
    const currency = (asString(o.currency) || "AUD").toUpperCase();
    if (
      typeof quantity !== "number" ||
      typeof unitAmountMinor !== "number" ||
      typeof lineTotalMinor !== "number"
    ) {
      continue;
    }
    out.push({
      label,
      quantity: Math.max(0, Math.floor(quantity)),
      unitAmountMinor,
      lineTotalMinor,
      currency,
      packageBlockTitle: asString(o.packageBlockTitle),
    });
  }
  return out;
}

function parseTotalAmount(raw: unknown): SignedAgreementTotalAmount {
  if (!raw || typeof raw !== "object") {
    return { currency: "AUD", monthlyTotalMinor: 0, formatted: "—" };
  }
  const o = raw as Record<string, unknown>;
  const currency = (asString(o.currency) || "AUD").toUpperCase();
  const monthlyTotalMinor = asNumber(o.monthlyTotalMinor) ?? 0;
  const formatted = asString(o.formatted) || "—";
  return { currency, monthlyTotalMinor, formatted };
}

export function parseSignedAgreementRecord(id: string, data: Record<string, unknown>): SignedAgreementRecord | null {
  const organizationId = asString(data.organizationId)?.trim();
  const proposalId = asString(data.proposalId)?.trim();
  if (!organizationId || !proposalId) return null;

  const signatureMethodRaw = data.signatureMethod;
  const signatureMethod =
    signatureMethodRaw === "draw" || signatureMethodRaw === "type" || signatureMethodRaw === "upload"
      ? signatureMethodRaw
      : null;

  return {
    id,
    organizationId,
    proposalId,
    shareToken: asString(data.shareToken),
    proposalTitle: asString(data.proposalTitle)?.trim() || "Signed agreement",
    customerId: asString(data.customerId),
    customerEmail: asString(data.customerEmail),
    customerName: asString(data.customerName),
    selectedPlan: asString(data.selectedPlan)?.trim() || "—",
    addons: parseAddons(data.addons),
    totalAmount: parseTotalAmount(data.totalAmount),
    signerName: asString(data.signerName)?.trim() || "—",
    signerEmail: asString(data.signerEmail),
    signerOrganization: asString(data.signerOrganization),
    signatureMethod,
    signedAt: asNumber(data.signedAt) ?? 0,
    clientSignedAt: asNumber(data.clientSignedAt),
    fullAgreementText: asString(data.fullAgreementText),
    signatureImage: asString(data.signatureImage),
    signatureImageStoragePath: asString(data.signatureImageStoragePath),
    stripeSubscriptionPriceId: asString(data.stripeSubscriptionPriceId),
  };
}
