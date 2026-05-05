"use client";

import * as React from "react";

const SESSION_KEY = "czl_prop_session";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      globalThis.crypto?.randomUUID?.().replace(/-/g, "") ??
      `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s-${Date.now()}`;
  }
}

export interface ProposalAnalyticsTrackerProps {
  shareToken: string;
}

/**
 * Emits a view once per tab session and lightweight engagement heartbeats for analytics on the proposal row.
 */
export function ProposalAnalyticsTracker({ shareToken }: ProposalAnalyticsTrackerProps) {
  const viewSent = React.useRef(false);

  React.useEffect(() => {
    const sessionId = getOrCreateSessionId();
    if (!sessionId || !shareToken) return;

    const base = `/api/proposals/public/${encodeURIComponent(shareToken)}/engagement`;

    async function post(body: Record<string, unknown>) {
      try {
        await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        /* ignore */
      }
    }

    if (!viewSent.current) {
      viewSent.current = true;
      void post({ event: "view", sessionId });
    }

    let lastBeat = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const secondsDelta = Math.round((now - lastBeat) / 1000);
      lastBeat = now;
      void post({ event: "heartbeat", sessionId, secondsDelta: Math.min(Math.max(secondsDelta, 0), 45) });
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [shareToken]);

  return null;
}
