import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getCustomerRecordForOrg } from "@/server/firestore/crm-customers";
import { getOpportunityForStaff } from "@/server/firestore/crm-opportunities";
import { OpportunityDetailView } from "@/components/portal/opportunity-detail-view";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

interface PageProps {
  params: Promise<{ opportunityId: string }>;
}

export default async function AdminOpportunityDetailPage({ params }: PageProps) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/opportunities");
  }

  const { opportunityId } = await params;
  const opportunity = await getOpportunityForStaff(user, opportunityId);
  if (!opportunity) {
    notFound();
  }

  const customer = await getCustomerRecordForOrg(user, opportunity.customerId);
  if (!customer) {
    notFound();
  }

  return (
    <WorkspaceShell
      title={opportunity.name}
      description="Opportunity detail"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <OpportunityDetailView opportunity={opportunity} customer={customer} />
    </WorkspaceShell>
  );
}
