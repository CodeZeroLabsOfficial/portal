import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { CustomerDetailView } from "@/components/portal/customer-detail-view";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import {
  getCustomerRecordForOrg,
  listCustomerActivities,
  listCustomerNotes,
  listInvoicesForStripeCustomer,
  listProposalsForOrganization,
  listSubscriptionsForStripeCustomer,
  listTasksForCustomer,
} from "@/server/firestore/crm-customers";
import { listOpportunitiesForCustomer } from "@/server/firestore/crm-opportunities";

interface PageProps {
  params: Promise<{ customerId: string }>;
}

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/customers");
  }

  const { customerId } = await params;
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) {
    notFound();
  }

  const [notes, activities, subscriptions, invoices, orgProposals, tasks, opportunities] =
    await Promise.all([
      listCustomerNotes(user, customerId),
      listCustomerActivities(user, customerId),
      listSubscriptionsForStripeCustomer(user, customer.stripeCustomerId),
      listInvoicesForStripeCustomer(user, customer.stripeCustomerId),
      listProposalsForOrganization(user),
      listTasksForCustomer(user, customerId),
      listOpportunitiesForCustomer(user, customerId),
    ]);

  const emailLower = customer.email.trim().toLowerCase();
  const proposalsMatched = orgProposals.filter(
    (p) =>
      p.customerId === customer.id || p.recipientEmail?.trim().toLowerCase() === emailLower,
  );

  return (
    <WorkspaceShell
      title={customer.name || customer.email}
      description="Customer CRM profile"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
      contentClassName="max-w-[1100px]"
    >
      <CustomerDetailView
        customer={customer}
        subscriptions={subscriptions}
        invoices={invoices}
        proposalsMatched={proposalsMatched}
        opportunities={opportunities}
        notes={notes}
        activities={activities}
        tasks={tasks}
      />
    </WorkspaceShell>
  );
}
