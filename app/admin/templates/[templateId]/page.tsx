import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { listCatalogServicePickerOptionsForOrg } from "@/server/firestore/catalog-services";
import { ProposalDocumentEditorLazy } from "@/components/proposal/proposal-document-editor-lazy";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
interface PageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditProposalTemplatePage({ params }: PageProps) {
  const { templateId } = await params;
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/admin/templates/${templateId}`)}`);
  }
  if (!isStaff(user)) {
    redirect("/dashboard");
  }

  const template = await getProposalTemplateForStaff(user, templateId);
  if (!template) {
    notFound();
  }

  const catalogServiceOptions = await listCatalogServicePickerOptionsForOrg(user);

  return (
    <WorkspaceShell
      title={template.name}
      description="Template — blocks apply when creating a proposal from CRM."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <ProposalDocumentEditorLazy
        variant="template"
        templateId={template.id}
        initialTemplateName={template.name}
        initialTemplateDescription={template.description ?? ""}
        initialTemplateStage={template.stage}
        initialDocument={template.document}
        localityTimeZone={user.timeZone?.trim() || undefined}
        catalogServiceOptions={catalogServiceOptions}
      />
    </WorkspaceShell>
  );
}
