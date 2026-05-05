"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentSessionUser, hasRole } from "@/lib/auth/server-session";
import { updateAccountFormSchema } from "@/lib/schemas/account";
import { updateAccountDetailsForGroup } from "@/server/firestore/crm-customers";

function zodErrorToMessage(error: ZodError): string {
  const first = error.errors[0];
  return first ? `${first.path.join(".")}: ${first.message}` : "Invalid input";
}

async function requireStaffForCrm() {
  const user = await getCurrentSessionUser();
  if (!user || !hasRole(user, ["admin", "team"])) return null;
  return user;
}

export async function updateAccountAction(
  raw: unknown,
): Promise<{ ok: true; newAccountKey: string } | { ok: false; message: string }> {
  const user = await requireStaffForCrm();
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
