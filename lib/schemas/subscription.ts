import { z } from "zod";

const trimmed = z.string().trim();

export const createSubscriptionSchema = z
  .object({
    customerId: trimmed.min(1, "Customer is required"),
    priceId: trimmed.min(1, "Product is required"),
    startDate: trimmed.regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    durationMonths: z.number().int().min(1).max(120),
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
