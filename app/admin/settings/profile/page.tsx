import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { UserProfileView } from "@/components/portal/user-profile-view";

export default async function AdminSettingsProfilePage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/settings/profile");
  }

  return <UserProfileView user={user} />;
}
