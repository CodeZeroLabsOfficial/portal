/**
 * Builds an absolute origin for Stripe redirects (Billing Portal, Checkout).
 * Prefer forwarding headers from your reverse proxy / Vercel.
 */
export function getRequestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) {
    return `${proto}://${host}`;
  }
  const fallback = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return fallback && fallback.length > 0 ? fallback.replace(/\/$/, "") : "http://localhost:3000";
}
