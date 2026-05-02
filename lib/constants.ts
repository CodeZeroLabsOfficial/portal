/** Default currency for pricing, invoices, and Stripe display (Australia). */
export const DEFAULT_CURRENCY = "aud" as const;

/** Locale for AUD formatting in the portal UI. */
export const DEFAULT_LOCALE = "en-AU" as const;

export const APP_NAME = "Code Zero Labs Portal";

/** Shown next to the workspace logo (aligned with package release cadence). */
export const PORTAL_DISPLAY_VERSION = "v0.1";

/** Cookie name used to persist theme preference (next-themes). */
export const THEME_COOKIE_NAME = "portal-theme";

/** Rate limit window for public proposal analytics endpoints (seconds). */
export const PUBLIC_ANALYTICS_RATE_WINDOW_SEC = 60;

/** Max requests per IP per window for public analytics (proposal engagement). */
export const PUBLIC_ANALYTICS_RATE_MAX = 120;
