import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default async function AdminSubscriptionsLoading() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/subscriptions");
  }

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
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52 rounded-lg" />
          <Skeleton className="h-4 max-w-xl rounded-md" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card/80">
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
