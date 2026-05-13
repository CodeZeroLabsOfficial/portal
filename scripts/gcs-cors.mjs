/**
 * Build GCS CORS JSON for browser PUT uploads (signed URLs) and read GET/HEAD.
 *
 * Usage (from repo root):
 *   npm run storage:cors:write
 *   npm run storage:cors:apply
 *
 * Reads NEXT_PUBLIC_APP_URL, GCS_CORS_EXTRA_ORIGINS, and bucket vars from `.env` / `.env.local`
 * (only those keys — avoids parsing multiline JSON elsewhere in `.env.local`).
 *
 * Requires: Google Cloud SDK (`gcloud`) for `apply`, and bucket update permission.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "storage", "gcs-cors.generated.json");

const CORS_ENV_KEYS = new Set([
  "NEXT_PUBLIC_APP_URL",
  "GCS_CORS_EXTRA_ORIGINS",
  "FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
]);

function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Load only CORS/bucket keys so we never parse multiline service-account JSON. */
function loadEnvFile(relPath, { override } = { override: false }) {
  const p = path.join(root, relPath);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!CORS_ENV_KEYS.has(key)) continue;
    const raw = trimmed.slice(eq + 1);
    const val = stripQuotes(raw);
    if (override || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env", { override: false });
loadEnvFile(".env.local", { override: true });

function parseOrigins() {
  const fromApp = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const extra = process.env.GCS_CORS_EXTRA_ORIGINS?.trim();
  const set = new Set();

  if (fromApp) {
    try {
      const u = new URL(fromApp);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        throw new Error("only http(s)");
      }
      set.add(u.origin);
    } catch {
      throw new Error(`Invalid NEXT_PUBLIC_APP_URL: ${fromApp}`);
    }
  }

  if (extra) {
    for (const part of extra.split(",")) {
      const t = part.trim();
      if (!t) continue;
      try {
        const u = new URL(t);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          throw new Error("only http(s)");
        }
        set.add(u.origin);
      } catch {
        throw new Error(`Invalid origin in GCS_CORS_EXTRA_ORIGINS: ${t}`);
      }
    }
  }

  if (set.size === 0) {
    set.add("http://localhost:3000");
    console.warn(
      "No NEXT_PUBLIC_APP_URL or GCS_CORS_EXTRA_ORIGINS set; wrote CORS for http://localhost:3000 only. Add your production URL before apply.",
    );
  }

  return [...set].sort();
}

function bucketName() {
  const b =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (!b) {
    throw new Error("Set FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET for apply.");
  }
  return b;
}

function writeCors() {
  const origins = parseOrigins();
  const cors = [
    {
      origin: origins,
      method: ["GET", "HEAD", "PUT", "OPTIONS"],
      responseHeader: ["Content-Type", "Content-Length"],
      maxAgeSeconds: 3600,
    },
  ];
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(cors, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(root, outPath)}`);
  console.log("Origins:", origins.join(", "));
}

function apply() {
  writeCors();
  const bucket = bucketName();
  const gs = bucket.startsWith("gs://") ? bucket : `gs://${bucket}`;
  const r = spawnSync(
    "gcloud",
    ["storage", "buckets", "update", gs, `--cors-file=${outPath}`],
    { stdio: "inherit" },
  );
  if (r.error) {
    const code = "code" in r.error ? /** @type {{ code?: string }} */ (r.error).code : undefined;
    if (code === "ENOENT") {
      console.error("gcloud was not found. Install the Google Cloud SDK and authenticate (gcloud auth login).");
      process.exit(1);
    }
    throw r.error;
  }
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

const cmd = process.argv[2];
if (cmd === "write") {
  writeCors();
} else if (cmd === "apply") {
  apply();
} else {
  console.log(`Usage:
  npm run storage:cors:write
  npm run storage:cors:apply

  node scripts/gcs-cors.mjs write
  node scripts/gcs-cors.mjs apply

Environment (in .env or .env.local):
  NEXT_PUBLIC_APP_URL              Production app URL (origin used for CORS)
  GCS_CORS_EXTRA_ORIGINS           Optional comma-separated URLs (e.g. Vercel preview origins)
  FIREBASE_STORAGE_BUCKET          Target bucket (or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
`);
  process.exit(cmd === undefined || cmd === "help" ? 0 : 1);
}
