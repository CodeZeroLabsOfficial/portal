import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/server-session";
import { saveLibraryUploadFromWebFile } from "@/server/storage/proposal-media-library-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await requireStaffSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const entry = formData.get("file");
  if (!entry || typeof entry === "string" || !("stream" in entry)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const file = entry as File;

  try {
    const { objectPath } = await saveLibraryUploadFromWebFile(file);
    return NextResponse.json({ ok: true, objectPath });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    const status = message.toLowerCase().includes("direct upload limit") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
