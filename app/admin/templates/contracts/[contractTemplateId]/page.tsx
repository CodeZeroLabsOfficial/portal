import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { contractTemplateRecordToDocument } from "@/lib/contract-template-document";
import { getContractTemplateForStaff } from "@/server/firestore/contract-templates";
import { ProposalDocumentEditorLazy } from "@/components/proposal/proposal-document-editor-lazy";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
interface PageProps {
  params: Promise<{ contractTemplateId: string }>;
}

export default async function EditContractTemplatePage({ params }: PageProps) {
  await connection();
  const { contractTemplateId } = await params;
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/admin/templates/contracts/${contractTemplateId}`)}`);
  }
  if (!isStaff(user)) {
    redirect("/dashboard");
  }

  const row = await getContractTemplateForStaff(user, contractTemplateId);
  if (!row) {
    notFound();
  }

  const document = contractTemplateRecordToDocument(row);

  return (
    <WorkspaceShell
      title={row.name}
      description="Contract template — attach from Accept blocks in the proposal editor."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <ProposalDocumentEditorLazy
        variant="contract-template"
        contractTemplateId={row.id}
        initialTemplateName={row.name}
        initialTemplateDescription={row.description ?? ""}
        initialAgreementTitle={row.agreementTitle}
        initialDocument={document}
        localityTimeZone={user.timeZone?.trim() || undefined}
      />
    </WorkspaceShell>
  );
}
