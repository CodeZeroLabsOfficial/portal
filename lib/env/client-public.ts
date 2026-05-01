import { z } from "zod";

/**
 * Client-visible Firebase + app configuration (NEXT_PUBLIC_*).
 * Returns `null` until all required keys are set — avoids failing `next build` without secrets.
 */
const firebasePublicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

export interface FirebasePublicConfig {
  appUrl?: string;
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  stripePublishableKey?: string;
}

export function getFirebasePublicConfig(): FirebasePublicConfig | null {
  const raw = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };

  const parsed = firebasePublicSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const v = parsed.data;
  return {
    appUrl: v.NEXT_PUBLIC_APP_URL,
    apiKey: v.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: v.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: v.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: v.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: v.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: v.NEXT_PUBLIC_FIREBASE_APP_ID,
    stripePublishableKey: v.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };
}
