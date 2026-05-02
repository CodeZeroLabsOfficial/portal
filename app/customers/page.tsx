import { redirect } from "next/navigation";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";

/**
 * Friendly `/customers` entry — staff land in the admin CRM; others go to the customer portal dashboard.
 */
export default async function CustomersEntryPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/customers");
  }
  if (hasRole(user, ["admin", "team"])) {
    redirect("/admin/customers");
  }
  redirect("/dashboard");
}
