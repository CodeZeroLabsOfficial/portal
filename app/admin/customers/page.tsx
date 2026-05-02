import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
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
      description="Directory and contact details."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      contentClassName="max-w-[1200px]"
    >
      <CustomerListPanel rows={rows} />
    </WorkspaceShell>
  );
}
