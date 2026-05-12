import { redirect } from "next/navigation";

/** Legacy URL — canonical templates hub is `/admin/templates`. */
export default function LegacyProposalTemplatesIndexRedirect() {
  redirect("/admin/templates");
}
