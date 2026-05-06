import Stripe from "stripe";

/**
 * Subscriptions in these states are fully ended in Stripe. Any other status still
 * represents an ongoing or recoverable subscription — do not delete the customer.
 */
const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(["canceled", "incomplete_expired"]);

function subscriptionStatusIsOpen(status: Stripe.Subscription.Status): boolean {
  return !TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}

/**
 * Deletes a Stripe customer when it has no open subscriptions. Used to mirror CRM deletes.
 * If the customer is already gone in Stripe, succeeds without error.
 */
export async function deleteMirroredStripeCustomer(
  stripe: Stripe,
  stripeCustomerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const sub of page.data) {
        if (subscriptionStatusIsOpen(sub.status)) {
          return {
            ok: false,
            message:
              "This customer has an open Stripe subscription (for example active, trialing, or past due). Cancel or fully end it in Stripe before deleting.",
          };
        }
      }
      if (!page.has_more) break;
      const last = page.data[page.data.length - 1];
      if (!last) break;
      startingAfter = last.id;
    }
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
      return { ok: true };
    }
    const msg = err instanceof Error ? err.message : "Could not check Stripe subscriptions.";
    return { ok: false, message: msg };
  }

  try {
    await stripe.customers.del(stripeCustomerId);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
      return { ok: true };
    }
    const msg =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Stripe could not delete this customer.";
    return { ok: false, message: msg };
  }

  return { ok: true };
}
