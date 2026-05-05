import { StripeIntegrationCard } from "@/components/stripe/stripe-integration-card";
import { isStripeApiConfigured, isStripeWebhookConfigured } from "@/lib/stripe/server";

export default function AdminSettingsIntegrationsPage() {
  const connected = isStripeApiConfigured() && isStripeWebhookConfigured();

  return (
    <div className="space-y-8">
      <StripeIntegrationCard connected={connected} />

      <section className="rounded-xl border border-white/[0.08] bg-[#111118] p-5 text-sm text-zinc-400">
        <h3 className="text-base font-semibold text-white">Webhook endpoint</h3>
        <p className="mt-2 leading-relaxed">
          Register this HTTPS URL in Stripe Dashboard → Developers → Webhooks (your production host):
        </p>
        <code className="mt-3 block break-all rounded-lg bg-black/40 px-3 py-2 text-[13px] text-zinc-200">
          POST …/api/webhooks/stripe
        </code>
        <p className="mt-3 text-xs text-zinc-500">
          Listening events include customer.*, customer.subscription.*, invoice.*, and payment_intent.* — see{" "}
          <span className="text-zinc-400">docs/STRIPE_SETUP.md</span> in the repository for the full checklist.
        </p>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#111118] p-5 text-sm text-zinc-400">
        <h3 className="text-base font-semibold text-white">Firebase extension (optional)</h3>
        <p className="mt-2 leading-relaxed">
          Stripe publishes official Firebase Extensions (e.g. syncing products or triggering emails). This portal uses
          custom webhook handling in Next.js so subscriptions, invoices, and payments land in your existing{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-300">subscriptions</code>,{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-300">invoices</code>, and{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-300">payments</code> collections. You can
          run extensions alongside if you avoid conflicting writes to the same document paths.
        </p>
      </section>
    </div>
  );
}
