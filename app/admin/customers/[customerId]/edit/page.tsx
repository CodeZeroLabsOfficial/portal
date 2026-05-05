import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { EditCustomerForm } from "@/components/portal/edit-customer-form";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { getCustomerRecordForOrg } from "@/server/firestore/crm-customers";

interface PageProps {
  params: Promise<{ customerId: string }>;
}

export default async function AdminCustomerEditPage({ params }: PageProps) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/customers");
  }

  const { customerId } = await params;
  const customer = await getCustomerRecordForOrg(user, customerId);
  if (!customer) {
    notFound();
  }

  return (
    <WorkspaceShell
      title={`Edit · ${customer.name || customer.email}`}
      description="Update customer profile"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <EditCustomerForm customer={customer} />
    </WorkspaceShell>
  );
}
