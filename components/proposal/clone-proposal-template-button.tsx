"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { cloneProposalTemplateAction } from "@/server/actions/proposal-templates";
import { Button } from "@/components/ui/button";

export function CloneProposalTemplateButton({ templateId }: { templateId: string }) {
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
