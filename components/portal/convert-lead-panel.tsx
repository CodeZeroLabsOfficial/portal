"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { convertLeadToContactAction } from "@/server/actions/opportunities-crm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ConvertLeadPanelProps {
  customerId: string;
  defaultOpportunityName?: string;
}

export function ConvertLeadPanel({ customerId, defaultOpportunityName = "" }: ConvertLeadPanelProps) {
  const router = useRouter();
  const [name, setName] = React.useState(defaultOpportunityName);
  const [busy, setBusy] = React.useState(false);

  async function onConvert(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert("Enter an opportunity name.");
      return;
    }
    setBusy(true);
    const res = await convertLeadToContactAction({
      customerId,
      opportunityName: trimmed,
      initialStage: "qualified",
    });
    setBusy(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    router.push(`/admin/opportunities/${res.opportunityId}`);
    router.refresh();
  }

  return (
    <Card className="border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-card to-card shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
          Convert lead
        </CardTitle>
        <CardDescription>
          This profile is a lead. Converting sets type to <span className="font-mono text-foreground/90">contact</span>{" "}
          and opens a linked opportunity in your pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onConvert}>
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="opp-name">Opportunity name</Label>
            <Input
              id="opp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website redesign — Phase 1"
              className="h-10"
              disabled={busy}
            />
          </div>
          <Button type="submit" disabled={busy} className="shrink-0 gap-2 sm:h-10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Convert &amp; create opportunity
          </Button>
        </form>
        <p className="mt-4 text-[13px] text-muted-foreground">
          After conversion, manage the deal on the{" "}
          <Link href="/admin/opportunities" className="font-medium text-primary underline-offset-4 hover:underline">
            pipeline board
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
