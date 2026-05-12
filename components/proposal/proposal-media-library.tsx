"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Braces,
  ChevronLeft,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  MonitorPlay,
  Play,
  Search,
  Upload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFirebasePublicConfig } from "@/lib/env/client-public";
import { cn } from "@/lib/utils";
import type { ProposalLibraryAsset, ProposalLibraryAssetKind } from "@/lib/proposal-media-library-types";

const noop = () => {};

export type ProposalMediaLibraryOpenParams = {
  allowedKinds: ProposalLibraryAssetKind[];
  onSelect: (asset: ProposalLibraryAsset) => void;
};

type LibraryCategory = "all" | "blocks" | "snippets" | "images" | "videos";

type ProposalMediaLibraryContextValue = {
  isOpen: boolean;
  activeParams: ProposalMediaLibraryOpenParams | null;
  openSelection: (params: ProposalMediaLibraryOpenParams) => void;
  close: () => void;
};

const ProposalMediaLibraryContext = React.createContext<ProposalMediaLibraryContextValue | null>(null);

export function useProposalMediaLibraryOptional(): ProposalMediaLibraryContextValue | null {
  return React.useContext(ProposalMediaLibraryContext);
}

function defaultCategoryForKinds(kinds: ProposalLibraryAssetKind[]): LibraryCategory {
  if (kinds.length === 1 && kinds[0] === "video") return "videos";
  if (kinds.length === 1 && kinds[0] === "image") return "images";
  if (kinds.length === 1 && kinds[0] === "snippet") return "snippets";
  if (kinds.length === 1 && kinds[0] === "block") return "blocks";
  return "all";
}

function matchesCategory(asset: ProposalLibraryAsset, cat: LibraryCategory): boolean {
  if (cat === "all") return true;
  if (cat === "images") return asset.kind === "image";
  if (cat === "videos") return asset.kind === "video";
  if (cat === "snippets") return asset.kind === "snippet";
  if (cat === "blocks") return asset.kind === "block";
  return true;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function categoryLabel(cat: LibraryCategory): string {
  switch (cat) {
    case "all":
      return "All";
    case "blocks":
      return "Blocks";
    case "snippets":
      return "Snippets";
    case "images":
      return "Images";
    case "videos":
      return "Videos";
    default:
      return cat;
  }
}

const CATEGORIES: LibraryCategory[] = ["all", "blocks", "snippets", "images", "videos"];

function inferLocalKind(file: File): ProposalLibraryAssetKind | null {
  const n = file.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|svg)$/.test(n)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(n)) return "video";
  if (/\.(html?)$/.test(n)) return "snippet";
  if (/\.json$/.test(n)) return "block";
  return null;
}

function acceptForKinds(kinds: ProposalLibraryAssetKind[]): string {
  const parts: string[] = [];
  if (kinds.includes("image")) {
    parts.push("image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml");
  }
  if (kinds.includes("video")) {
    parts.push("video/mp4", "video/webm", "video/quicktime");
  }
  if (kinds.includes("snippet")) {
    parts.push(".html", ".htm", "text/html");
  }
  if (kinds.includes("block")) {
    parts.push(".json", "application/json");
  }
  return parts.length > 0 ? parts.join(",") : "*/*";
}

function uploadButtonLabel(kinds: ProposalLibraryAssetKind[]): string {
  if (kinds.length === 1 && kinds[0] === "image") return "Upload image";
  if (kinds.length === 1 && kinds[0] === "video") return "Upload video";
  if (kinds.length === 1 && kinds[0] === "snippet") return "Upload snippet";
  if (kinds.length === 1 && kinds[0] === "block") return "Upload block";
  return "Upload file";
}

