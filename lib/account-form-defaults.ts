import type { UpdateAccountFormInput } from "@/lib/schemas/account";
import type { AccountDetailAggregate } from "@/server/firestore/crm-customers";

export function accountToFormDefaults(
  account: AccountDetailAggregate,
  accountKey: string,
): UpdateAccountFormInput {
  return {
    accountKey,
    company: account.displayName,
    companyPhone: account.companyPhone ?? "",
    companyEmail: account.companyEmail ?? "",
    companyWebsite: account.companyWebsite ?? "",
    companyAddressLine1: account.companyAddressLine1 ?? "",
    companyAddressLine2: account.companyAddressLine2 ?? "",
    companyCity: account.companyCity ?? "",
    companyRegion: account.companyRegion ?? "",
    companyPostalCode: account.companyPostalCode ?? "",
    companyCountry: account.companyCountry ?? "",
  };
}

export type AccountInlineFieldOverrides = Partial<
  Pick<
    UpdateAccountFormInput,
    | "company"
    | "companyPhone"
    | "companyEmail"
    | "companyWebsite"
    | "companyAddressLine1"
    | "companyAddressLine2"
    | "companyCity"
    | "companyRegion"
    | "companyPostalCode"
    | "companyCountry"
  >
>;

export function buildAccountUpdatePayload(
  account: AccountDetailAggregate,
  accountKey: string,
  overrides: AccountInlineFieldOverrides = {},
): UpdateAccountFormInput {
  return {
    ...accountToFormDefaults(account, accountKey),
    ...overrides,
    accountKey,
  };
}
