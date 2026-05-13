import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProposalAnalyticsTracker } from "@/components/proposal/proposal-analytics-tracker";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { ProposalPasswordGate } from "@/components/proposal/proposal-password-gate";
import { ProposalPublicFooter } from "@/components/proposal/proposal-public-footer";
import { hasAgreementBlock } from "@/lib/proposal-blocks";
import { isProposalUnlockedForRequest } from "@/lib/proposal-public-session";
import {
  PROPOSAL_PUBLIC_CONTENT_CLASSES,
  PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES,
  PROPOSAL_PUBLIC_SHELL_CLASSES,
} from "@/lib/proposal-public-layout";
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
  return {
    title: "Proposal",
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

  const mainUnlockedClasses =
    "proposal-print-root w-full pb-12 pt-0 print:pb-8 sm:pb-14 min-h-dvh";

  return (
    <main
      className={unlocked ? mainUnlockedClasses : `${PROPOSAL_PUBLIC_SHELL_CLASSES} min-h-dvh`}
    >
      {!unlocked ? (
        <div className={PROPOSAL_PUBLIC_CONTENT_CLASSES}>
          <ProposalPasswordGate shareToken={proposal.shareToken} />
        </div>
      ) : (
        <>
          <ProposalAnalyticsTracker shareToken={proposal.shareToken} />
          <div className={PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES}>
            <ProposalDocumentView
              document={proposal.document}
              branding={proposal.branding}
              shareToken={proposal.shareToken}
              publicSelections={proposal.publicSelections}
              proposalStatus={proposal.status}
              acceptedByName={proposal.acceptedByName}
            />
          </div>
          <div className={`${PROPOSAL_PUBLIC_CONTENT_CLASSES} mt-10`}>
            <ProposalPublicFooter
              shareToken={proposal.shareToken}
              status={proposal.status}
              acceptedByName={proposal.acceptedByName}
              hideAcceptanceForm={hasAgreementBlock(proposal.document.blocks)}
            />
          </div>
        </>
      )}
    </main>
  );
}
