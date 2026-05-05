import { Buffer } from "node:buffer";

/** URL-safe segment derived from lowercase trimmed company name (groups "Acme" and "acme"). */
export function companyNameToAccountKey(companyDisplayName: string): string {
  const norm = companyDisplayName.trim().toLowerCase();
  if (!norm) return "";
  return Buffer.from(norm, "utf8").toString("base64url");
}

export function accountKeyToNormalizedCompany(accountKey: string): string {
  try {
    return Buffer.from(accountKey, "base64url").toString("utf8");
  } catch {
    return "";
  }
}
