import { z } from "zod";

/** Treat missing, empty, or whitespace-only values as unset (avoids Zod `.min(1)` failures on `""` in Vercel). */
function optionalTrimmedString(minLen: number) {
  return z
    .string()
    .optional()
    .transform((s) => {
      if (typeof s !== "string") return undefined;
      const t = s.trim();
      return t.length >= minLen ? t : undefined;
    });
}

/**
 * Server-only secrets. Never import this module from client components.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  STRIPE_SECRET_KEY: optionalTrimmedString(1),
  STRIPE_WEBHOOK_SECRET: optionalTrimmedString(1),
  /** Optional default Price id (`price_…`) for “Subscribe from proposal” when no id is passed in the API body. */
  STRIPE_DEFAULT_SUBSCRIPTION_PRICE_ID: optionalTrimmedString(1),
  /** Raw JSON for Firebase Admin service account (preferred on Vercel). */
  FIREBASE_SERVICE_ACCOUNT_JSON: z
    .string()
    .optional()
    .transform((s) => (typeof s === "string" && s.trim().length > 0 ? s : undefined)),
  /** Path to service account file for local development (optional). */
  GOOGLE_APPLICATION_CREDENTIALS: z
    .string()
    .optional()
    .transform((s) => (typeof s === "string" && s.trim().length > 0 ? s : undefined)),
  /**
   * Firebase Storage default bucket for Admin uploads (e.g. signed agreement PNGs).
   * Example: `code-zero-labs.firebasestorage.app` (Firebase console → Project settings → Your apps).
   * If unset, the app falls back to `{projectId}.firebasestorage.app` when project id env is set.
   */
  FIREBASE_STORAGE_BUCKET: optionalTrimmedString(3),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment: ${parsed.error.message}`);
    }
    cached = parsed.data;
  }
  return cached;
}
