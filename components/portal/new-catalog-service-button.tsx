"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createCatalogServiceAction } from "@/server/actions/catalog-services";
import { Button } from "@/components/ui/button";

export function NewCatalogServiceButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onClick() {
    setBusy(true);
    const res = await createCatalogServiceAction();
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.push(`/admin/services/${res.serviceId}`);
    router.refresh();
  }

  return (
    <Button type="button" size="sm" className="gap-1.5" disabled={busy} onClick={() => void onClick()}>
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Plus className="h-4 w-4 shrink-0" aria-hidden />}
      New service
    </Button>
  );
}
