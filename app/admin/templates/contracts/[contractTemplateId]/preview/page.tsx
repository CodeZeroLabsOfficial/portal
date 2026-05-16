import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { contractTemplateRecordToDocument } from "@/lib/contract-template-document";
import { getContractTemplateForStaff } from "@/server/firestore/contract-templates";
import { ContractTemplateAgreementPreview } from "@/components/portal/contract-template-agreement-preview";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ contractTemplateId: string }>;
}

export default async function ContractTemplatePreviewPage({ params }: PageProps) {
  const { contractTemplateId } = await params;
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/admin/templates/contracts/${contractTemplateId}/preview`)}`);
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
    <div className="relative min-h-dvh bg-zinc-100">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/85 px-4 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Agreement preview</span>
            {" — "}
            Buyers see this layout in the View Agreement modal when this template is attached to an Accept block.
          </p>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
            <Link href={`/admin/templates/contracts/${row.id}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to edit
            </Link>
          </Button>
        </div>
      </header>
      <main className="min-h-dvh pb-12 pt-20">
        <ContractTemplateAgreementPreview agreementTitle={row.agreementTitle} document={document} />
      </main>
    </div>
  );
}
