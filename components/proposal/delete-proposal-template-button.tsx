"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteProposalTemplateAction } from "@/server/actions/proposal-templates";
import { Button } from "@/components/ui/button";

export interface DeleteProposalTemplateButtonProps {
  templateId: string;
  templateName: string;
}

export function DeleteProposalTemplateButton({ templateId, templateName }: DeleteProposalTemplateButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onDelete() {
    if (!window.confirm(`Delete template “${templateName}”? This cannot be undone.`)) return;
    setBusy(true);
    const res = await deleteProposalTemplateAction(templateId);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.push("/admin/proposals");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="ml-auto gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={busy}
      onClick={() => void onDelete()}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Delete template
    </Button>
  );
}
