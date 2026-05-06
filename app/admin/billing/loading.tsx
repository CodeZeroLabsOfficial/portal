import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default async function AdminBillingLoading() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/billing");
  }

  return (
    <WorkspaceShell
      title="Billing"
      description="Subscriptions, invoices, and Stripe-linked CRM profiles."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
    >
      <div className="space-y-8">
        <div className="space-y-2 rounded-xl border border-border/70 bg-card/80 p-5">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-4 max-w-xl rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </WorkspaceShell>
  );
}
