/** CRM merge-field picker entries — keep in sync with `replaceProposalTokens` in proposal-template-tokens. */
export type ProposalMergeTokenChoice = {
  readonly insert: string;
  readonly label: string;
  readonly hint?: string;
};

export const PROPOSAL_MERGE_TOKEN_CHOICES: readonly ProposalMergeTokenChoice[] = [
  { insert: "{{name}}", label: "Contact name", hint: "Customer name from CRM" },
  {
    insert: "{{first_name}}",
    label: "First name",
    hint: "First word of the contact name — e.g. “Hi {{first_name}}”",
  },
  { insert: "{{client}}", label: "Client", hint: "Synonym for contact name — e.g. “For {{client}}”" },
  { insert: "{{email}}", label: "Email" },
  { insert: "{{company}}", label: "Company" },
  {
    insert: "{{address}}",
    label: "Address",
    hint: "Contact mailing address from CRM (comma-separated lines)",
  },
  { insert: "{{opportunity}}", label: "Opportunity title" },
  { insert: "{{deal_amount}}", label: "Deal amount", hint: "Formatted when merging from an opportunity" },
  { insert: "{{date}}", label: "Date", hint: "Long date when the proposal is merged" },
];
