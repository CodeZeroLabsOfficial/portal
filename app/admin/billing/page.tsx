import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { isStripeApiConfigured, isStripeWebhookConfigured } from "@/lib/stripe/server";
import { getAdminBillingSnapshot } from "@/server/firestore/crm-customers";
import { AdminBillingDashboard } from "@/components/portal/admin-billing-dashboard";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminBillingPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/billing");
  }

  const data = await getAdminBillingSnapshot(user);
  const stripeApiConfigured = isStripeApiConfigured();
  const stripeWebhookConfigured = isStripeWebhookConfigured();

  return (
    <WorkspaceShell
      title="Billing"
      description="Subscriptions, invoices, and Stripe-linked CRM profiles."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <AdminBillingDashboard
        data={data}
        stripeApiConfigured={stripeApiConfigured}
        stripeWebhookConfigured={stripeWebhookConfigured}
      />
    </WorkspaceShell>
  );
}
