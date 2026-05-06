import { NextResponse } from "next/server";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getStripe } from "@/lib/stripe/server";
import { getCustomerRecordForOrg, syncStripeCustomerBasics } from "@/server/firestore/crm-customers";
import { ensureStripeCustomer } from "@/server/stripe/proposal-billing";

interface Body {
  customerId?: string;
}

async function resolveStripeCustomerForCrmCustomer(
  user: Awaited<ReturnType<typeof getCurrentSessionUser>>,
  customerId: string,
) {
  if (!user || !isStaff(user)) return { error: "Unauthorized." as const };
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured on the server." as const };
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) return { error: "Customer not found." as const };
  const ensured = await ensureStripeCustomer(stripe, customer, user.organizationId);
  if (ensured.created || customer.stripeCustomerId !== ensured.stripeCustomerId) {
    await syncStripeCustomerBasics(user, customer.id, ensured.stripeCustomerId);
  }
  return { stripe, user, customer, stripeCustomerId: ensured.stripeCustomerId } as const;
}

/** Staff-only: create SetupIntent for collecting a reusable card payment method. */
export async function POST(req: Request) {
  const user = await getCurrentSessionUser();
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured on the server." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const customerId = body.customerId?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "Customer is required." }, { status: 400 });
  }

  try {
    const resolved = await resolveStripeCustomerForCrmCustomer(user, customerId);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.error === "Customer not found." ? 404 : 400 });
    }
    const { stripeCustomerId, customer } = resolved;

    const intent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        crm_customer_id: customer.id,
        ...(user.organizationId ? { organization_id: user.organizationId } : {}),
      },
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create setup intent." },
      { status: 500 },
    );
  }
}

/** Staff-only: returns customer's existing default card payment method if present. */
export async function GET(req: Request) {
  const user = await getCurrentSessionUser();
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured on the server." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId")?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "Customer is required." }, { status: 400 });
  }

  try {
    const resolved = await resolveStripeCustomerForCrmCustomer(user, customerId);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.error === "Customer not found." ? 404 : 400 });
    }
    const { stripeCustomerId } = resolved;

    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (stripeCustomer.deleted || typeof stripeCustomer === "string") {
      return NextResponse.json({ defaultPaymentMethodId: null });
    }

    const fromInvoiceSettings = stripeCustomer.invoice_settings?.default_payment_method;
    let defaultPm =
      fromInvoiceSettings && typeof fromInvoiceSettings === "object" && "id" in fromInvoiceSettings
        ? fromInvoiceSettings
        : null;

    // Fallback: many customers have attached cards but no invoice_settings default set.
    if (!defaultPm) {
      const pms = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card",
        limit: 1,
      });
      defaultPm = pms.data[0] ?? null;
    }

    if (!defaultPm) return NextResponse.json({ defaultPaymentMethodId: null });

    const card = "card" in defaultPm ? defaultPm.card : null;
    const summary =
      card && card.brand && card.last4
        ? `${card.brand.toUpperCase()} •••• ${card.last4}`
        : defaultPm.type
          ? defaultPm.type.replace(/_/g, " ")
          : "Saved payment method";

    return NextResponse.json({
      defaultPaymentMethodId: defaultPm.id,
      defaultPaymentMethodSummary: summary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not fetch default payment method." },
      { status: 500 },
    );
  }
}
