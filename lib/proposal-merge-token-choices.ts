/** CRM merge-field picker entries — keep in sync with `replaceProposalTokens` in proposal-template-tokens. */
export type ProposalMergeTokenChoice = {
  readonly insert: string;
  readonly label: string;
  /** Shown after the token, e.g. “For Address”. */
  readonly description?: string;
};

export const PROPOSAL_MERGE_TOKEN_CHOICES: readonly ProposalMergeTokenChoice[] = [
  { insert: "{{address}}", label: "Contact Address", description: "For Address" },
  { insert: "{{client}}", label: "Contact Name", description: "For Customer" },
  { insert: "{{first_name}}", label: "First Name" },
  { insert: "{{company}}", label: "Company", description: "For Company Name" },
  { insert: "{{acn}}", label: "ACN", description: "Company ACN from customer" },
  { insert: "{{date}}", label: "Date", description: "For Date" },
  { insert: "{{deal_amount}}", label: "Deal amount", description: "Deal amount" },
  { insert: "{{email}}", label: "Email", description: "For Contact Email" },
  { insert: "{{opportunity}}", label: "Opportunity title", description: "For Opportunity name" },
];
