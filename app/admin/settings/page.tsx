import { redirect } from "next/navigation";

/** Default settings URL — section shells live under `/admin/settings/*`. */
export default function AdminSettingsIndexPage() {
  redirect("/admin/settings/company");
}
