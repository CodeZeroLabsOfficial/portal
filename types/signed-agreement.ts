export interface SignedAgreementAddonSnapshot {
  label: string;
  quantity: number;
  unitAmountMinor: number;
  lineTotalMinor: number;
  currency: string;
  packageBlockTitle?: string;
}

export interface SignedAgreementTotalAmount {
  currency: string;
  monthlyTotalMinor: number;
  formatted: string;
}

/**
 * Row in `signedAgreements` — written when a buyer signs via the Services Agreement modal.
 */
export interface SignedAgreementRecord {
  id: string;
  organizationId: string;
  proposalId: string;
  shareToken?: string;
  proposalTitle: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  selectedPlan: string;
  addons: SignedAgreementAddonSnapshot[];
  totalAmount: SignedAgreementTotalAmount;
  signerName: string;
  signatureMethod: "draw" | "type" | null;
  signedAtMs: number;
  clientSignedAtMs?: number;
  fullAgreementText?: string;
  /** Inline PNG data URL when Storage upload was skipped or failed (small images). */
  signatureImage?: string;
  /** Firebase Storage object path when upload succeeded. */
  signatureImageStoragePath?: string;
}
