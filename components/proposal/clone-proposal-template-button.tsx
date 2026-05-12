"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { cloneProposalTemplateAction } from "@/server/actions/proposal-templates";
import { Button } from "@/components/ui/button";

export function CloneProposalTemplateButton({
  templateId,
  iconOnly,
}: {
  templateId: string;
  /** Compact icon button for tables and toolbars. */
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onClick() {
    setBusy(true);
    const res = await cloneProposalTemplateAction(templateId);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.push(`/admin/proposals/templates/${res.templateId}`);
    router.refresh();
  }

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={busy}
        aria-label="Clone template"
        title="Clone template"
        onClick={() => void onClick()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={busy}
      onClick={() => void onClick()}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      Clone
    </Button>
  );
}
