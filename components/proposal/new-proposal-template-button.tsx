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
    <Button type="button" size="sm" className="gap-2" disabled={busy} onClick={() => void onClick()}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      New template
    </Button>
  );
}
