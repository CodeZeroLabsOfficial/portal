"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createProposalTemplateAction } from "@/server/actions/proposal-templates";
import { Button } from "@/components/ui/button";

export function NewProposalTemplateButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onClick() {
    setBusy(true);
    const res = await createProposalTemplateAction();
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
      variant="ghost"
      size="sm"
      className="gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
      disabled={busy}
      onClick={() => void onClick()}
    >
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Plus className="h-4 w-4 shrink-0" aria-hidden />}
      New template
    </Button>
  );
}
