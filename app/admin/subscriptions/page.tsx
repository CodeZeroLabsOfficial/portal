import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAdminSubscriptionsSnapshot } from "@/server/firestore/crm-customers";
import { SubscriptionListPanel } from "@/components/portal/subscription-list-panel";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

/** Subscription directory must reflect live Firestore mirrors, not stale static HTML. */
export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/subscriptions");
  }

  const data = await getAdminSubscriptionsSnapshot(user);

  const rows =
    data?.subscriptions.map((sub) => {
      const stripeCus = sub.customerId.trim();
      const link = stripeCus ? data.stripeCustomerLinks[stripeCus] : undefined;
      return {
        subscription: sub,
        accountName: link?.accountName ?? "—",
        crmCustomerId: link?.customerId,
      };
    }) ?? [];

  return (
    <WorkspaceShell
      title="Subscriptions"
      description="Synced subscription directory."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <SubscriptionListPanel rows={rows} />
    </WorkspaceShell>
  );
}
