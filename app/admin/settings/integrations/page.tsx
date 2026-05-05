import { StripeIntegrationCard } from "@/components/stripe/stripe-integration-card";
import { isStripeApiConfigured, isStripeWebhookConfigured } from "@/lib/stripe/server";

export default function AdminSettingsIntegrationsPage() {
  const connected = isStripeApiConfigured() && isStripeWebhookConfigured();

  return (
    <div className="space-y-8">
      <StripeIntegrationCard connected={connected} />
    </div>
  );
}
