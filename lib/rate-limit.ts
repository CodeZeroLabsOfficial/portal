/**
 * Simple in-memory fixed-window rate limiter for Route Handlers and Server Actions.
 *
 * Note: On serverless, each instance has its own memory — use Upstash Redis or similar
 * for accurate global limits in production.
 */

interface Bucket {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
}

export function rateLimitSync(
  key: string,
  max: number,
  windowMs: number,
  nowMs: number = Date.now(),
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket || nowMs - bucket.windowStartMs >= windowMs) {
    bucket = { count: 0, windowStartMs: nowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count < max) {
    bucket.count += 1;
    return {
      ok: true,
      remaining: max - bucket.count,
      resetMs: bucket.windowStartMs + windowMs,
    };
  }

  return {
    ok: false,
    remaining: 0,
    resetMs: bucket.windowStartMs + windowMs,
  };
}
