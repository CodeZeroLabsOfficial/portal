import { redirect } from "next/navigation";
import { LocalitySettingsForm } from "@/components/portal/locality-settings-form";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getAllCurrencyCodes, getAllTimeZones } from "@/lib/locality-data";

export default async function AdminSettingsLocalityPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/settings/locality");
  }

  const timeZones = getAllTimeZones();
  const currencyCodes = getAllCurrencyCodes();

  return <LocalitySettingsForm user={user} timeZones={timeZones} currencyCodes={currencyCodes} />;
}
