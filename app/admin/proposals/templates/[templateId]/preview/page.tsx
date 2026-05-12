import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

/** Legacy URL — canonical preview is `/admin/templates/[templateId]/preview`. */
export default async function LegacyProposalTemplatePreviewRedirect({ params }: PageProps) {
  const { templateId } = await params;
  redirect(`/admin/templates/${templateId}/preview`);
}
