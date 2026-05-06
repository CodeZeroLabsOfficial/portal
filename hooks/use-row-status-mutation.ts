"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Shared "move/update a single row" mutation hook used by the kanban boards
 * (tasks, opportunities). Tracks the row id while the action is in flight,
 * surfaces server errors with `window.alert`, and refreshes the router on
 * success.
 *
 * Returns `{ run, pendingId }`:
 * - `run(id, args)` calls `action(args)` and tracks `id` as pending.
 * - `pendingId` is the id currently being saved, or `null` when idle.
 */
export function useRowStatusMutation<TArgs>(
  action: (args: TArgs) => Promise<ActionResult>,
) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function run(id: string, args: TArgs) {
    setPendingId(id);
    const res = await action(args);
    setPendingId(null);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.refresh();
  }

  return { run, pendingId };
}
