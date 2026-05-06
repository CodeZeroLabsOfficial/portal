"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/auth/server-session";
import { createAccountFormSchema, updateAccountFormSchema } from "@/lib/schemas/account";
import { zodErrorToMessage } from "@/lib/zod-error";
import {
  createAccountDocument,
  updateAccountDetailsForGroup,
} from "@/server/firestore/crm-customers";

export async function updateAccountAction(
  raw: unknown,
): Promise<{ ok: true; newAccountKey: string } | { ok: false; message: string }> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session to edit accounts." };
  }
  const parsed = updateAccountFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }

  const previousKey = parsed.data.accountKey;
  const result = await updateAccountDetailsForGroup(user, parsed.data);
  if (!result.ok) return result;

  revalidatePath("/admin/customers", "layout");
  revalidatePath("/admin/accounts", "layout");
  revalidatePath(`/admin/accounts/${previousKey}`, "page");
  revalidatePath(`/admin/accounts/${result.newAccountKey}`, "page");
  return { ok: true, newAccountKey: result.newAccountKey };
}

export async function createAccountAction(
  raw: unknown,
): Promise<
  | { ok: true; accountKey: string; alreadyExisted: boolean }
  | { ok: false; message: string }
> {
  const user = await requireStaffSession();
  if (!user) {
    return { ok: false, message: "You need an admin or team session to add accounts." };
  }
  const parsed = createAccountFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: zodErrorToMessage(parsed.error) };
  }

  const result = await createAccountDocument(user, parsed.data);
  if (!result.ok) return result;

  revalidatePath("/admin/accounts", "layout");
  revalidatePath(`/admin/accounts/${result.accountKey}`, "page");
  return { ok: true, accountKey: result.accountKey, alreadyExisted: result.alreadyExisted };
}
