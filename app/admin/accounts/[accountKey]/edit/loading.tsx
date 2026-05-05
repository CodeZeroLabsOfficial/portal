import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

export default async function AdminAccountEditLoading() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/accounts");
  }

  return (
    <WorkspaceShell
      title="Edit account"
      description="Update company details"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="space-y-8">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <div className="overflow-hidden rounded-xl border border-border/80">
          <Skeleton className="h-14 w-full rounded-none" />
          <div className="space-y-4 p-6">
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
