import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProposalAnalyticsTracker } from "@/components/proposal/proposal-analytics-tracker";
import { ProposalDocumentView } from "@/components/proposal/proposal-document-view";
import { ProposalPasswordGate } from "@/components/proposal/proposal-password-gate";
import { ProposalPublicFooter } from "@/components/proposal/proposal-public-footer";
import { hasAgreementBlock, proposalEndsInFullBleedBand } from "@/lib/proposal-blocks";
import { isProposalUnlockedForRequest } from "@/lib/proposal-public-session";
import {
  PROPOSAL_PUBLIC_CONTENT_CLASSES,
  PROPOSAL_PUBLIC_DOCUMENT_OUTER_CLASSES,
  PROPOSAL_PUBLIC_SHELL_CLASSES,
} from "@/lib/proposal-public-layout";
import { getProposalRecordByShareToken } from "@/server/firestore/parse-proposal";
import { getUserStoredTimeZone } from "@/server/firestore/user-locality";
import { hydrateAgreementBlocksInDocument } from "@/server/proposal/hydrate-agreement-contract-templates";
import { loadProposalCustomerSignerPrefill } from "@/server/proposal/public-proposal-customer-signer-prefill";
import { loadProposalPublicSubscriptionUi } from "@/server/proposal/public-proposal-subscription-ui";
import { listCatalogServicePickerOptionsForOrganizationId } from "@/server/firestore/catalog-services";

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

  const localityTimeZone = (await getUserStoredTimeZone(proposal.createdByUid))?.trim() || undefined;

  const requiresPassword = Boolean(proposal.sharePasswordHash);
  const unlocked = !requiresPassword || (await isProposalUnlockedForRequest(proposal.id));

  const publicDocument = unlocked
    ? await hydrateAgreementBlocksInDocument(proposal.document, proposal.organizationId)
    : proposal.document;

  const agreementPresent = hasAgreementBlock(publicDocument.blocks);
  const [publicSubscriptionUi, customerSignerPrefill, catalogServices] = unlocked
    ? await Promise.all([
        agreementPresent ? loadProposalPublicSubscriptionUi(proposal) : Promise.resolve(null),
        proposal.customerId?.trim()
          ? loadProposalCustomerSignerPrefill(proposal)
          : Promise.resolve(null),
        listCatalogServicePickerOptionsForOrganizationId(proposal.organizationId),
      ])
    : [null, null, []];
  /**
   * Mirror {@link ProposalPublicFooter}'s null-return condition: when an agreement
   * block drives signing and the proposal hasn't been accepted yet, the footer
   * renders nothing and we skip its outer wrapper entirely to avoid an empty
   * spacer band below the last content section.
   */
  const showFooter = !agreementPresent || proposal.status === "accepted";
  /** When the document already ends with a viewport-bleed band, `<main>`'s default bottom padding leaves a stripe of page background below it. */
  const flushBottom = !showFooter && proposalEndsInFullBleedBand(publicDocument.blocks);

  const mainUnlockedClasses = flushBottom
    ? "proposal-print-root w-full pb-0 pt-0 print:pb-0 min-h-dvh"
    : "proposal-print-root w-full pb-12 pt-0 print:pb-8 sm:pb-14 min-h-dvh";

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
              document={publicDocument}
              branding={proposal.branding}
              shareToken={proposal.shareToken}
              publicSelections={proposal.publicSelections}
              proposalStatus={proposal.status}
              acceptedByName={proposal.acceptedByName}
              acceptedSignatureDataUrl={proposal.acceptedSignatureDataUrl}
              acceptedAt={proposal.acceptedAt}
              localityTimeZone={localityTimeZone}
              publicSubscriptionUi={publicSubscriptionUi}
              customerSignerPrefill={customerSignerPrefill}
              catalogServices={catalogServices}
            />
          </div>
          {showFooter ? (
            <div className={`${PROPOSAL_PUBLIC_CONTENT_CLASSES} mt-10`}>
              <ProposalPublicFooter
                shareToken={proposal.shareToken}
                status={proposal.status}
                acceptedByName={proposal.acceptedByName}
                hideAcceptanceForm={agreementPresent}
              />
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
