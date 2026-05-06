import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { EditUserProfileForm } from "@/components/portal/edit-user-profile-form";

export default async function AdminSettingsProfileEditPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/settings/profile/edit");
  }

  return <EditUserProfileForm user={user} />;
}
