import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth/server-session";
import { createProposalMediaLibrarySignedPutUrl } from "@/server/storage/proposal-media-library-upload";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  filename: z.string().min(1).max(260),
  contentType: z.string().min(1).max(200).optional().default("application/octet-stream"),
});

export async function POST(request: Request) {
  const user = await requireStaffSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await createProposalMediaLibrarySignedPutUrl(
      parsed.data.filename,
      parsed.data.contentType ?? "application/octet-stream",
    );
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload URL could not be created";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
