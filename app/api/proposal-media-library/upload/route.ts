import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/server-session";
import { saveLibraryUploadFromBuffer } from "@/server/storage/proposal-media-library-upload";

export const runtime = "nodejs";

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
  if (!entry || typeof entry === "string" || !("arrayBuffer" in entry)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const file = entry as File;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read file" }, { status: 400 });
  }

  try {
    const { objectPath } = await saveLibraryUploadFromBuffer(
      file.name,
      file.type || "application/octet-stream",
      buffer,
    );
    return NextResponse.json({ ok: true, objectPath });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    const status = message.toLowerCase().includes("larger than") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
