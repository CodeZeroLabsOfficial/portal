"use client";

import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console -- global failure diagnostics
    console.error(error);
  }, [error]);

  return (
    <html lang="en-AU">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#09090b", color: "#fafafa" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Application error</h1>
            <p style={{ marginTop: "8px", fontSize: "0.875rem", opacity: 0.8 }}>
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: "16px",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #3f3f46",
                background: "#18181b",
                color: "#fafafa",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
