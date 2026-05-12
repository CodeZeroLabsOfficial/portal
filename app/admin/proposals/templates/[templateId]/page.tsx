import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { ProposalDocumentEditorLazy } from "@/components/proposal/proposal-document-editor-lazy";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditProposalTemplatePage({ params }: PageProps) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/proposals/templates");
  }
  if (!isStaff(user)) {
    redirect("/dashboard");
  }

  const { templateId } = await params;
  const template = await getProposalTemplateForStaff(user, templateId);
  if (!template) {
    notFound();
  }

  return (
    <WorkspaceShell
      title={template.name}
      description="Proposal template — blocks apply when creating a proposal from CRM."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="space-y-6">
        <ProposalDocumentEditorLazy
          variant="template"
          templateId={template.id}
          initialTemplateName={template.name}
          initialTemplateDescription={template.description ?? ""}
          initialDocument={template.document}
        />
      </div>
    </WorkspaceShell>
  );
}
