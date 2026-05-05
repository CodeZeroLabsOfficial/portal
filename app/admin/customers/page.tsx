import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminCustomerListRows } from "@/server/firestore/portal-data";
import { CustomerListPanel } from "@/components/portal/customer-list-panel";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

/** Customer list must not be statically cached — navigations must re-fetch from Firestore. */
export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await connection();
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
      showRightAside={false}
    >
      <CustomerListPanel rows={rows} />
    </WorkspaceShell>
  );
}
