"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";

async function requireStaff() {
  const user = await getCurrentSessionUser();
  if (!user || !hasRole(user, ["admin", "team"])) return null;
  return user;
}

const saveTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  title: z.string().trim().min(1).max(500),
  document: z.unknown(),
});

export async function createProposalTemplateAction(): Promise<
  { ok: true; templateId: string } | { ok: false; message: string }
> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: "Unauthorized." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.proposalTemplates).doc();
  await ref.set({
    organizationId: user.organizationId ?? "default",
    createdByUid: user.uid,
    name: "New template",
    description: "",
    document: {
      title: "Untitled proposal",
      blocks: [],
    },
    createdAtMs: now,
    updatedAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath("/admin/proposals");
  return { ok: true, templateId: ref.id };
}

export async function saveProposalTemplateAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = saveTemplateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Invalid template payload." };

  const existing = await getProposalTemplateForStaff(user, parsed.data.templateId);
  if (!existing) return { ok: false, message: "Template not found." };

  const docInput =
    typeof parsed.data.document === "object" && parsed.data.document !== null
      ? (parsed.data.document as Record<string, unknown>)
      : {};
  const normalized = parseProposalDocument({
    ...docInput,
    title: parsed.data.title,
  });

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  await db
    .collection(COLLECTIONS.proposalTemplates)
    .doc(parsed.data.templateId)
    .update({
      name: parsed.data.name,
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : FieldValue.delete(),
      document: normalized,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/templates/${parsed.data.templateId}`);
  return { ok: true };
}

export async function deleteProposalTemplateAction(
  templateId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaff();
  if (!user) return { ok: false, message: "Unauthorized." };

  const existing = await getProposalTemplateForStaff(user, templateId);
  if (!existing) return { ok: false, message: "Template not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  await db.collection(COLLECTIONS.proposalTemplates).doc(templateId).delete();
  revalidatePath("/admin/proposals");
  return { ok: true };
}
