import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server-session";
import { listCatalogServicesForOrg } from "@/server/firestore/catalog-services";
import { CatalogServicesListPanel } from "@/components/portal/catalog-services-list-panel";
import { NewCatalogServiceButton } from "@/components/portal/new-catalog-service-button";
import { WorkspaceShell } from "@/components/portal/workspace-shell";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  await connection();
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login?next=/admin/services");
  }

  const services = await listCatalogServicesForOrg(user);

  return (
    <WorkspaceShell
      title="Services"
      description="Product catalogue synced to Stripe."
      roleLabel={user.role}
      displayName={user.displayName ?? ""}
      userLabel={user.email || user.uid}
      showMainHeader={false}
      showRightAside={false}
    >
      <div className="mb-6 flex justify-end">
        <NewCatalogServiceButton />
      </div>
      <CatalogServicesListPanel services={services} />
    </WorkspaceShell>
  );
}
