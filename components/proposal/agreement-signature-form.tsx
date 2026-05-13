"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoCalendarDateLong, todayIsoDateInTimeZone } from "@/lib/proposal-locality-dates";
import { cn } from "@/lib/utils";

const INK = "#1a1a5e";
const LOGICAL_W = 640;
const LOGICAL_H = 200;

export type AgreementSignatureMethod = "draw" | "type";

export interface AgreementSignaturePayload {
  signerName: string;
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

function buildTypedSignatureDataUrl(name: string, dateIso: string, localityTimeZone?: string): string {
  const W = 720;
  const H = 200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const displayName = name.trim() || " ";
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.font = 'italic 40px "Segoe Script", "Brush Script MT", "Apple Chancery", cursive';
  const maxW = W - 48;
  let line = displayName;
  if (ctx.measureText(line).width > maxW) {
    while (line.length > 1 && ctx.measureText(`${line}…`).width > maxW) {
      line = line.slice(0, -1);
    }
    line = `${line}…`;
  }
  ctx.fillText(line, 32, 78);

  let dateLabel = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    dateLabel = formatIsoCalendarDateLong(dateIso, localityTimeZone, undefined);
  }
  ctx.font = '500 14px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = "#64748b";
  ctx.fillText(dateLabel, 32, 132);
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
}: AgreementSignatureFormProps) {
  const [tab, setTab] = React.useState<AgreementSignatureMethod>("draw");
  const [signerName, setSignerName] = React.useState("");
  const [signedDate, setSignedDate] = React.useState("");
  const [electronicAgreed, setElectronicAgreed] = React.useState(false);
  const [termsAgreed, setTermsAgreed] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [hasInk, setHasInk] = React.useState(false);
  const [canvasReset, setCanvasReset] = React.useState(0);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const lastRef = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    setSignedDate(todayIsoDateInTimeZone(localityTimeZone));
  }, [localityTimeZone]);

  const initCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupDrawContext(canvas);
    setHasInk(false);
    lastRef.current = null;
  }, []);

  React.useLayoutEffect(() => {
    if (tab !== "draw") return;
    initCanvas();
  }, [tab, canvasReset, initCanvas]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || busy || tab !== "draw") return;
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

  function clearSignature() {
    setLocalError(null);
    onDismissError?.();
    if (tab === "draw") {
      setCanvasReset((k) => k + 1);
      return;
    }
    setSignerName("");
    setSignedDate(todayIsoDateInTimeZone(localityTimeZone));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const name = signerName.trim();
    if (name.length < 2) {
      setLocalError("Please enter your full legal name.");
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
    let signatureDataUrl = "";
    if (tab === "draw") {
      if (!hasInk) {
        setLocalError("Please draw your signature in the box.");
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      signatureDataUrl = canvas.toDataURL("image/png");
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(signedDate)) {
        setLocalError("Please choose the date you are signing.");
        return;
      }
      signatureDataUrl = buildTypedSignatureDataUrl(name, signedDate, localityTimeZone);
    }

    const clientSignedAtMs = Date.now();
    if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
      setLocalError("Could not capture your signature. Please try again.");
      return;
    }
    try {
      await onSubmit({
        signerName: name,
        signatureDataUrl,
        signatureMethod: tab,
        clientSignedAtMs,
      });
    } catch {
      setLocalError("We could not complete signing. Please try again.");
    }
  }

  const showError = localError || error;
  const canSubmit =
    !disabled &&
    !busy &&
    signerName.trim().length >= 2 &&
    electronicAgreed &&
    (!requireAcceptTerms || termsAgreed) &&
    (tab === "draw" ? hasInk : /^\d{4}-\d{2}-\d{2}$/.test(signedDate));

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <div className="relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Signature
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#1a1a5e] sm:text-xl">
              Adopt your signature
            </h3>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="agreement-legal-name" className="text-sm font-medium text-zinc-900">
            Full legal name
          </Label>
          <Input
            id="agreement-legal-name"
            autoComplete="name"
            placeholder="Jane Doe"
            value={signerName}
            onChange={(e) => {
              onDismissError?.();
              setSignerName(e.target.value);
            }}
            disabled={disabled || busy}
            minLength={2}
            className="h-11 border-zinc-200 bg-white text-base text-zinc-900"
          />
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-zinc-500">Sign using</p>
          <div className="flex rounded-lg bg-zinc-100 p-1">
            {(["draw", "type"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={disabled || busy}
                onClick={() => {
                  onDismissError?.();
                  setTab(m);
                  setLocalError(null);
                }}
                className={cn(
                  "flex-1 rounded-md py-3 text-sm font-semibold transition-all sm:py-2.5",
                  tab === m
                    ? "bg-white text-[#1a1a5e] shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900",
                )}
              >
                {m === "draw" ? "Draw" : "Type name & date"}
              </button>
            ))}
          </div>
        </div>

        {tab === "draw" ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-900">Draw your signature</span>
              <button
                type="button"
                onClick={clearSignature}
                disabled={disabled || busy}
                className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
              >
                Clear Signature
              </button>
            </div>
            <div className="min-h-[min(220px,42svh)] overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 sm:min-h-0">
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
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-900">Type name & date</span>
              <button
                type="button"
                onClick={clearSignature}
                disabled={disabled || busy}
                className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
              >
                Clear Signature
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agreement-sign-date" className="text-sm text-zinc-700">
                Date signed
              </Label>
              <Input
                id="agreement-sign-date"
                type="date"
                value={signedDate}
                onChange={(e) => {
                  onDismissError?.();
                  setSignedDate(e.target.value);
                }}
                disabled={disabled || busy}
                className="h-11 max-w-xs border-zinc-200 bg-white text-zinc-900"
              />
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-6 sm:px-6 sm:py-8">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Preview</p>
              <p
                className="mt-2 break-words text-3xl leading-snug text-[#1a1a5e] sm:text-4xl"
                style={{
                  fontFamily: '"Segoe Script", "Brush Script MT", "Apple Chancery", cursive',
                  fontStyle: "italic",
                }}
              >
                {signerName.trim() || "Your name"}
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                {/^\d{4}-\d{2}-\d{2}$/.test(signedDate)
                  ? formatIsoCalendarDateLong(signedDate, localityTimeZone, undefined) || "—"
                  : "—"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-zinc-800">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-[#1a1a5e] focus:ring-[#1a1a5e]"
              checked={electronicAgreed}
              onChange={(e) => {
                onDismissError?.();
                setElectronicAgreed(e.target.checked);
              }}
              disabled={disabled || busy}
            />
            <span>
              I agree that my electronic signature is as valid and legally binding as a handwritten
              signature.
            </span>
          </label>
          {requireAcceptTerms ? (
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-zinc-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-[#1a1a5e] focus:ring-[#1a1a5e]"
                checked={termsAgreed}
                onChange={(e) => {
                  onDismissError?.();
                  setTermsAgreed(e.target.checked);
                }}
                disabled={disabled || busy}
              />
              <span>
                I have read and agree to the terms of this {agreementTitle.toLowerCase()}
                {proposalTitle ? (
                  <>
                    {" "}
                    for <span className="font-medium text-zinc-900">{proposalTitle}</span>
                  </>
                ) : null}
                .
              </span>
            </label>
          ) : null}
        </div>

        {showError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {showError}
          </p>
        ) : null}

        {!disabled ? null : (
          <p className="mt-3 text-xs text-zinc-500">
            Signing is disabled in preview — the live proposal will accept your customer&apos;s
            signature here.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full gap-2 rounded-xl text-base font-semibold shadow-md hover:opacity-95 sm:ml-auto sm:w-auto sm:min-w-[200px]"
            style={{ backgroundColor: ctaColor, color: ctaForeground }}
            disabled={!canSubmit}
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
