import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminAccountDetail } from "@/server/firestore/portal-data";
import { EditAccountForm } from "@/components/portal/edit-account-form";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ accountKey: string }>;
}

export default async function AdminAccountEditPage({ params }: PageProps) {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/accounts");
  }

  const { accountKey } = await params;
  const account = await getAdminAccountDetail(user, accountKey);
  if (!account) {
    notFound();
  }

  return (
    <WorkspaceShell
      title={`Edit · ${account.displayName}`}
      description="Update company details for this account"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <EditAccountForm account={account} accountKey={accountKey} />
    </WorkspaceShell>
  );
}
