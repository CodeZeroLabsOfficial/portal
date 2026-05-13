import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/server-session";
import {
  PROPOSAL_LIBRARY_ALLOWED_CONTENT_TYPES,
  assertStaffLibraryBlobPathname,
} from "@/lib/proposal-media-library-blob";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await requireStaffSession();
        if (!user) {
          throw new Error("Unauthorized");
        }
        assertStaffLibraryBlobPathname(pathname);
        return {
          allowedContentTypes: [...PROPOSAL_LIBRARY_ALLOWED_CONTENT_TYPES],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify({ uid: user.uid }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
