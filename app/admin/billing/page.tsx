import { redirect } from "next/navigation";

export default function AdminBillingRedirectPage() {
  redirect("/admin/subscriptions");
}
