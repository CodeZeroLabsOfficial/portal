import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const PBKDF2_ITERS = 120_000;
const KEY_LEN = 32;
const DIGEST = "sha256";

/** Encodes `pbkdf2$iters$base64(salt)$base64(hash)` for storage on the proposal. */
export function hashSharePassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(plain, salt, PBKDF2_ITERS, KEY_LEN, DIGEST);
  return `pbkdf2$${PBKDF2_ITERS}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifySharePassword(plain: string, stored: string | undefined): boolean {
  if (!stored || !plain) return !stored;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iters = Number(parts[1]);
  if (!Number.isFinite(iters) || iters < 10_000) return false;
  const salt = Buffer.from(parts[2] ?? "", "base64url");
  const expected = Buffer.from(parts[3] ?? "", "base64url");
  if (salt.length < 8 || expected.length < 8) return false;
  const actual = pbkdf2Sync(plain, salt, iters, expected.length, DIGEST);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function getSessionSecret(): string {
  return process.env.PROPOSAL_SHARE_SECRET ?? "dev-proposal-share-secret";
}

/**
 * Seals time-limited public access after password verification.
 * Format: base64url payload, then ".", then hex hmac.
 */
export function sealProposalAccess(proposalId: string, ttlMs: number = 7 * 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const payload = `${proposalId}.${exp}`;
  const sig = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

export function verifyProposalAccessSeal(
  seal: string | undefined,
): { proposalId: string; exp: number } | null {
  if (!seal?.trim()) return null;
  try {
    const raw = Buffer.from(seal, "base64url").toString("utf8");
    const lastDot = raw.lastIndexOf(".");
    const prevDot = raw.lastIndexOf(".", lastDot - 1);
    if (prevDot <= 0 || lastDot <= prevDot) return null;
    const proposalId = raw.slice(0, prevDot);
    const expStr = raw.slice(prevDot + 1, lastDot);
    const sig = raw.slice(lastDot + 1);
    const exp = Number(expStr);
    if (!proposalId || !Number.isFinite(exp)) return null;
    const payload = `${proposalId}.${exp}`;
    const expected = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;
    if (Date.now() > exp) return null;
    return { proposalId, exp };
  } catch {
    return null;
  }
}
