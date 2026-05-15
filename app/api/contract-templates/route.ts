import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/server-session";
import { listContractTemplatesForOrg } from "@/server/firestore/contract-templates";

function previewSnippet(legalHtml: string, maxLen = 140): string {
  const plain = legalHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1)}…`;
}

export async function GET() {
  const user = await requireStaffSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await listContractTemplatesForOrg(user);
  const templates = rows.map((t) => ({
    id: t.id,
    name: t.name,
    agreementTitle: t.agreementTitle,
    introHtml: t.introHtml ?? "",
    legalHtml: t.legalHtml ?? "",
    previewSnippet: previewSnippet(t.legalHtml ?? ""),
  }));

  return NextResponse.json({ templates });
}
