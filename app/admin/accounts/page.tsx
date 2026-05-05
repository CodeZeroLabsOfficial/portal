import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminAccountListRows } from "@/server/firestore/portal-data";
import { AccountListPanel } from "@/components/portal/account-list-panel";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/accounts");
  }

  const rows = await getAdminAccountListRows(user);

  return (
    <WorkspaceShell
      title="Accounts"
      description="Company directory from CRM."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <AccountListPanel rows={rows} />
    </WorkspaceShell>
  );
}
