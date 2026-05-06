import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentSessionUser, isStaff } from "@/lib/auth/server-session";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

/**
 * Same document layout as `/p/[token]`, without a share link — for reviewing templates before they are used on proposals.
 */
export default async function ProposalTemplatePublicPreviewPage({ params }: PageProps) {
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
    <div className="min-h-dvh bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Public-style preview</span> · {template.name}. Recipients see
            this layout on a sent proposal; package actions stay in preview mode until a real link exists.
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
            <Link href={`/admin/proposals/templates/${template.id}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to edit
            </Link>
          </Button>
        </div>
      </div>
      <main className="proposal-print-root mx-auto min-h-[60vh] max-w-6xl px-4 py-12 sm:px-6 print:max-w-none print:py-8">
        <ProposalDocumentView document={template.document} branding={template.branding} />
      </main>
    </div>
  );
}
