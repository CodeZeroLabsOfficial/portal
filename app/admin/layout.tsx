import { redirect } from "next/navigation";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }
  if (!hasRole(user, ["admin", "team"])) {
    redirect("/dashboard");
  }
  return children;
}
