import { cookies } from "next/headers";
import { verifyProposalAccessSeal } from "@/lib/proposal-share-crypto";

export const PROPOSAL_UNLOCK_COOKIE = "czl_proposal_unlock";

export async function isProposalUnlockedForRequest(proposalId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const seal = cookieStore.get(PROPOSAL_UNLOCK_COOKIE)?.value;
  const verified = verifyProposalAccessSeal(seal);
  return verified?.proposalId === proposalId;
}
