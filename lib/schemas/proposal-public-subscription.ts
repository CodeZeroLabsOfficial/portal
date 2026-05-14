import { z } from "zod";

/** Public proposal viewer — same billing fields as Add subscription (collection + card), no staff session. */
export const proposalPublicSubscriptionModalSchema = z
  .object({
    collectionMethod: z.enum(["charge_automatically", "send_invoice"]).default("charge_automatically"),
    daysUntilDue: z.number().int().min(1).max(90).optional(),
    defaultPaymentMethodId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.collectionMethod === "send_invoice" && typeof v.daysUntilDue !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daysUntilDue"],
        message: "Days until due is required for send invoice.",
      });
    }
  });

export type ProposalPublicSubscriptionModalInput = z.infer<typeof proposalPublicSubscriptionModalSchema>;

/** Latest billing fields for `createProposalPublicSubscriptionAction` (public agreement flow). */
export type ProposalPublicSubscriptionBillingSnapshot = {
  collectionMethod: ProposalPublicSubscriptionModalInput["collectionMethod"];
  daysUntilDue?: number;
  defaultPaymentMethodId?: string;
  /** Whether `createProposalPublicSubscriptionAction` can run for the current method + card state. */
  readyToCreateSubscription: boolean;
};
