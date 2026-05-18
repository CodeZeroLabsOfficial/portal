"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { runAdminWrite } from "@/lib/firebase/admin-write";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getContractTemplateForStaff } from "@/server/firestore/contract-templates";
import type { ProposalDocument } from "@/types/proposal";

const NAME_MAX = 200;
const DESC_MAX = 2000;
const TITLE_MAX = 200;
const HTML_MAX = 120_000;

const saveContractSchema = z.object({
  contractTemplateId: z.string().min(1),
  name: z.string().trim().min(1).max(NAME_MAX),
  description: z.string().max(DESC_MAX).optional(),
  agreementTitle: z.string().trim().min(1).max(TITLE_MAX),
  document: z.unknown().optional(),
  introHtml: z.string().max(20_000).optional(),
  legalHtml: z.string().max(HTML_MAX),
});

export async function createContractTemplateAction(): Promise<
  { ok: true; contractTemplateId: string } | { ok: false; message: string }
> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const ref = db.collection(COLLECTIONS.contractTemplates).doc();
  const write = await runAdminWrite(
    "contract_template_create_failed",
    { contractTemplateId: ref.id, uid: user.uid },
    "Could not create the contract template.",
    () =>
      ref.set({
        organizationId: user.organizationId ?? "default",
        createdByUid: user.uid,
        name: "New contract template",
        description: "",
        agreementTitle: "Services Agreement",
        stage: "draft",
        document: { title: "Services Agreement", blocks: [] },
        introHtml: "",
        legalHtml: "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates/contracts");
  revalidatePath(`/admin/templates/contracts/${ref.id}`);
  return { ok: true, contractTemplateId: ref.id };
}

const CLONE_SUFFIX = " (copy)";

export async function cloneContractTemplateAction(
  sourceId: string,
): Promise<{ ok: true; contractTemplateId: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const source = await getContractTemplateForStaff(user, sourceId);
  if (!source) return { ok: false, message: "Contract template not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const baseName = (source.name || "Untitled").trim() || "Untitled";
  const maxBaseLen = Math.max(1, NAME_MAX - CLONE_SUFFIX.length);
  const name =
    baseName.length + CLONE_SUFFIX.length <= NAME_MAX
      ? `${baseName}${CLONE_SUFFIX}`
      : `${baseName.slice(0, maxBaseLen)}${CLONE_SUFFIX}`;

  const ref = db.collection(COLLECTIONS.contractTemplates).doc();
  const payload: Record<string, unknown> = {
    organizationId: user.organizationId ?? "default",
    createdByUid: user.uid,
    name,
    description: source.description?.trim() ? source.description.trim() : "",
    agreementTitle: source.agreementTitle,
    stage: "draft",
    introHtml: source.introHtml?.trim() ? source.introHtml.trim() : "",
    legalHtml: source.legalHtml ?? "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (source.document) payload.document = source.document;

  const write = await runAdminWrite(
    "contract_template_clone_failed",
    { sourceId, contractTemplateId: ref.id, uid: user.uid },
    "Could not clone the contract template.",
    () => ref.set(payload),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates/contracts");
  return { ok: true, contractTemplateId: ref.id };
}

export async function saveContractTemplateAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsed = saveContractSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Invalid contract template payload." };

  const existing = await getContractTemplateForStaff(user, parsed.data.contractTemplateId);
  if (!existing) return { ok: false, message: "Contract template not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const descTrim = parsed.data.description?.trim();
  let document: ProposalDocument | undefined;
  if (parsed.data.document !== undefined) {
    try {
      document = parseProposalDocument(parsed.data.document);
    } catch {
      return { ok: false, message: "Invalid contract template document." };
    }
  }

  const patch: Record<string, unknown> = {
    name: parsed.data.name,
    agreementTitle: parsed.data.agreementTitle,
    introHtml: parsed.data.introHtml?.trim() ? parsed.data.introHtml.trim() : "",
    legalHtml: parsed.data.legalHtml,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (document) patch.document = document;
  if (descTrim) patch.description = descTrim;
  else patch.description = FieldValue.delete();

  const write = await runAdminWrite(
    "contract_template_save_failed",
    { contractTemplateId: parsed.data.contractTemplateId },
    "Could not save the contract template.",
    () => db.collection(COLLECTIONS.contractTemplates).doc(parsed.data.contractTemplateId).update(patch),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates/contracts");
  revalidatePath(`/admin/templates/contracts/${parsed.data.contractTemplateId}`);
  return { ok: true };
}

export async function deleteContractTemplateAction(
  contractTemplateId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const existing = await getContractTemplateForStaff(user, contractTemplateId);
  if (!existing) return { ok: false, message: "Contract template not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "contract_template_delete_failed",
    { contractTemplateId },
    "Could not delete the contract template.",
    () => db.collection(COLLECTIONS.contractTemplates).doc(contractTemplateId).delete(),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates/contracts");
  return { ok: true };
}

const contractTemplateStageSchema = z.enum(["draft", "published"]);

export async function setContractTemplateStageAction(
  contractTemplateId: string,
  stage: z.infer<typeof contractTemplateStageSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsedStage = contractTemplateStageSchema.safeParse(stage);
  if (!parsedStage.success) return { ok: false, message: "Invalid stage." };

  if (!(await getContractTemplateForStaff(user, contractTemplateId))) {
    return { ok: false, message: "Contract template not found." };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "contract_template_stage_failed",
    { contractTemplateId, stage: parsedStage.data },
    "Could not update template stage.",
    () =>
      db.collection(COLLECTIONS.contractTemplates).doc(contractTemplateId).update({
        stage: parsedStage.data,
        updatedAt: FieldValue.serverTimestamp(),
      }),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates/contracts");
  revalidatePath(`/admin/templates/contracts/${contractTemplateId}`);
  return { ok: true };
}
