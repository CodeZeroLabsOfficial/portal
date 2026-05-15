"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { ContractTemplateRecord } from "@/types/contract-template";
import { saveContractTemplateAction } from "@/server/actions/contract-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContractTemplateEditorClient({ initial }: { initial: ContractTemplateRecord }) {
  const router = useRouter();
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description ?? "");
  const [agreementTitle, setAgreementTitle] = React.useState(initial.agreementTitle);
  const [introHtml, setIntroHtml] = React.useState(initial.introHtml ?? "");
  const [legalHtml, setLegalHtml] = React.useState(initial.legalHtml ?? "");
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await saveContractTemplateAction({
      contractTemplateId: initial.id,
      name,
      description: description.trim() || undefined,
      agreementTitle,
      introHtml: introHtml.trim() || undefined,
      legalHtml,
    });
    setSaving(false);
    if (!res.ok) {
      setMessage(res.message);
      window.alert(res.message);
      return;
    }
    setMessage("Saved.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/admin/templates#contract-templates">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All templates
          </Link>
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Save
          </Button>
        </div>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="space-y-1.5">
        <Label htmlFor="ct-name">Template name</Label>
        <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. (US) Services Agreement" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ct-desc">Description (optional)</Label>
        <Input
          id="ct-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Shown only in the admin list"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ct-title">Default modal title</Label>
        <Input
          id="ct-title"
          value={agreementTitle}
          onChange={(e) => setAgreementTitle(e.target.value)}
          placeholder="Services Agreement"
        />
        <p className="text-[11px] text-muted-foreground">
          When you attach this template to an Accept block, this becomes the agreement modal title unless you change it
          on the block.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ct-intro">Default intro (optional HTML)</Label>
        <textarea
          id="ct-intro"
          className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={introHtml}
          onChange={(e) => setIntroHtml(e.target.value)}
          placeholder="Rendered above the legal body in the buyer modal"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ct-legal">Legal body (HTML)</Label>
        <textarea
          id="ct-legal"
          className="min-h-[280px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
          value={legalHtml}
          onChange={(e) => setLegalHtml(e.target.value)}
          placeholder={`<h3>1. Parties</h3>\n<p>…</p>`}
        />
        <p className="text-[11px] text-muted-foreground">
          Leave empty if you want the block to fall back to the built-in default sections until you add HTML here.
        </p>
      </div>
    </div>
  );
}
