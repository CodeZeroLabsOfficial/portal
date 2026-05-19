"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Mail, MapPin, Phone, Tag, Users } from "lucide-react";
import { z } from "zod";
import { updateCustomerAction } from "@/server/actions/customers-crm";
import {
  buildCustomerUpdatePayload,
  type CustomerInlineFieldOverrides,
} from "@/lib/customer-form-defaults";
import { addressBlockFromFields, addressFieldsFromBlock } from "@/lib/format";
import type { CustomerRecord } from "@/types/customer";
import { InlineEditableField } from "@/components/portal/inline-editable-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const detailLabelClass =
  "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

const detailLabelIconClass = "h-3.5 w-3.5 shrink-0 opacity-80";

export interface CustomerContactDetailsCardProps {
  customer: CustomerRecord;
}

export function CustomerContactDetailsCard({ customer }: CustomerContactDetailsCardProps) {
  const router = useRouter();
  const [activeFieldId, setActiveFieldId] = React.useState<string | null>(null);
  const fieldsDisabled = customer.status === "archived";
  const addressBlock = addressBlockFromFields({
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    region: customer.region,
    postalCode: customer.postalCode,
    country: customer.country,
  });

  async function persistField(
    overrides: CustomerInlineFieldOverrides,
  ): Promise<{ ok: boolean; message?: string }> {
    const res = await updateCustomerAction(buildCustomerUpdatePayload(customer, overrides));
    if (res.ok) {
      router.refresh();
    }
    return res;
  }

  const phoneDisplay = customer.phone?.trim() || customer.companyPhone?.trim() || "";

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm lg:col-span-2">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
          Contact details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-6 text-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className={detailLabelClass}>
              <Tag className={detailLabelIconClass} aria-hidden />
              Name
            </dt>
            <dd>
              <InlineEditableField
                fieldId="name"
                activeFieldId={activeFieldId}
                onActiveFieldIdChange={setActiveFieldId}
                value={customer.name}
                editLabel="name"
                placeholder="Contact name"
                disabled={fieldsDisabled}
                onSave={async (next) => {
                  const trimmed = next.trim();
                  if (!trimmed) {
                    return { ok: false, message: "Name is required." };
                  }
                  if (trimmed.length > 200) {
                    return { ok: false, message: "Name must be 200 characters or fewer." };
                  }
                  return persistField({ name: trimmed });
                }}
              />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className={detailLabelClass}>
              <Mail className={detailLabelIconClass} aria-hidden />
              Email
            </dt>
            <dd>
              <InlineEditableField
                fieldId="email"
                activeFieldId={activeFieldId}
                onActiveFieldIdChange={setActiveFieldId}
                value={customer.email}
                editLabel="email"
                placeholder="email@example.com"
                disabled={fieldsDisabled}
                onSave={async (next) => {
                  const trimmed = next.trim();
                  if (!trimmed) {
                    return { ok: false, message: "Email is required." };
                  }
                  if (!z.string().email().safeParse(trimmed).success) {
                    return { ok: false, message: "Enter a valid email address." };
                  }
                  if (trimmed.length > 320) {
                    return { ok: false, message: "Email must be 320 characters or fewer." };
                  }
                  return persistField({ email: trimmed });
                }}
              />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className={detailLabelClass}>
              <Phone className={detailLabelIconClass} aria-hidden />
              Phone
            </dt>
            <dd>
              <InlineEditableField
                fieldId="phone"
                activeFieldId={activeFieldId}
                onActiveFieldIdChange={setActiveFieldId}
                value={phoneDisplay}
                editLabel="phone"
                placeholder="Phone number"
                disabled={fieldsDisabled}
                onSave={async (next) => persistField({ phone: next.trim() })}
              />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className={detailLabelClass}>
              <Building2 className={detailLabelIconClass} aria-hidden />
              Company
            </dt>
            <dd>
              <InlineEditableField
                fieldId="company"
                activeFieldId={activeFieldId}
                onActiveFieldIdChange={setActiveFieldId}
                value={customer.company ?? ""}
                editLabel="company"
                placeholder="Company name"
                disabled={fieldsDisabled}
                onSave={async (next) => persistField({ company: next.trim() })}
              />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className={detailLabelClass}>
              <FileText className={detailLabelIconClass} aria-hidden />
              ABN
            </dt>
            <dd>
              <InlineEditableField
                fieldId="companyAbn"
                activeFieldId={activeFieldId}
                onActiveFieldIdChange={setActiveFieldId}
                value={customer.companyAbn ?? ""}
                editLabel="ABN"
                placeholder="ABN"
                disabled={fieldsDisabled}
                onSave={async (next) => persistField({ companyAbn: next.trim() })}
              />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className={detailLabelClass}>
              <FileText className={detailLabelIconClass} aria-hidden />
              ACN
            </dt>
            <dd>
              <InlineEditableField
                fieldId="companyAcn"
                activeFieldId={activeFieldId}
                onActiveFieldIdChange={setActiveFieldId}
                value={customer.companyAcn ?? ""}
                editLabel="ACN"
                placeholder="ACN"
                disabled={fieldsDisabled}
                onSave={async (next) => persistField({ companyAcn: next.trim() })}
              />
            </dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className={detailLabelClass}>
              <MapPin className={detailLabelIconClass} aria-hidden />
              Address
            </dt>
            <dd>
              <InlineEditableField
                fieldId="address"
                activeFieldId={activeFieldId}
                onActiveFieldIdChange={setActiveFieldId}
                value={addressBlock}
                editLabel="address"
                placeholder="Street, city, state, postcode, country"
                multiline
                disabled={fieldsDisabled}
                onSave={async (next) => {
                  const parsed = addressFieldsFromBlock(next);
                  return persistField({
                    addressLine1: parsed.addressLine1 ?? "",
                    addressLine2: parsed.addressLine2 ?? "",
                    city: parsed.city ?? "",
                    region: parsed.region ?? "",
                    postalCode: parsed.postalCode ?? "",
                    country: parsed.country ?? "",
                  });
                }}
              />
            </dd>
          </div>
        </dl>
        {customer.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {customer.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-xs font-medium text-foreground/90"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
