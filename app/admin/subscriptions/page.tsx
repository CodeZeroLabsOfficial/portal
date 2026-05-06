import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { isStripeApiConfigured, isStripeWebhookConfigured } from "@/lib/stripe/server";
import { getAdminSubscriptionsSnapshot } from "@/server/firestore/crm-customers";
import { AdminSubscriptionsDashboard } from "@/components/portal/admin-subscriptions-dashboard";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminSubscriptionsPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/subscriptions");
  }

  const data = await getAdminSubscriptionsSnapshot(user);
  const stripeApiConfigured = isStripeApiConfigured();
  const stripeWebhookConfigured = isStripeWebhookConfigured();

  return (
    <WorkspaceShell
      title="Subscriptions"
      description="Active and trialing subscriptions linked from Stripe to CRM customers."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <AdminSubscriptionsDashboard
        data={data}
        stripeApiConfigured={stripeApiConfigured}
        stripeWebhookConfigured={stripeWebhookConfigured}
      />
    </WorkspaceShell>
  );
}
