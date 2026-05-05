import { redirect } from "next/navigation";

/** Avoid `/admin/proposals/templates` matching `[proposalId]` — send users to the templates hub. */
export default function ProposalTemplatesRedirectPage() {
  redirect("/admin/proposals");
}
