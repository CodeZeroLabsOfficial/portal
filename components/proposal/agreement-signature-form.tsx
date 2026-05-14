"use client";

import * as React from "react";
import { Check, ChevronRight, CreditCard, Loader2, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  normalizeLocalityTimeZone,
  todayIsoDateInTimeZone,
} from "@/lib/proposal-locality-dates";
import { cn } from "@/lib/utils";
import { ProposalPublicSubscriptionFormPanel } from "@/components/proposal/proposal-public-subscription-form-panel";
import type { ProposalPublicSubscriptionUi } from "@/server/proposal/public-proposal-subscription-ui";

const INK = "#1a1a5e";
const LOGICAL_W = 640;
const LOGICAL_H = 200;

export type AgreementSignatureMethod = "draw" | "type" | "upload";

/** Short US-style date (e.g. 5/14/2026) for the e-signature banner. */
function signatureBannerDateLabel(
  adoptTab: AgreementSignatureMethod,
  localityTimeZone?: string,
): string {
  const tz = normalizeLocalityTimeZone(localityTimeZone);
  const opts: Intl.DateTimeFormatOptions = {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    ...(tz ? { timeZone: tz } : {}),
  };
  if (adoptTab === "type") {
    const iso = todayIsoDateInTimeZone(localityTimeZone);
    return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", opts);
  }
  return new Date().toLocaleDateString("en-US", opts);
}

export interface AgreementSignaturePayload {
  signerName: string;
  signerEmail: string;
  signerOrganization?: string;
  signatureDataUrl: string;
  signatureMethod: AgreementSignatureMethod;
  clientSignedAtMs: number;
}

function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * LOGICAL_W;
  const y = ((clientY - rect.top) / Math.max(rect.height, 1)) * LOGICAL_H;
  return { x, y };
}

function buildTypedSignatureDataUrl(name: string): string {
  const displayName = name.trim() || " ";
  const fontPx = 56;
  const H = 112;
  const padX = 48;
  const maxTextW = 680;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  if (!mctx) return "";
  mctx.font = `italic ${fontPx}px "Segoe Script", "Brush Script MT", "Apple Chancery", cursive`;

  let line = displayName;
  if (mctx.measureText(line).width > maxTextW - padX) {
    while (line.length > 1 && mctx.measureText(`${line}…`).width > maxTextW - padX) {
      line = line.slice(0, -1);
    }
    line = `${line}…`;
  }

  const textW = Math.ceil(mctx.measureText(line).width);
  const W = Math.max(160, Math.min(720, textW + padX));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `italic ${fontPx}px "Segoe Script", "Brush Script MT", "Apple Chancery", cursive`;
  ctx.fillText(line, W / 2, H / 2 + 2);
  return canvas.toDataURL("image/png");
}

