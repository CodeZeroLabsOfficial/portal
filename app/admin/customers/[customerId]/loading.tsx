import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

export default async function AdminCustomerDetailLoading() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/customers");
  }

  return (
    <WorkspaceShell
      title="Customer"
      description="Loading profile…"
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
      contentClassName="max-w-[1100px]"
    >
      <div className="space-y-8">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </WorkspaceShell>
  );
}
