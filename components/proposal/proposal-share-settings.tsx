"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { setProposalSharePasswordAction } from "@/server/actions/proposal-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface ProposalShareSettingsProps {
  proposalId: string;
  hasPassword: boolean;
}

export function ProposalShareSettings({ proposalId, hasPassword }: ProposalShareSettingsProps) {
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function apply(next: string | null) {
    setBusy(true);
    setMsg(null);
    const res = await setProposalSharePasswordAction(proposalId, next);
    setBusy(false);
    setMsg(res.ok ? (next ? "Password saved." : "Password removed — link is open.") : res.message);
    if (res.ok) setPassword("");
  }

  return (
    <Card className="border-border/80 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Public link protection</CardTitle>
        <CardDescription>
          Optional password before the customer can view this proposal on the web. Share the password out-of-band (call,
          SMS).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="share-pw">Viewer password</Label>
          <Input
            id="share-pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={hasPassword ? "Enter new password or clear below" : "Leave empty for no password"}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy || password.length < 6}
            onClick={() => void apply(password)}
            variant="secondary"
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Set password
          </Button>
          {hasPassword ? (
            <Button type="button" disabled={busy} variant="outline" onClick={() => void apply(null)}>
              Remove password
            </Button>
          ) : null}
        </div>
        {hasPassword ? (
          <p className="text-xs text-muted-foreground">A password is active on this link.</p>
        ) : null}
        {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