function setupDrawContext(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  canvas.width = Math.floor(LOGICAL_W * dpr);
  canvas.height = Math.floor(LOGICAL_H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.maxWidth = `${LOGICAL_W}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return ctx;
}

async function imageFileToPngDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 900;
      const maxH = 280;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (!w || !h) {
        resolve(null);
        return;
      }
      const scale = Math.min(1, maxW / w, maxH / h);
      w = Math.floor(w * scale);
      h = Math.floor(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function AgreementFlowAccordionTrigger({
  icon,
  title,
  subtitle,
  open,
  onToggle,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-left shadow-sm transition-colors",
        "hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-slate-700">{title}</span>
        {subtitle ? <span className="mt-0.5 block text-sm text-slate-500">{subtitle}</span> : null}
      </span>
      <ChevronRight
        className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-90")}
        aria-hidden
      />
    </button>
  );
}

export interface AgreementSignatureFormProps {
  disabled: boolean;
  busy: boolean;
  requireAcceptTerms: boolean;
  agreementTitle: string;
  proposalTitle?: string;
  ctaColor: string;
  ctaForeground: string;
  error: string | null;
  /** Called when the user changes inputs so parent can clear server-side error messages. */
  onDismissError?: () => void;
  onSubmit: (payload: AgreementSignaturePayload) => void | Promise<void>;
  /** Staff Settings → Locality IANA zone (public page uses proposal creator’s saved zone). */
  localityTimeZone?: string;
  shareToken?: string;
  publicSubscriptionUi?: ProposalPublicSubscriptionUi | null;
  /** First packages block monthly total (minor units) for payment header. */
  monthlyTotalMinor?: number;
  monthlyCurrency?: string;
}

export function AgreementSignatureForm({
  disabled,
  busy,
  requireAcceptTerms,
  agreementTitle,
  proposalTitle,
  ctaColor,
  ctaForeground,
  error,
  onDismissError,
  onSubmit,
  localityTimeZone,
  shareToken,
  publicSubscriptionUi,
  monthlyTotalMinor,
  monthlyCurrency,
}: AgreementSignatureFormProps) {
  const [acceptName, setAcceptName] = React.useState("");
  const [acceptEmail, setAcceptEmail] = React.useState("");
  const [acceptOrg, setAcceptOrg] = React.useState("");

  const [adoptOpen, setAdoptOpen] = React.useState(false);
  const [adoptTab, setAdoptTab] = React.useState<AgreementSignatureMethod>("type");
  /** Type-tab only — how the signature *looks*; legal name stays in the Accept form above. */
  const [typedSignatureText, setTypedSignatureText] = React.useState("");
  const [hasInk, setHasInk] = React.useState(false);
  const [canvasReset, setCanvasReset] = React.useState(0);
  const [uploadPreview, setUploadPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [capturedDataUrl, setCapturedDataUrl] = React.useState<string | null>(null);
  const [capturedMethod, setCapturedMethod] = React.useState<AgreementSignatureMethod | null>(null);
  const [signatureBannerDate, setSignatureBannerDate] = React.useState("");

  const [electronicAgreed, setElectronicAgreed] = React.useState(false);
  const [termsAgreed, setTermsAgreed] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const [signSectionOpen, setSignSectionOpen] = React.useState(false);
  const [paymentSectionOpen, setPaymentSectionOpen] = React.useState(false);
  const [paymentMethodSummary, setPaymentMethodSummary] = React.useState<string | null>(null);

  /** Unsigned: accordion expanded. Signed: “Edit” opened adopt flow below the preview. */
  const adoptPanelVisible = Boolean(capturedDataUrl ? adoptOpen : signSectionOpen);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const lastRef = React.useRef<{ x: number; y: number } | null>(null);
  const adoptPanelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (adoptPanelVisible && adoptPanelRef.current) {
      adoptPanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [adoptPanelVisible]);

  const initCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupDrawContext(canvas);
    setHasInk(false);
    lastRef.current = null;
  }, []);

  React.useLayoutEffect(() => {
    if (!adoptPanelVisible || adoptTab !== "draw") return;
    initCanvas();
  }, [adoptPanelVisible, adoptTab, canvasReset, initCanvas]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || busy || adoptTab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = getCanvasPoint(canvas, e.clientX, e.clientY);
    lastRef.current = p;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled || busy) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const last = lastRef.current;
    if (!canvas || !ctx || !last) return;
    const p = getCanvasPoint(canvas, e.clientX, e.clientY);
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist > 0.5) setHasInk(true);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  function clearAdoptSignature() {
    setLocalError(null);
    onDismissError?.();
    if (adoptTab === "draw") {
      setCanvasReset((k) => k + 1);
      return;
    }
    if (adoptTab === "upload") {
      setUploadPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setTypedSignatureText("");
  }

  function toggleSignAccordion() {
    if (disabled || busy) return;
    if (signSectionOpen) {
      setSignSectionOpen(false);
      setLocalError(null);
      onDismissError?.();
      return;
    }
    const name = acceptName.trim();
    if (name.length < 2) {
      setLocalError("Please enter your full name before signing.");
      return;
    }
    setLocalError(null);
    onDismissError?.();
    setTypedSignatureText("");
    setSignSectionOpen(true);
  }

  function closeAdoptPanel() {
    if (capturedDataUrl) {
      setAdoptOpen(false);
    } else {
      setSignSectionOpen(false);
    }
    setLocalError(null);
    onDismissError?.();
  }

  function clearCapturedSignature() {
    setLocalError(null);
    onDismissError?.();
    setCapturedDataUrl(null);
    setCapturedMethod(null);
    setSignatureBannerDate("");
    setTypedSignatureText("");
    setUploadPreview(null);
    setHasInk(false);
    setCanvasReset((k) => k + 1);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAdoptOpen(false);
    setSignSectionOpen(false);
  }

  function openAdoptPanelForEdit() {
    setLocalError(null);
    onDismissError?.();
    setTypedSignatureText("");
    if (capturedMethod) setAdoptTab(capturedMethod);
    setAdoptOpen(true);
  }

  function handleAdoptAndSign() {
    setLocalError(null);
    onDismissError?.();
    const name = acceptName.trim();
    if (name.length < 2) {
      setLocalError("Please enter your full name.");
      return;
    }
    let dataUrl = "";
    if (adoptTab === "draw") {
      if (!hasInk) {
        setLocalError("Please draw your signature.");
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      dataUrl = canvas.toDataURL("image/png");
    } else if (adoptTab === "type") {
      const sig = typedSignatureText.trim();
      if (sig.length < 2) {
        setLocalError("Please enter your signature.");
        return;
      }
      dataUrl = buildTypedSignatureDataUrl(sig);
    } else {
      if (!uploadPreview || !uploadPreview.startsWith("data:image/png;base64,")) {
        setLocalError("Please upload a signature image.");
        return;
      }
      dataUrl = uploadPreview;
    }
    if (!dataUrl.startsWith("data:image/png;base64,")) {
      setLocalError("Could not capture your signature. Please try again.");
      return;
    }
    setCapturedDataUrl(dataUrl);
    setCapturedMethod(adoptTab);
    setSignatureBannerDate(signatureBannerDateLabel(adoptTab, localityTimeZone));
    setAdoptOpen(false);
    setSignSectionOpen(false);
  }

  async function onUploadFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setLocalError(null);
    onDismissError?.();
    const dataUrl = await imageFileToPngDataUrl(file);
    if (!dataUrl) {
      setLocalError("Could not read that image. Try PNG or JPEG.");
      setUploadPreview(null);
      return;
    }
    setUploadPreview(dataUrl);
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const name = acceptName.trim();
    if (name.length < 2) {
      setLocalError("Please enter your full name.");
      return;
    }
    const email = acceptEmail.trim();
    if (!email) {
      setLocalError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError("Please enter a valid email address.");
      return;
    }
    if (!capturedDataUrl || !capturedMethod) {
      setLocalError("Please add your signature in the e-signature box below.");
      return;
    }
    if (!electronicAgreed) {
      setLocalError("Please confirm that your electronic signature is legally binding.");
      return;
    }
    if (requireAcceptTerms && !termsAgreed) {
      setLocalError("Please confirm you have read and agree to the terms.");
      return;
    }
    const clientSignedAtMs = Date.now();
    try {
      await onSubmit({
        signerName: name,
        signerEmail: email,
        signerOrganization: acceptOrg.trim() || undefined,
        signatureDataUrl: capturedDataUrl,
        signatureMethod: capturedMethod,
        clientSignedAtMs,
      });
    } catch {
      setLocalError("We could not complete signing. Please try again.");
    }
  }

  const showError = localError || error;
  const canFinalSubmit =
    !disabled &&
    !busy &&
    acceptName.trim().length >= 2 &&
    acceptEmail.trim().length > 0 &&
    capturedDataUrl &&
    capturedMethod &&
    electronicAgreed &&
    (!requireAcceptTerms || termsAgreed);

  const canAdopt =
    !disabled &&
    !busy &&
    acceptName.trim().length >= 2 &&
    (adoptTab === "draw"
      ? hasInk
      : adoptTab === "type"
        ? typedSignatureText.trim().length >= 2
        : Boolean(uploadPreview));

  return (
    <form className="space-y-5" onSubmit={handleFinalSubmit} noValidate aria-busy={busy}>
      <div className="relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
        {busy ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/85 backdrop-blur-[1px]"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin text-[#1a1a5e]" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-zinc-800">Signing agreement…</p>
            <p className="mt-1 max-w-[14rem] text-center text-xs text-zinc-500">
              Please wait while we record your acceptance.
            </p>
          </div>
        ) : null}
        <div className={cn(busy && "pointer-events-none opacity-60")}>
          <div className="mx-auto max-w-md">
            <h3 className="text-center text-2xl font-semibold tracking-tight text-[#1a1a5e] sm:text-[26px]">
              Accept
            </h3>
            <p className="mt-2 text-center text-sm leading-relaxed text-zinc-500">
              To accept this document, fill out the form and click the button below.
            </p>

            <div className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="agreement-accept-name" className="text-sm font-medium text-zinc-900">
                  Name
                </Label>
                <Input
                  id="agreement-accept-name"
                  autoComplete="name"
                  placeholder="Full name"
                  value={acceptName}
                  onChange={(e) => {
                    onDismissError?.();
                    setAcceptName(e.target.value);
                  }}
                  disabled={disabled || busy}
                  className="h-11 border-zinc-200 bg-white text-base text-zinc-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agreement-accept-email" className="text-sm font-medium text-zinc-900">
                  Email
                </Label>
                <Input
                  id="agreement-accept-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@email.com"
                  value={acceptEmail}
                  onChange={(e) => {
                    onDismissError?.();
                    setAcceptEmail(e.target.value);
                  }}
                  disabled={disabled || busy}
                  className="h-11 border-zinc-200 bg-white text-base text-zinc-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agreement-accept-org" className="text-sm font-medium text-zinc-900">
                  Organization <span className="font-normal text-zinc-500">(optional)</span>
                </Label>
                <Input
                  id="agreement-accept-org"
                  autoComplete="organization"
                  placeholder="Organization name"
                  value={acceptOrg}
                  onChange={(e) => {
                    onDismissError?.();
                    setAcceptOrg(e.target.value);
                  }}
                  disabled={disabled || busy}
                  className="h-11 border-zinc-200 bg-white text-base text-zinc-900"
                />
              </div>

              <div className="space-y-3 pt-1">
                {capturedDataUrl ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#3e4756]">E-signature</Label>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={disabled || busy}
                          className={cn(
                            "group w-full rounded-lg border border-zinc-300 bg-white text-left outline-none transition-colors",
                            "hover:border-zinc-400 hover:bg-zinc-50/40 focus-visible:ring-2 focus-visible:ring-zinc-400/60",
                            (disabled || busy) && "cursor-not-allowed opacity-60",
                          )}
                          aria-label="E-signature options"
                        >
                          <div className="relative px-3 pb-3.5 pt-3">
                            <div className="mb-2 flex min-h-6 w-full items-center justify-between gap-3">
                              <span className="shrink-0 text-xs font-medium text-slate-600">Signed</span>
                              <span className="min-w-0 shrink truncate text-right text-xs font-medium tabular-nums text-slate-600">
                                {signatureBannerDate || "—"}
                              </span>
                            </div>
                            <div className="flex h-[7.25rem] max-h-[7.5rem] items-center justify-start overflow-hidden px-1 pt-0.5 sm:h-[7.75rem] sm:max-h-[8rem]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={capturedDataUrl}
                                alt=""
                                className="max-h-full w-auto max-w-full object-contain object-left"
                              />
                            </div>
                          </div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        sideOffset={8}
                        className={cn(
                          "z-[100] min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white p-0",
                          "shadow-[0_8px_32px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)]",
                          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
                        )}
                      >
                        <DropdownMenuItem
                          className={cn(
                            "cursor-pointer justify-start rounded-none px-5 py-3 text-left text-[15px] font-medium leading-snug text-[#2d334a]",
                            "focus:bg-slate-50 focus:text-[#2d334a] data-[highlighted]:bg-slate-50 data-[highlighted]:text-[#2d334a]",
                          )}
                          onSelect={() => {
                            clearCapturedSignature();
                          }}
                        >
                          Clear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={cn(
                            "cursor-pointer justify-start rounded-none px-5 py-3 text-left text-[15px] font-medium leading-snug text-[#2d334a]",
                            "focus:bg-slate-50 focus:text-[#2d334a] data-[highlighted]:bg-slate-50 data-[highlighted]:text-[#2d334a]",
                          )}
                          onSelect={() => {
                            openAdoptPanelForEdit();
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <AgreementFlowAccordionTrigger
                    icon={<PenLine aria-hidden />}
                    title="Enter your signature"
                    subtitle="Draw, type, or upload your signature"
                    open={signSectionOpen}
                    onToggle={toggleSignAccordion}
                    disabled={disabled || busy}
                  />
                )}

                {adoptPanelVisible ? (
                  <div
                    ref={adoptPanelRef}
                    className={cn(
                      "mx-auto max-w-md",
                      capturedDataUrl ? "mt-6 border-t border-zinc-200 pt-8" : "pt-1",
                    )}
                    role="region"
                    aria-label="Adopt your signature"
                  >
                    <h4 className="text-xl font-semibold tracking-tight text-[#1a1a5e] sm:text-2xl">
                      Adopt your signature
                    </h4>
                    <div className="mt-5 flex rounded-lg bg-zinc-100 p-1">
                      {(["type", "draw", "upload"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={disabled || busy}
                          onClick={() => {
                            onDismissError?.();
                            setAdoptTab(m);
                            setLocalError(null);
                          }}
                          className={cn(
                            "flex-1 rounded-md py-2.5 text-sm font-semibold transition-all",
                            adoptTab === m
                              ? "bg-white text-[#1a1a5e] shadow-sm"
                              : "text-zinc-600 hover:text-zinc-900",
                          )}
                        >
                          {m === "type" ? "Type" : m === "draw" ? "Draw" : "Upload"}
                        </button>
                      ))}
                    </div>

                    {adoptTab === "draw" ? (
                      <div className="mt-5 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-zinc-900">Draw your signature</span>
                          <button
                            type="button"
                            onClick={clearAdoptSignature}
                            disabled={disabled || busy}
                            className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="min-h-[min(200px,38svh)] overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 sm:min-h-0">
                          <canvas
                            ref={canvasRef}
                            className="block w-full cursor-crosshair touch-none"
                            width={LOGICAL_W}
                            height={LOGICAL_H}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={endStroke}
                            onPointerCancel={endStroke}
                            onPointerLeave={(e) => {
                              if (e.buttons === 0) endStroke();
                            }}
                          />
                        </div>
                      </div>
                    ) : adoptTab === "type" ? (
                      <div className="mt-5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="agreement-typed-signature" className="text-sm font-medium text-zinc-900">
                            Enter your signature
                          </Label>
                          <button
                            type="button"
                            onClick={clearAdoptSignature}
                            disabled={disabled || busy}
                            className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
                          >
                            Clear
                          </button>
                        </div>
                        <Input
                          id="agreement-typed-signature"
                          autoComplete="off"
                          placeholder="Type your signature"
                          value={typedSignatureText}
                          onChange={(e) => {
                            onDismissError?.();
                            setTypedSignatureText(e.target.value);
                          }}
                          disabled={disabled || busy}
                          className="h-12 border-zinc-200 bg-white text-base text-zinc-900 placeholder:text-zinc-400"
                        />
                        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-6 sm:px-6 sm:py-8">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Preview</p>
                          <p
                            className={cn(
                              "mt-2 break-words text-3xl leading-snug sm:text-4xl",
                              typedSignatureText.trim() ? "text-[#1a1a5e]" : "text-zinc-400",
                            )}
                            style={{
                              fontFamily: '"Segoe Script", "Brush Script MT", "Apple Chancery", cursive',
                              fontStyle: "italic",
                            }}
                          >
                            {typedSignatureText.trim() || "Type your signature"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-zinc-900">
                            Upload an image of your signature
                          </span>
                          <button
                            type="button"
                            onClick={clearAdoptSignature}
                            disabled={disabled || busy}
                            className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
                          >
                            Clear
                          </button>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="sr-only"
                          tabIndex={-1}
                          onChange={(e) => void onUploadFiles(e.target.files)}
                        />
                        <div
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              fileInputRef.current?.click();
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            void onUploadFiles(e.dataTransfer.files);
                          }}
                          className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-8 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploadPreview ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={uploadPreview}
                              alt="Uploaded signature preview"
                              className="max-h-28 max-w-full object-contain"
                            />
                          ) : (
                            <>
                              <Upload className="h-8 w-8 text-zinc-400" aria-hidden />
                              <p className="text-sm text-zinc-600">
                                Drag an image here, or{" "}
                                <span className="font-semibold text-[#1a1a5e] underline">browse</span>
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="mt-5 text-xs leading-relaxed text-zinc-600">
                      By selecting Adopt and sign, I agree that my electronic signature is as valid and legally binding as
                      a handwritten signature.
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-3 sm:justify-stretch">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 flex-1 rounded-xl border border-zinc-300 bg-white text-base font-semibold text-zinc-900 shadow-md hover:bg-zinc-50 hover:opacity-95"
                        onClick={closeAdoptPanel}
                        disabled={disabled || busy}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="h-11 flex-1 rounded-xl border-0 text-base font-semibold shadow-md hover:opacity-95"
                        style={{ backgroundColor: ctaColor, color: ctaForeground }}
                        onClick={handleAdoptAndSign}
                        disabled={!canAdopt}
                      >
                        Adopt and sign
                      </Button>
                    </div>
                  </div>
                ) : null}

                {publicSubscriptionUi && shareToken ? (
                  <>
                    <AgreementFlowAccordionTrigger
                      icon={<CreditCard aria-hidden />}
                      title="Add payment details"
                      subtitle={
                        paymentMethodSummary
                          ? paymentMethodSummary
                          : "Securely add a card for your subscription"
                      }
                      open={paymentSectionOpen}
                      onToggle={() => setPaymentSectionOpen((o) => !o)}
                      disabled={disabled || busy}
                    />
                    {paymentSectionOpen ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <ProposalPublicSubscriptionFormPanel
                          active={paymentSectionOpen}
                          shareToken={shareToken}
                          ui={publicSubscriptionUi}
                          cardElementId="proposal-accept-flow-subscription-card"
                          mode="save_card_only"
                          monthlyTotalMinor={monthlyTotalMinor}
                          monthlyCurrency={monthlyCurrency}
                          onPaymentSummaryChange={setPaymentMethodSummary}
                          onCardSaved={() => setPaymentSectionOpen(false)}
                          primaryCtaColor={ctaColor}
                          primaryCtaForeground={ctaForeground}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-md space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
            <label
              className={cn(
                "group flex cursor-pointer items-start gap-3 text-sm leading-snug text-[#1a1a5e]",
                disabled && "pointer-events-none cursor-not-allowed opacity-60",
              )}
            >
              <span className="relative mt-0.5 h-8 w-8 shrink-0">
                <input
                  type="checkbox"
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  checked={electronicAgreed}
                  onChange={(e) => {
                    onDismissError?.();
                    setElectronicAgreed(e.target.checked);
                  }}
                  disabled={disabled || busy}
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md border-2 border-slate-300 bg-white transition-colors",
                    "group-focus-within:ring-2 group-focus-within:ring-slate-400/45 group-focus-within:ring-offset-2 group-focus-within:ring-offset-zinc-50",
                  )}
                  style={electronicAgreed ? { backgroundColor: ctaColor } : undefined}
                >
                  <Check
                    className="h-[15px] w-[15px] text-white opacity-0 transition-opacity duration-150 group-has-[:checked]:opacity-100"
                    strokeWidth={2.75}
                    aria-hidden
                  />
                </span>
              </span>
              <span>
                I agree that my electronic signature is as valid and legally binding as a handwritten signature.
              </span>
            </label>
            {requireAcceptTerms ? (
              <label
                className={cn(
                  "group flex cursor-pointer items-start gap-3 text-sm leading-snug text-[#1a1a5e]",
                  disabled && "pointer-events-none cursor-not-allowed opacity-60",
                )}
              >
                <span className="relative mt-0.5 h-8 w-8 shrink-0">
                  <input
                    type="checkbox"
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    checked={termsAgreed}
                    onChange={(e) => {
                      onDismissError?.();
                      setTermsAgreed(e.target.checked);
                    }}
                    disabled={disabled || busy}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border-2 border-slate-300 bg-white transition-colors",
                      "group-focus-within:ring-2 group-focus-within:ring-slate-400/45 group-focus-within:ring-offset-2 group-focus-within:ring-offset-zinc-50",
                    )}
                    style={termsAgreed ? { backgroundColor: ctaColor } : undefined}
                  >
                    <Check
                      className="h-[15px] w-[15px] text-white opacity-0 transition-opacity duration-150 group-has-[:checked]:opacity-100"
                      strokeWidth={2.75}
                      aria-hidden
                    />
                  </span>
                </span>
                <span>
                  I have read and agree to the terms of this {agreementTitle.toLowerCase()}
                  {proposalTitle ? (
                    <>
                      {" "}
                      for <span className="font-medium text-[#1a1a5e]">{proposalTitle}</span>
                    </>
                  ) : null}
                  .
                </span>
              </label>
            ) : null}
          </div>

          {showError ? (
            <p className="mx-auto mt-4 max-w-md text-sm text-destructive" role="alert">
              {showError}
            </p>
          ) : null}

          {!disabled ? null : (
            <p className="mx-auto mt-4 max-w-md text-xs text-zinc-500">
              Signing is disabled in preview — the live proposal will accept your customer&apos;s signature here.
            </p>
          )}

          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full gap-2 rounded-xl text-base font-semibold shadow-md hover:opacity-95"
              style={{ backgroundColor: ctaColor, color: ctaForeground }}
              disabled={!canFinalSubmit}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Sign Agreement
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
