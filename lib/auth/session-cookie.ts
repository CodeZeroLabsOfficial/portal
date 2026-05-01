/**
 * Name of the Firebase session cookie set after server-side session exchange.
 * Keep aligned with middleware and Server Actions that create/verify the cookie.
 */
export const FIREBASE_SESSION_COOKIE_NAME = "__session";

/** Session duration for Firebase Admin-issued cookies (5 days). */
export const FIREBASE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
