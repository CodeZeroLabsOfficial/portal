import { redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { AdminWorkspaceProvider } from "@/components/portal/admin-workspace-provider";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }
  if (!isStaff(user)) {
    redirect("/dashboard");
  }
  return <AdminWorkspaceProvider organizationId={user.organizationId}>{children}</AdminWorkspaceProvider>;
}
