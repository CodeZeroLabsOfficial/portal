"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth/server-session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { runAdminWrite } from "@/lib/firebase/admin-write";
import { omitUndefinedDeep } from "@/lib/omit-undefined-deep";
import { encodeProposalDocumentForFirestore } from "@/lib/proposal-firestore-document";
import { syncProposalDocumentPackageTiersFromCatalog } from "@/lib/proposal-package-catalog-sync";
import { parseProposalDocument } from "@/lib/schemas/proposal-document";
import { listCatalogServicePickerOptionsForOrganizationId } from "@/server/firestore/catalog-services";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getProposalTemplateForStaff } from "@/server/firestore/proposal-templates";
import { hydrateAgreementBlocksInDocument } from "@/server/proposal/hydrate-agreement-contract-templates";

const proposalBrandingSchema = z
  .object({
    logoUrl: z.string().max(8192).optional(),
    primaryColor: z.string().max(32).optional(),
    fontFamily: z.string().max(200).optional(),
  })
  .optional();

const saveTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  title: z.string().trim().min(1).max(500),
  document: z.unknown(),
  branding: proposalBrandingSchema,
});

export async function createProposalTemplateAction(): Promise<
  { ok: true; templateId: string } | { ok: false; message: string }
> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.proposalTemplates).doc();
  const write = await runAdminWrite(
    "proposal_template_create_failed",
    { templateId: ref.id, uid: user.uid },
    "Could not create the template.",
    () =>
      ref.set({
        organizationId: user.organizationId ?? "default",
        createdByUid: user.uid,
        name: "New template",
        description: "",
        templateType: "proposal",
        stage: "draft",
        document: {
          title: "Untitled proposal",
          blocks: [],
        },        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  return { ok: true, templateId: ref.id };
}

const TEMPLATE_NAME_MAX = 200;
const CLONE_NAME_SUFFIX = " (copy)";

export async function cloneProposalTemplateAction(
  sourceTemplateId: string,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const source = await getProposalTemplateForStaff(user, sourceTemplateId);
  if (!source) return { ok: false, message: "Template not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const baseName = (source.name || "Untitled template").trim() || "Untitled template";
  const maxBaseLen = Math.max(1, TEMPLATE_NAME_MAX - CLONE_NAME_SUFFIX.length);
  const name =
    baseName.length + CLONE_NAME_SUFFIX.length <= TEMPLATE_NAME_MAX
      ? `${baseName}${CLONE_NAME_SUFFIX}`
      : `${baseName.slice(0, maxBaseLen)}${CLONE_NAME_SUFFIX}`;

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.proposalTemplates).doc();
  const payload: Record<string, unknown> = {
    organizationId: user.organizationId ?? "default",
    createdByUid: user.uid,
    name,
    description: source.description?.trim() ? source.description.trim() : "",
    templateType: source.templateType,
    stage: "draft",
    document: omitUndefinedDeep(encodeProposalDocumentForFirestore(source.document)) as Record<string, unknown>,    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (source.branding && Object.keys(source.branding).length > 0) {
    payload.branding = source.branding;
  }

  const write = await runAdminWrite(
    "proposal_template_clone_failed",
    { sourceTemplateId, templateId: ref.id, uid: user.uid },
    "Could not clone the template.",
    () => ref.set(payload),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  return { ok: true, templateId: ref.id };
}

export async function saveProposalTemplateAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
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
  const hydrated = await hydrateAgreementBlocksInDocument(
    normalized,
    user.organizationId ?? "default",
  );
  const catalogServices = await listCatalogServicePickerOptionsForOrganizationId(
    user.organizationId ?? "default",
  );
  const syncedDocument = syncProposalDocumentPackageTiersFromCatalog(hydrated, catalogServices);

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const brandingPayload = (() => {
    const raw = parsed.data.branding;
    if (!raw) return FieldValue.delete();
    const b = omitUndefinedDeep(raw) as Record<string, unknown>;
    if (Object.keys(b).length === 0) return FieldValue.delete();
    return b;
  })();

  const write = await runAdminWrite(
    "proposal_template_save_failed",
    { templateId: parsed.data.templateId },
    "Could not save the template.",
    () =>
      db
        .collection(COLLECTIONS.proposalTemplates)
        .doc(parsed.data.templateId)
        .update({
          name: parsed.data.name,
          description: parsed.data.description?.trim()
            ? parsed.data.description.trim()
            : FieldValue.delete(),
          document: omitUndefinedDeep(
            encodeProposalDocumentForFirestore(syncedDocument),
          ) as Record<string, unknown>,
          branding: brandingPayload,
          updatedAt: FieldValue.serverTimestamp(),
        }),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${parsed.data.templateId}`);
  return { ok: true };
}

const templateStageSchema = z.enum(["draft", "published"]);

export async function setProposalTemplateStageAction(
  templateId: string,
  stage: z.infer<typeof templateStageSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const parsedStage = templateStageSchema.safeParse(stage);
  if (!parsedStage.success) return { ok: false, message: "Invalid stage." };

  if (!(await getProposalTemplateForStaff(user, templateId))) {
    return { ok: false, message: "Template not found." };
  }

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "proposal_template_stage_failed",
    { templateId, stage: parsedStage.data },
    "Could not update template stage.",
    () =>
      db.collection(COLLECTIONS.proposalTemplates).doc(templateId).update({
        stage: parsedStage.data,        updatedAt: FieldValue.serverTimestamp(),
      }),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${templateId}`);
  return { ok: true };
}

export async function deleteProposalTemplateAction(
  templateId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) return { ok: false, message: "Unauthorized." };

  const existing = await getProposalTemplateForStaff(user, templateId);
  if (!existing) return { ok: false, message: "Template not found." };

  const db = getFirebaseAdminFirestore();
  if (!db) return { ok: false, message: "Database unavailable." };

  const write = await runAdminWrite(
    "proposal_template_delete_failed",
    { templateId },
    "Could not delete the template.",
    () => db.collection(COLLECTIONS.proposalTemplates).doc(templateId).delete(),
  );
  if (!write.ok) return write;

  revalidatePath("/admin/templates");
  return { ok: true };
}
