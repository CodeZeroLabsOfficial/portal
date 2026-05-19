import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { getCatalogServiceForStaff } from "@/server/firestore/catalog-services";
import { CatalogServiceEditForm } from "@/components/portal/catalog-service-edit-form";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ serviceId: string }>;
}

export default async function AdminServiceDetailPage({ params }: PageProps) {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/services");
  }

  const { serviceId } = await params;
  const service = await getCatalogServiceForStaff(user, serviceId);
  if (!service) {
    notFound();
  }

  return (
    <WorkspaceShell
      title={service.name}
      description="Edit service catalogue entry."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <CatalogServiceEditForm service={service} />
    </WorkspaceShell>
  );
}
