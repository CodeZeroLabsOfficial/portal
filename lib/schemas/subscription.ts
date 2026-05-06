import { z } from "zod";

const trimmed = z.string().trim();

export const createSubscriptionSchema = z
  .object({
    customerId: trimmed.min(1, "Customer is required"),
    priceId: trimmed.min(1, "Stripe Price id is required").regex(/^price_/, "Price id must start with price_"),
    collectionMethod: z.enum(["charge_automatically", "send_invoice"]).default("charge_automatically"),
    daysUntilDue: z.number().int().min(1).max(90).optional(),
    defaultPaymentMethodId: trimmed.optional().transform((v) => (v && v.length > 0 ? v : undefined)),
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

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
