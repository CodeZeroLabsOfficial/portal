import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PUBLIC_ANALYTICS_RATE_MAX, PUBLIC_ANALYTICS_RATE_WINDOW_SEC } from "@/lib/constants";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin-app";
import { COLLECTIONS } from "@/server/firestore/collections";
import { getProposalRecordByShareToken } from "@/server/firestore/parse-proposal";

const bodySchema = z.object({
  event: z.enum(["view", "heartbeat"]),
  sessionId: z.string().min(8).max(200),
  secondsDelta: z.number().finite().nonnegative().max(120).optional(),
});

type Bucket = { count: number; windowStartMs: number };

const rateBuckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const windowMs = PUBLIC_ANALYTICS_RATE_WINDOW_SEC * 1000;
  let b = rateBuckets.get(ip);
  if (!b || now - b.windowStartMs > windowMs) {
    b = { count: 0, windowStartMs: now };
    rateBuckets.set(ip, b);
  }
  if (b.count >= PUBLIC_ANALYTICS_RATE_MAX) return false;
  b.count += 1;
  return true;
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const trimmed = token?.trim();
  if (!trimmed || trimmed.length < 8) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const ip = clientIp(req);
  if (!allowRequest(ip)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const proposal = await getProposalRecordByShareToken(trimmed);
  if (!proposal || proposal.status === "draft") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const ref = db.collection(COLLECTIONS.proposals).doc(proposal.id);
  const now = Date.now();
  const { event, secondsDelta } = parsed.data;

  if (event === "view") {
    const pack: Record<string, unknown> = {
      viewCount: FieldValue.increment(1),
      lastViewedAtMs: now,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (proposal.status === "sent") {
      pack.status = "viewed";
    }
    await ref.update(pack);
  } else {
    const delta = Math.min(secondsDelta ?? 0, 60);
    if (delta <= 0) {
      return NextResponse.json({ ok: true });
    }
    await ref.update({
      totalEngagementSeconds: FieldValue.increment(delta),
      lastViewedAtMs: now,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({ ok: true });
}
