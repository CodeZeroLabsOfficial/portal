import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { DeleteProposalTemplateButton } from "@/components/proposal/delete-proposal-template-button";
import { ProposalDocumentEditorLazy } from "@/components/proposal/proposal-document-editor-lazy";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditProposalTemplatePage({ params }: PageProps) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/proposals");
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
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
            <Link href="/admin/proposals">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All templates
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href={`/admin/proposals/templates/${template.id}/preview`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open public viewer
            </Link>
          </Button>
          <DeleteProposalTemplateButton templateId={template.id} templateName={template.name} />
        </div>

        <ProposalDocumentEditorLazy
          variant="template"
          templateId={template.id}
          initialTemplateName={template.name}
          initialTemplateDescription={template.description ?? ""}
          initialTitle={template.document.title || template.name}
          initialDocument={template.document}
        />
      </div>
    </WorkspaceShell>
  );
}
