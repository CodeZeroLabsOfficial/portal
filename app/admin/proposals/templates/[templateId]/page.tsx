import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

/** Legacy URL — canonical editor is `/admin/templates/[templateId]`. */
export default async function LegacyProposalTemplateEditorRedirect({ params }: PageProps) {
  const { templateId } = await params;
  redirect(`/admin/templates/${templateId}`);
}
