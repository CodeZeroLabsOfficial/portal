import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProposalAnalyticsTracker } from "@/components/proposal/proposal-analytics-tracker";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { ProposalPasswordGate } from "@/components/proposal/proposal-password-gate";
import { ProposalPublicFooter } from "@/components/proposal/proposal-public-footer";
import { isProposalUnlockedForRequest } from "@/lib/proposal-public-session";
import { getProposalRecordByShareToken } from "@/server/firestore/parse-proposal";

interface PublicProposalPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(props: PublicProposalPageProps): Promise<Metadata> {
  const params = await props.params;
  const token = params.token?.trim();
  if (!token || token.length < 8) {
    return { title: "Proposal" };
  }
  const proposal = await getProposalRecordByShareToken(token);
  if (!proposal || proposal.status === "draft") {
    return { title: "Proposal" };
  }
  const t = proposal.document.title?.trim() || proposal.title || "Proposal";
  return {
    title: t,
    robots: "noindex, nofollow",
  };
}

/**
 * Public proposal viewer — token-based share link (`shareToken`). Draft proposals are not exposed.
 * Optional password gate stores an HttpOnly session cookie (`czl_proposal_unlock`).
 */
export default async function PublicProposalPage(props: PublicProposalPageProps) {
  const params = await props.params;
  const token = params.token?.trim();

  if (!token || token.length < 8) {
    notFound();
  }

  const proposal = await getProposalRecordByShareToken(token);
  if (!proposal || proposal.status === "draft") {
    notFound();
  }

  const requiresPassword = Boolean(proposal.sharePasswordHash);
  const unlocked = !requiresPassword || (await isProposalUnlockedForRequest(proposal.id));

  return (
    <main className="proposal-print-root mx-auto min-h-dvh max-w-6xl px-4 py-12 sm:px-6 print:max-w-none print:py-8">
      {!unlocked ? (
        <ProposalPasswordGate shareToken={proposal.shareToken} />
      ) : (
        <>
          <ProposalAnalyticsTracker shareToken={proposal.shareToken} />
          <ProposalDocumentView
            document={proposal.document}
            branding={proposal.branding}
            shareToken={proposal.shareToken}
            publicSelections={proposal.publicSelections}
          />
          <ProposalPublicFooter
            shareToken={proposal.shareToken}
            status={proposal.status}
            acceptedByName={proposal.acceptedByName}
          />
        </>
      )}
    </main>
  );
}
