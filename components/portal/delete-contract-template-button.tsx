"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteContractTemplateAction } from "@/server/actions/contract-templates";
import { Button } from "@/components/ui/button";

export function DeleteContractTemplateButton({
  contractTemplateId,
  templateName,
}: {
  contractTemplateId: string;
  templateName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onDelete() {
    if (!window.confirm(`Delete contract template “${templateName}”? This cannot be undone.`)) return;
    setBusy(true);
    const res = await deleteContractTemplateAction(contractTemplateId);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.push("/admin/templates");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={busy}
      onClick={() => void onDelete()}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Delete template
    </Button>
  );
}
