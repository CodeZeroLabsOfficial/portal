"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { acceptProposalPublicAction } from "@/server/actions/proposal-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ProposalPublicFooterProps {
  shareToken: string;
  status: string;
  acceptedByName?: string;
}

export function ProposalPublicFooter({ shareToken, status, acceptedByName }: ProposalPublicFooterProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(status === "accepted");
  const [localAcceptedName, setLocalAcceptedName] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDone(status === "accepted");
  }, [status]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await acceptProposalPublicAction({ shareToken, signerName: name.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setLocalAcceptedName(name.trim());
    setDone(true);
    router.refresh();
  }

  const displayName = localAcceptedName ?? acceptedByName;

  return (
    <div className="mt-16 space-y-8 print:hidden">
      <div className="flex justify-center">
        <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          Print / Save as PDF
        </Button>
      </div>

      {done || status === "accepted" ? (
        <Card className="border-emerald-500/35 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="text-base text-emerald-800 dark:text-emerald-100">Accepted</CardTitle>
            <CardDescription className="text-emerald-900/90 dark:text-emerald-50/90">
              Thank you{displayName ? `, ${displayName}` : ""}. We will follow up shortly with next steps.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Accept proposal</CardTitle>
            <CardDescription>
              By accepting, you confirm you agree to the scope, pricing, and terms presented above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void accept(e)}>
              <div className="space-y-2">
                <Label htmlFor="sign-name">Your full name</Label>
                <Input
                  id="sign-name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  minLength={2}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="gap-2" disabled={busy || name.trim().length < 2}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Accept proposal
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
