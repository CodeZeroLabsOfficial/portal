"use client";

import * as React from "react";
import { upload } from "@vercel/blob/client";
import { AnimatePresence, motion } from "framer-motion";
import { Braces, ChevronLeft, FileText, ImageIcon, Loader2, MonitorPlay, Play, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX,
  buildLibraryUploadPathname,
  proposalLibraryAssetFromBlobListItem,
} from "@/lib/proposal-media-library-blob";
import type { ProposalLibraryAsset, ProposalLibraryAssetKind } from "@/lib/proposal-media-library-types";
import { cn } from "@/lib/utils";

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

function ProposalMediaLibrarySidebar() {
  const ctx = React.useContext(ProposalMediaLibraryContext);
  const isOpen = Boolean(ctx?.isOpen && ctx.activeParams);
  const activeParams = ctx?.activeParams ?? null;
  const close = ctx?.close ?? noop;

  const [mainTab, setMainTab] = React.useState<"library" | "explore">("library");
  const [category, setCategory] = React.useState<LibraryCategory>("all");
  const [query, setQuery] = React.useState("");
  const [assets, setAssets] = React.useState<ProposalLibraryAsset[]>([]);
  const [libraryPrefix, setLibraryPrefix] = React.useState(PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const prevOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !prevOpen.current && activeParams) {
      setMainTab("library");
      setCategory(defaultCategoryForKinds(activeParams.allowedKinds));
      setQuery("");
    }
    prevOpen.current = isOpen;
  }, [isOpen, activeParams]);

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
        return res.json() as Promise<{ assets?: ProposalLibraryAsset[]; libraryPrefix?: string }>;
      })
      .then((data) => {
        if (cancelled) return;
        setAssets(Array.isArray(data.assets) ? data.assets : []);
        if (typeof data.libraryPrefix === "string" && data.libraryPrefix.trim()) {
          setLibraryPrefix(data.libraryPrefix.trim().replace(/\/?$/, "/"));
        } else {
          setLibraryPrefix(PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX);
        }
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

  const normalizedPrefix = libraryPrefix.replace(/\/?$/, "/");

  const onLibraryFilesSelected = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      setUploadError(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const pathname = buildLibraryUploadPathname(normalizedPrefix, file.name);
          const result = await upload(pathname, file, {
            access: "public",
            handleUploadUrl: "/api/proposal-media-library/upload",
            multipart: file.size > 4_500_000,
          });
          const asset = proposalLibraryAssetFromBlobListItem(result, normalizedPrefix);
          if (asset) {
            setAssets((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)]);
          }
        }
      } catch (err: unknown) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [normalizedPrefix],
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

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-5">
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

                <TabsContent value="library" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-[state=inactive]:hidden">
                  <div className="mb-3 flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      multiple
                      accept=".jpg,.jpeg,.png,.gif,.webp,.avif,.svg,.mp4,.webm,.mov,.m4v,.ogv,.html,.htm,.json,image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml,video/mp4,video/webm,video/quicktime,text/html,application/json"
                      aria-label="Upload library files"
                      onChange={onLibraryFilesSelected}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-full justify-center gap-2"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Upload className="h-4 w-4" aria-hidden />
                      )}
                      {uploading ? "Uploading…" : "Upload to library"}
                    </Button>
                    {uploadError ? <p className="text-center text-xs text-destructive">{uploadError}</p> : null}
                  </div>
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

                  <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
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
                                return res.json() as Promise<{ assets?: ProposalLibraryAsset[]; libraryPrefix?: string }>;
                              })
                              .then((data) => {
                                setAssets(Array.isArray(data.assets) ? data.assets : []);
                                if (typeof data.libraryPrefix === "string" && data.libraryPrefix.trim()) {
                                  setLibraryPrefix(data.libraryPrefix.trim().replace(/\/?$/, "/"));
                                }
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
                        <p>No matching files in the library.</p>
                        <p className="text-xs leading-relaxed">
                          Upload images, videos, HTML snippets, or JSON blocks here (admin and team). Files are stored in
                          Vercel Blob under the library prefix.
                        </p>
                      </div>
                    ) : (
                      <ul className="grid grid-cols-2 gap-2 pb-6">
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
