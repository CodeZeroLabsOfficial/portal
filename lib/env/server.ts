import { z } from "zod";

/**
 * Server-only secrets. Never import this module from client components.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  /** Optional default Price id (`price_…`) for “Subscribe from proposal” when no id is passed in the API body. */
  STRIPE_DEFAULT_SUBSCRIPTION_PRICE_ID: z.string().min(1).optional(),
  /** Raw JSON for Firebase Admin service account (preferred on Vercel). */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** Path to service account file for local development (optional). */
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
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
