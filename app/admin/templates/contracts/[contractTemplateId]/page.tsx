import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getContractTemplateForStaff } from "@/server/firestore/contract-templates";
import { WorkspaceShell } from "@/components/portal/workspace-shell";
import { ContractTemplateEditorClient } from "@/components/portal/contract-template-editor-client";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ contractTemplateId: string }> };

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
      <ContractTemplateEditorClient initial={row} />
    </WorkspaceShell>
  );
}
