"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth/server-session";
import { OPPORTUNITY_STAGES } from "@/lib/crm/opportunity-stages";
import {
  addOpportunityActivitySchema,
  addOpportunityNoteSchema,
} from "@/lib/schemas/opportunity-notes";
import { zodFirstMessage } from "@/lib/zod-error";
import type { OpportunityStage } from "@/types/opportunity";
import {
  appendOpportunityActivity,
  appendOpportunityNote,
  convertLeadToContactWithOpportunity,
  updateOpportunityStage,
} from "@/server/firestore/crm-opportunities";

const opportunityStageZodEnum = OPPORTUNITY_STAGES as unknown as [
  OpportunityStage,
  ...OpportunityStage[],
];

const convertLeadSchema = z.object({
  customerId: z.string().min(1),
  opportunityName: z.string().trim().min(1).max(240),
  initialStage: z.enum(opportunityStageZodEnum).optional(),
  amountMinor: z.number().finite().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export async function convertLeadToContactAction(
  raw: unknown,
): Promise<{ ok: true; customerId: string; opportunityId: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session to convert leads." };
  }
  const parsed = convertLeadSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, message: first ? `${first.path.join(".")}: ${first.message}` : "Invalid input" };
  }

  const result = await convertLeadToContactWithOpportunity(user, parsed.data.customerId, {
    opportunityName: parsed.data.opportunityName,
    initialStage: parsed.data.initialStage,
    amountMinor: parsed.data.amountMinor,
    currency: parsed.data.currency,
    notes: parsed.data.notes,
  });

  if (!result.ok) return result;

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${result.customerId}`);
  revalidatePath("/admin/accounts", "layout");
  revalidatePath("/admin/opportunities");
  revalidatePath(`/admin/opportunities/${result.opportunityId}`);
  return result;
}

const updateStageSchema = z.object({
  opportunityId: z.string().min(1),
  stage: z.enum(opportunityStageZodEnum),
});

export async function updateOpportunityStageAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = updateStageSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, message: first ? first.message : "Invalid input" };
  }

  const result = await updateOpportunityStage(user, parsed.data.opportunityId, parsed.data.stage);
  if (!result.ok) return result;

  revalidatePath("/admin/opportunities");
  revalidatePath(`/admin/opportunities/${parsed.data.opportunityId}`);
  revalidatePath("/admin/customers");
  return { ok: true };
}

export async function addOpportunityNoteAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = addOpportunityNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const result = await appendOpportunityNote(user, parsed.data.opportunityId, parsed.data.body);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(`/admin/opportunities/${parsed.data.opportunityId}`);
  return { ok: true };
}

export async function addOpportunityActivityAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = addOpportunityActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const result = await appendOpportunityActivity(user, parsed.data.opportunityId, {
    kind: parsed.data.kind,
    title: parsed.data.title,
    detail: parsed.data.detail,
    occurredAtMs: parsed.data.occurredAtMs,
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(`/admin/opportunities/${parsed.data.opportunityId}`);
  return { ok: true };
}
