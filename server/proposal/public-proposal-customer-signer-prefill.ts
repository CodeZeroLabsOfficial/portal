import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import type { ProposalCustomerSignerPrefill, ProposalRecord } from "@/types/proposal";

/** Loads CRM name, email, and company for the proposal’s linked customer (public agreement prefill). */
export async function loadProposalCustomerSignerPrefill(
  proposal: ProposalRecord,
): Promise<ProposalCustomerSignerPrefill | null> {
  const id = proposal.customerId?.trim();
  if (!id) return null;
  const db = getFirebaseAdminFirestore();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTIONS.customers).doc(id).get();
    if (!snap.exists) return null;
    const d = snap.data() as Record<string, unknown>;
    const name = typeof d.name === "string" ? d.name.trim() : "";
    const emailFromDoc = typeof d.email === "string" ? d.email.trim() : "";
    const email = emailFromDoc || (proposal.recipientEmail?.trim() ?? "");
    const organization = typeof d.company === "string" ? d.company.trim() : "";
    return { name, email, organization };
  } catch {
    return null;
  }
}
