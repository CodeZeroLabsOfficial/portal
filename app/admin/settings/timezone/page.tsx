import { redirect } from "next/navigation";

/** @deprecated Use `/admin/settings/locality` — kept for bookmarks. */
export default function AdminSettingsTimezoneRedirectPage() {
  redirect("/admin/settings/locality");
}
