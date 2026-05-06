import { z } from "zod";

const trimmed = z.string().trim();

export const addOpportunityNoteSchema = z.object({
  opportunityId: z.string().min(1),
  body: trimmed.min(1, "Note cannot be empty").max(8000),
});

export type AddOpportunityNoteInput = z.infer<typeof addOpportunityNoteSchema>;

export const opportunityActivityKindEnum = z.enum(["meeting", "call", "email", "other"]);

export const addOpportunityActivitySchema = z.object({
  opportunityId: z.string().min(1),
  kind: opportunityActivityKindEnum.default("meeting"),
  title: trimmed.min(1, "Title is required").max(240),
  detail: trimmed.max(4000).optional(),
  /** When the interaction took place. Defaults to "now" server-side when omitted. */
  occurredAtMs: z
    .number()
    .int()
    .finite()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
});

export type AddOpportunityActivityInput = z.infer<typeof addOpportunityActivitySchema>;