function ProposalMediaLibrarySidebar() {
  const ctx = React.useContext(ProposalMediaLibraryContext);
  const isOpen = Boolean(ctx?.isOpen && ctx.activeParams);
  const activeParams = ctx?.activeParams ?? null;
  const close = ctx?.close ?? noop;

  const [mainTab, setMainTab] = React.useState<"library" | "explore">("library");
  const [category, setCategory] = React.useState<LibraryCategory>("all");
  const [query, setQuery] = React.useState("");
  const [assets, setAssets] = React.useState<ProposalLibraryAsset[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadMessage, setUploadMessage] = React.useState<string | null>(null);
  const [draggingOver, setDraggingOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragDepthRef = React.useRef(0);

  const storageConsoleHref = React.useMemo(() => {
    const cfg = getFirebasePublicConfig();
    if (!cfg?.projectId) return "https://console.firebase.google.com/";
    return `https://console.firebase.google.com/project/${encodeURIComponent(cfg.projectId)}/storage`;
  }, []);

  const prevOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !prevOpen.current && activeParams) {
      setMainTab("library");
      setCategory(defaultCategoryForKinds(activeParams.allowedKinds));
      setQuery("");
      setUploadMessage(null);
    }
    if (!isOpen) {
      dragDepthRef.current = 0;
      setDraggingOver(false);
      setUploadMessage(null);
    }
    prevOpen.current = isOpen;
  }, [isOpen, activeParams]);

  const refetchAssets = React.useCallback(async () => {
    const list = await fetch("/api/proposal-media-library");
    const data = (await list.json()) as { assets?: ProposalLibraryAsset[] };
    if (list.ok) {
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    }
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/proposal-media-library")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? res.statusText ?? "Request failed");
        }
        return res.json() as Promise<{ assets?: ProposalLibraryAsset[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setAssets(Array.isArray(data.assets) ? data.assets : []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load library");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const performLibraryUploads = React.useCallback(
    async (files: File[]) => {
      if (!activeParams || files.length === 0) return;
      const allowed = new Set(activeParams.allowedKinds);
      const usable = files.filter((f) => {
        const k = inferLocalKind(f);
        return k && allowed.has(k);
      });
      if (usable.length === 0) {
        setUploadMessage("No supported files for this picker (check type and extension).");
        return;
      }
      setUploading(true);
      setUploadMessage(null);
      try {
        for (const file of usable) {
          const init = await fetch("/api/proposal-media-library/signed-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type || "application/octet-stream",
            }),
          });
          const payload = (await init.json().catch(() => ({}))) as {
            error?: string;
            uploadUrl?: string;
            contentType?: string;
          };
          if (!init.ok) {
            throw new Error(typeof payload.error === "string" ? payload.error : init.statusText);
          }
          const { uploadUrl, contentType } = payload;
          if (!uploadUrl || !contentType) {
            throw new Error("Invalid upload response from server.");
          }
          const put = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": contentType },
          });
          if (!put.ok) {
            throw new Error(
              put.status === 0
                ? "Upload was blocked. Add CORS on your GCS bucket for this site origin, or upload from Firebase console."
                : `Upload failed (${put.status}).`,
            );
          }
        }
        setUploadMessage(`Uploaded ${usable.length} file${usable.length === 1 ? "" : "s"}.`);
        await refetchAssets();
      } catch (e: unknown) {
        setUploadMessage(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [activeParams, refetchAssets],
  );

  const onLibraryDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (mainTab !== "library") return;
      if (!e.dataTransfer?.types?.includes("Files")) return;
      dragDepthRef.current += 1;
      setDraggingOver(true);
    },
    [mainTab],
  );

  const onLibraryDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDraggingOver(false);
    }
  }, []);

  const onLibraryDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);

  const onLibraryDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setDraggingOver(false);
      if (mainTab !== "library") return;
      void performLibraryUploads(Array.from(e.dataTransfer?.files ?? []));
    },
    [mainTab, performLibraryUploads],
  );

  const visible = React.useMemo(() => {
    if (!activeParams) return [];
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => activeParams.allowedKinds.includes(a.kind))
      .filter((a) => matchesCategory(a, category))
      .filter((a) => (q ? a.name.toLowerCase().includes(q) : true));
  }, [assets, activeParams, category, query]);

  const searchPlaceholder =
    category === "videos"
      ? "Search videos"
      : category === "images"
        ? "Search images"
        : category === "snippets"
          ? "Search snippets"
          : category === "blocks"
            ? "Search blocks"
            : "Search library";

  const acceptAttr = activeParams ? acceptForKinds(activeParams.allowedKinds) : "*/*";
  const primaryUploadLabel = activeParams ? uploadButtonLabel(activeParams.allowedKinds) : "Upload";

  return (
    <AnimatePresence>
      {isOpen && activeParams ? (
        <>
          <motion.button
            type="button"
            aria-label="Close library"
            className="fixed inset-0 z-[80] bg-black/25 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => close()}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="proposal-media-library-title"
            className={cn(
              "fixed left-0 top-0 z-[90] flex h-full w-[min(100vw,380px)] flex-col border-r border-border bg-background shadow-2xl",
            )}
            initial={{ x: "-105%" }}
            animate={{ x: 0 }}
            exit={{ x: "-105%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <button
              type="button"
              className="absolute -right-3 top-1/2 z-[1] flex h-14 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-background text-muted-foreground shadow-md transition-colors hover:bg-muted"
              aria-label="Close library"
              onClick={() => close()}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>

            <div className="flex min-h-0 flex-1 flex-col px-4 pt-5">
              <h2 id="proposal-media-library-title" className="sr-only">
                Media library
              </h2>
              <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "library" | "explore")} className="flex min-h-0 flex-1 flex-col">
                <TabsList className="mb-4 grid h-10 w-full grid-cols-2 rounded-lg bg-muted p-1">
                  <TabsTrigger value="library" className="text-xs font-semibold">
                    Library
                  </TabsTrigger>
                  <TabsTrigger value="explore" className="text-xs font-semibold">
                    Explore
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="library"
                  className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-[state=inactive]:hidden"
                >
                  <div className="relative mb-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="h-10 rounded-lg border-border bg-muted/40 pl-9 text-sm"
                      aria-label="Search library"
                    />
                  </div>

                  <nav className="mb-3 flex gap-3 overflow-x-auto border-b border-border pb-0.5 text-sm" aria-label="Library categories">
                    {CATEGORIES.map((cat) => {
                      const active = category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={cn(
                            "shrink-0 border-b-2 border-transparent pb-2 font-medium transition-colors",
                            active
                              ? "border-primary text-primary"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setCategory(cat)}
                        >
                          {categoryLabel(cat)}
                        </button>
                      );
                    })}
                  </nav>

                  <div
                    className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1"
                    onDragEnter={onLibraryDragEnter}
                    onDragLeave={onLibraryDragLeave}
                    onDragOver={onLibraryDragOver}
                    onDrop={onLibraryDrop}
                  >
                    {draggingOver ? (
                      <div
                        className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-xl border-2 border-dashed border-violet-600 bg-violet-500/[0.12] backdrop-blur-[2px] dark:border-violet-400 dark:bg-violet-500/15"
                        aria-hidden
                      >
                        <p className="px-4 text-center text-sm font-semibold text-violet-950 dark:text-violet-100">
                          Drop files to upload
                        </p>
                      </div>
                    ) : null}

                    {loading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                        <p className="text-sm">Loading assets…</p>
                      </div>
                    ) : error ? (
                      <div className="space-y-3 py-10 text-center">
                        <p className="text-sm text-destructive">{error}</p>
                        <button
                          type="button"
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() => {
                            setError(null);
                            setLoading(true);
                            void fetch("/api/proposal-media-library")
                              .then(async (res) => {
                                if (!res.ok) throw new Error(res.statusText);
                                return res.json() as Promise<{ assets?: ProposalLibraryAsset[] }>;
                              })
                              .then((data) => {
                                setAssets(Array.isArray(data.assets) ? data.assets : []);
                                setLoading(false);
                              })
                              .catch(() => {
                                setError("Could not load library");
                                setLoading(false);
                              });
                          }}
                        >
                          Try again
                        </button>
                      </div>
                    ) : visible.length === 0 ? (
                      <div className="space-y-2 py-12 text-center text-sm text-muted-foreground">
                        <p>No matching files in Storage.</p>
                        <p className="text-xs leading-relaxed">
                          Drag files here or use Upload below. New files are stored under your library prefix in the{" "}
                          <span className="font-mono text-[11px]">uploads/</span> subfolder.
                        </p>
                      </div>
                    ) : (
                      <ul className="grid grid-cols-2 gap-2 pb-4">
                        {visible.map((asset) => (
                          <li key={asset.id}>
                            <button
                              type="button"
                              className="group relative w-full overflow-hidden rounded-xl border border-border bg-muted/20 text-left ring-offset-background transition-all hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              onClick={() => {
                                activeParams.onSelect(asset);
                                close();
                              }}
                            >
                              {asset.kind === "image" ? (
                                <span className="relative block aspect-video w-full bg-neutral-900">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={asset.downloadUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                  />
                                </span>
                              ) : asset.kind === "video" ? (
                                <span className="relative block aspect-video w-full bg-neutral-950">
                                  <video
                                    className="h-full w-full object-cover opacity-90"
                                    muted
                                    playsInline
                                    preload="metadata"
                                    src={asset.downloadUrl}
                                  />
                                  <Play
                                    className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow-md"
                                    aria-hidden
                                  />
                                  {typeof asset.durationSec === "number" ? (
                                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1 py-0.5 font-mono text-[10px] font-medium text-white">
                                      {formatDuration(asset.durationSec)}
                                    </span>
                                  ) : null}
                                </span>
                              ) : asset.kind === "snippet" ? (
                                <span className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-sky-950/40 to-neutral-950 px-2">
                                  <FileText className="h-8 w-8 text-sky-200/90" aria-hidden />
                                  <span className="line-clamp-2 w-full text-center text-[11px] font-medium text-white/90">
                                    {asset.name}
                                  </span>
                                </span>
                              ) : (
                                <span className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-violet-950/40 to-neutral-950 px-2">
                                  <Braces className="h-8 w-8 text-violet-200/90" aria-hidden />
                                  <span className="line-clamp-2 w-full text-center text-[11px] font-medium text-white/90">
                                    {asset.name}
                                  </span>
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 border-t border-border/80 bg-background/95 px-2 py-1.5">
                                {asset.kind === "image" ? (
                                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                ) : asset.kind === "video" ? (
                                  <MonitorPlay className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                ) : asset.kind === "snippet" ? (
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                ) : (
                                  <Braces className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                )}
                                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{asset.name}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="explore" className="mt-0 flex flex-1 flex-col outline-none data-[state=inactive]:hidden">
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
                    <p className="text-sm font-medium text-foreground">Explore</p>
                    <p className="text-xs text-muted-foreground">Curated packs and stock integrations can plug in here later.</p>
                  </div>
                </TabsContent>
              </Tabs>

              {mainTab === "library" ? (
                <div className="shrink-0 space-y-2 border-t border-border pb-4 pt-3">
                  {uploadMessage ? (
                    <p
                      className={cn(
                        "text-center text-xs",
                        uploadMessage.startsWith("Uploaded") ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                      )}
                    >
                      {uploadMessage}
                    </p>
                  ) : null}
                  <div className="flex items-stretch gap-2">
                    <button
                      type="button"
                      disabled={uploading}
                      className={cn(
                        "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-white shadow-sm transition-colors",
                        "bg-violet-900 hover:bg-violet-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "disabled:pointer-events-none disabled:opacity-60 dark:bg-violet-800 dark:hover:bg-violet-900",
                      )}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <Upload className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      <span className="truncate">{uploading ? "Uploading…" : primaryUploadLabel}</span>
                    </button>
                    <a
                      href={storageConsoleHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors",
                        "hover:border-violet-500/40 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                      aria-label="Open Firebase Storage in console"
                      title="Firebase console · Storage"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    multiple
                    accept={acceptAttr}
                    aria-hidden
                    tabIndex={-1}
                    onChange={(e) => {
                      void performLibraryUploads(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                </div>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function ProposalMediaLibraryProvider({ children }: { children: React.ReactNode }) {
  const [activeParams, setActiveParams] = React.useState<ProposalMediaLibraryOpenParams | null>(null);

  const openSelection = React.useCallback((params: ProposalMediaLibraryOpenParams) => {
    setActiveParams(params);
  }, []);

  const close = React.useCallback(() => setActiveParams(null), []);

  const value = React.useMemo<ProposalMediaLibraryContextValue>(
    () => ({
      isOpen: activeParams !== null,
      activeParams,
      openSelection,
      close,
    }),
    [activeParams, openSelection, close],
  );

  return (
    <ProposalMediaLibraryContext.Provider value={value}>
      {children}
      <ProposalMediaLibrarySidebar />
    </ProposalMediaLibraryContext.Provider>
  );
}
