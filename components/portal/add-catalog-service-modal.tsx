"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  catalogServicePriceLookupKey,
  slugifyCatalogServiceName,
} from "@/lib/catalog-service-slug";
import {
  createCatalogServiceSchema,
  type CreateCatalogServiceInput,
} from "@/lib/schemas/catalog-service";
import { createCatalogServiceAction } from "@/server/actions/catalog-services";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormServerError } from "@/components/ui/form-server-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WORKSPACE_GLASS_DIALOG_SURFACE_CLASSES } from "@/lib/workspace-glass";

interface AddCatalogServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultValues: CreateCatalogServiceInput = {
  name: "",
  slug: undefined,
  currency: "aud",
  monthlyCost12Minor: 0,
  monthlyCost24Minor: 0,
  syncToStripe: false,
};

function majorInputToMinor(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function AddCatalogServiceModal({ open, onOpenChange }: AddCatalogServiceModalProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [monthly12, setMonthly12] = React.useState("");
  const [monthly24, setMonthly24] = React.useState("");

  const form = useForm<CreateCatalogServiceInput>({
    resolver: zodResolver(createCatalogServiceSchema),
    defaultValues,
  });

  const name = form.watch("name");
  const syncToStripe = form.watch("syncToStripe");
  const resolvedSlug = slug.trim() || slugifyCatalogServiceName(name);

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setSlug("");
      setSlugTouched(false);
      setMonthly12("");
      setMonthly24("");
      setServerError(null);
    }
  }, [open, form]);

  React.useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyCatalogServiceName(name));
    }
  }, [name, slugTouched]);

  async function onSubmit(values: CreateCatalogServiceInput) {
    setServerError(null);
    const payload: CreateCatalogServiceInput = {
      ...values,
      name: values.name.trim(),
      slug: resolvedSlug,
      monthlyCost12Minor: majorInputToMinor(monthly12),
      monthlyCost24Minor: majorInputToMinor(monthly24),
    };
    const result = await createCatalogServiceAction(payload);
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    onOpenChange(false);
    router.push(`/admin/services/${result.serviceId}`);
    router.refresh();
  }

  const busy = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(90vh,720px)] w-[min(100vw-2rem,560px)] max-w-[560px] overflow-y-auto p-0 sm:max-w-[560px]",
          WORKSPACE_GLASS_DIALOG_SURFACE_CLASSES,
        )}
      >
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">New service</DialogTitle>
          </DialogHeader>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 px-6 py-5"
          noValidate
        >
          <FormServerError message={serverError} rounded="xl" />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catalog-service-name" className="text-zinc-300">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="catalog-service-name"
              autoComplete="off"
              className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
              placeholder="Starter plan"
              disabled={busy}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs leading-tight text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catalog-service-slug" className="text-zinc-300">
              Slug (Stripe lookup keys)
            </Label>
            <Input
              id="catalog-service-slug"
              autoComplete="off"
              className="border-white/[0.08] bg-white/[0.04] font-mono text-white placeholder:text-zinc-500"
              placeholder="starter_plan"
              value={slug}
              disabled={busy}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
              }}
            />
            <p className="text-xs text-zinc-500">
              {catalogServicePriceLookupKey(resolvedSlug, 12)} ·{" "}
              {catalogServicePriceLookupKey(resolvedSlug, 24)}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catalog-m12" className="text-zinc-300">
                12-month monthly (AUD)
              </Label>
              <Input
                id="catalog-m12"
                inputMode="decimal"
                placeholder="0.00"
                value={monthly12}
                disabled={busy}
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                onChange={(e) => setMonthly12(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catalog-m24" className="text-zinc-300">
                24-month monthly (AUD)
              </Label>
              <Input
                id="catalog-m24"
                inputMode="decimal"
                placeholder="0.00"
                value={monthly24}
                disabled={busy}
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-500"
                onChange={(e) => setMonthly24(e.target.value)}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={Boolean(syncToStripe)}
              disabled={busy}
              onChange={(e) => form.setValue("syncToStripe", e.target.checked, { shouldDirty: true })}
            />
            <span className="text-sm leading-snug text-zinc-300">
              <span className="font-medium text-white">Activate & sync to Stripe</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Creates the Stripe product and prices using the name, slug, and amounts above. Requires at least
                $0.50/month per term.
              </span>
            </span>
          </label>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              className="text-zinc-400 hover:text-white"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="min-w-[7rem] gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
