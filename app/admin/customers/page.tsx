import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";

/** Customer list must not be statically cached — navigations must re-fetch from Firestore. */
export const dynamic = "force-dynamic";
import { getAdminCustomerListRows } from "@/server/firestore/portal-data";
import { CustomerListPanel } from "@/components/portal/customer-list-panel";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export default async function AdminCustomersPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/customers");
  }

  const rows = await getAdminCustomerListRows(user);

  return (
    <WorkspaceShell
      title="Customers"
      description="CRM directory, profiles, and activity."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showRightAside={false}
      contentClassName="max-w-[1200px]"
    >
      <CustomerListPanel rows={rows} hasOrganization={Boolean(user.organizationId)} />
    </WorkspaceShell>
  );
}
