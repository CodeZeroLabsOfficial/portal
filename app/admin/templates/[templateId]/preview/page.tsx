import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { syncProposalDocumentPackageTiersFromCatalog } from "@/lib/proposal-package-catalog-sync";
import { listCatalogServicePickerOptionsForOrg } from "@/server/firestore/catalog-services";
import { hydrateAgreementBlocksInDocument } from "@/server/proposal/hydrate-agreement-contract-templates";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES } from "@/lib/proposal-public-layout";
import { proposalEndsInFullBleedBand } from "@/lib/proposal-blocks";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

/**
 * Same document layout as `/p/[token]`, without a share link — for reviewing templates before they are used on proposals.
 */
export default async function ProposalTemplatePublicPreviewPage({ params }: PageProps) {
  const { templateId } = await params;
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/admin/templates/${templateId}/preview`)}`);
  }
  if (!isStaff(user)) {
    redirect("/dashboard");
  }

  const template = await getProposalTemplateForStaff(user, templateId);
  if (!template) {
    notFound();
  }

  const organizationId = user.organizationId ?? "default";
  const [hydrated, catalogServices] = await Promise.all([
    hydrateAgreementBlocksInDocument(template.document, organizationId),
    listCatalogServicePickerOptionsForOrg(user),
  ]);
  const previewDocument = syncProposalDocumentPackageTiersFromCatalog(
    hydrated,
    catalogServices,
  );

  /** Drop the trailing breathing room when the doc already ends in a full-bleed band — matches `/p/[token]`. */
  const flushBottom = proposalEndsInFullBleedBand(previewDocument.blocks);
  const mainClasses = flushBottom
    ? "proposal-print-root w-full pb-0 pt-0 print:pb-0 min-h-dvh"
    : "proposal-print-root w-full pb-12 pt-0 print:pb-8 sm:pb-14 min-h-dvh";

  return (
    <div className="relative min-h-dvh bg-background">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/85 px-4 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Public preview</span>
            {" — "}
            Recipients see this layout on a published proposal; package actions stay in preview mode until a real link
            exists.
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
            <Link href={`/admin/templates/${template.id}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to edit
            </Link>
          </Button>
        </div>
      </header>
      <main className={mainClasses}>
        <div className={PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES}>
          <ProposalDocumentView
            document={previewDocument}
            branding={template.branding}
            localityTimeZone={user.timeZone?.trim() || undefined}
          />
        </div>
      </main>
    </div>
  );
}
