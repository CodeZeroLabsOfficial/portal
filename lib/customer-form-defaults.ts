import type { UpdateCustomerFormInput } from "@/lib/schemas/customer";
import type { CustomerRecord } from "@/types/customer";

export function customerToFormDefaults(customer: CustomerRecord): UpdateCustomerFormInput {
  const customFields = Object.entries(customer.customFields)
    .filter(([k]) => k.trim().length > 0)
    .map(([key, value]) => ({ key, value }));
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    company: customer.company ?? "",
    companyPhone: customer.companyPhone ?? "",
    companyEmail: customer.companyEmail ?? "",
    companyWebsite: customer.companyWebsite ?? "",
    companyAbn: customer.companyAbn ?? "",
    companyAcn: customer.companyAcn ?? "",
    companyAddressLine1: customer.companyAddressLine1 ?? "",
    companyAddressLine2: customer.companyAddressLine2 ?? "",
    companyCity: customer.companyCity ?? "",
    companyRegion: customer.companyRegion ?? "",
    companyPostalCode: customer.companyPostalCode ?? "",
    companyCountry: customer.companyCountry ?? "",
    phone: customer.phone ?? "",
    addressLine1: customer.addressLine1 ?? "",
    addressLine2: customer.addressLine2 ?? "",
    city: customer.city ?? "",
    region: customer.region ?? "",
    postalCode: customer.postalCode ?? "",
    country: customer.country ?? "",
    tags: customer.tags,
    customFields,
    linkAuthByEmail: Boolean(customer.portalUserId),
    createAuthUserIfMissing: false,
  };
}

export type CustomerInlineFieldOverrides = Partial<
  Pick<
    UpdateCustomerFormInput,
    | "name"
    | "email"
    | "phone"
    | "company"
    | "companyAbn"
    | "companyAcn"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "region"
    | "postalCode"
    | "country"
  >
>;

export function buildCustomerUpdatePayload(
  customer: CustomerRecord,
  overrides: CustomerInlineFieldOverrides = {},
): UpdateCustomerFormInput {
  return {
    ...customerToFormDefaults(customer),
    ...overrides,
    id: customer.id,
  };
}
