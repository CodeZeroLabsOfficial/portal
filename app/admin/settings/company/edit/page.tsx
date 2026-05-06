import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { EditCompanySettingsForm } from "@/components/portal/edit-company-settings-form";
import { getWorkspaceCompanySettings } from "@/server/firestore/organization-settings";

export default async function AdminSettingsCompanyEditPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/settings/company/edit");
  }

  const settings = await getWorkspaceCompanySettings(user);
  if (!settings) {
    return (
      <p className="text-sm text-destructive">
        Company settings could not be loaded. Check that Firebase Admin is configured.
      </p>
    );
  }

  return <EditCompanySettingsForm settings={settings} />;
}
