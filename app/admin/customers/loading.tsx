import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

export default async function AdminCustomersLoading() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/customers");
  }

  return (
    <WorkspaceShell
      title="Customers"
      description="Directory and contact details."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
      contentClassName="max-w-[1200px]"
    >
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="h-4 max-w-md rounded-md" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border/80">
          <div className="flex gap-3 border-b border-border p-4">
            <Skeleton className="h-9 flex-1 max-w-md rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
