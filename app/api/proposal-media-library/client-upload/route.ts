import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/server-session";
import {
  PROPOSAL_MEDIA_LIBRARY_BLOB_ALLOWED_CONTENT_TYPES,
  assertValidProposalMediaLibraryUploadPathname,
} from "@/lib/proposal-media-library-blob";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await requireStaffSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        assertValidProposalMediaLibraryUploadPathname(pathname);
        return {
          allowedContentTypes: PROPOSAL_MEDIA_LIBRARY_BLOB_ALLOWED_CONTENT_TYPES,
          addRandomSuffix: false,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload session failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
