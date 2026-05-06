/** Workspace company record under `organizations/{organizationDocId}` (see `workspaceOrganizationDocId`). */
export interface WorkspaceCompanySettings {
  /** Firestore document id — from `user.organizationId` or `"default"`. */
  organizationDocId: string;
  name: string;
  phone: string;
  email: string;
  website: string;
  /** Australian Company Number (stored in Firestore as `acn`; legacy key `taxId` is read as fallback). */
  acn: string;
  /** Australian Business Number */
  abn: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  updatedAtMs: number;
}
