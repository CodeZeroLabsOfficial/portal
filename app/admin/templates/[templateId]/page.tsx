import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { listStripeSubscriptionProductOptions } from "@/server/stripe/subscription-product-options";
import { ProposalDocumentEditorLazy } from "@/components/proposal/proposal-document-editor-lazy";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { WORKSPACE_MAIN_FLUSH_TOP_CLASS } from "@/lib/workspace-layout";

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

  const subscriptionProductOptions = await listStripeSubscriptionProductOptions();

  return (
    <WorkspaceShell
      title={template.name}
      description="Template — blocks apply when creating a proposal from CRM."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
      mainClassName={WORKSPACE_MAIN_FLUSH_TOP_CLASS}
    >
      <ProposalDocumentEditorLazy
        variant="template"
        templateId={template.id}
        initialTemplateName={template.name}
        initialTemplateDescription={template.description ?? ""}
        initialDocument={template.document}
        localityTimeZone={user.timeZone?.trim() || undefined}
        subscriptionProductOptions={subscriptionProductOptions}
      />
    </WorkspaceShell>
  );
}
