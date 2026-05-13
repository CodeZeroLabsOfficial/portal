import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/server-session";
import { getProposalMediaLibraryPrefix } from "@/lib/proposal-media-library-blob";
import { listProposalMediaLibraryAssets } from "@/server/storage/list-proposal-media-library";

export async function GET() {
  const user = await requireStaffSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assets = await listProposalMediaLibraryAssets();
  return NextResponse.json({ assets, libraryPrefix: getProposalMediaLibraryPrefix() });
}
