"use client";

import * as React from "react";
import { upload } from "@vercel/blob/client";
import { ImageIcon, LayoutGrid, Search, Upload } from "lucide-react";
import type { ImageBlock } from "@/types/proposal";
import { useProposalMediaLibraryOptional } from "@/components/proposal/proposal-media-library";
import {
  PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX,
  buildLibraryUploadPathname,
  proposalLibraryAssetFromBlobListItem,
} from "@/lib/proposal-media-library-blob";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Matches `createBlock("image")` placeholder so new blocks show the picker surface. */
export const PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL = "https://";

export function isProposalImagePlaceholderUrl(url: string): boolean {
  const t = url.trim();
  return t === "" || t === PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL || t === "http://";
}

const pickerActionClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-50";

type ProposalImageBlockEditorProps = {
  block: ImageBlock;
  onChange: (next: ImageBlock) => void;
};

export function ProposalImageBlockEditor({ block, onChange }: ProposalImageBlockEditorProps) {
  const mediaLibrary = useProposalMediaLibraryOptional();
  const [prefix, setPrefix] = React.useState(PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX);
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [showUrlField, setShowUrlField] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/proposal-media-library")
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ libraryPrefix?: string }>;
      })
      .then((data) => {
        if (cancelled || !data || typeof data.libraryPrefix !== "string" || !data.libraryPrefix.trim()) return;
        setPrefix(data.libraryPrefix.trim().replace(/\/?$/, "/"));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const applyUrl = React.useCallback(
    (url: string) => {
      onChange({ ...block, url });
    },
    [block, onChange],
  );

  const uploadFile = React.useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/") && !/\.(jpe?g|png|gif|webp|avif|svg)$/i.test(file.name)) {
        setUploadErr("Please choose an image file.");
        return;
      }
      setUploadErr(null);
      setUploading(true);
      try {
        const pathname = buildLibraryUploadPathname(prefix, file.name);
        const result = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/proposal-media-library/upload",
          multipart: file.size > 4_500_000,
        });
        const asset = proposalLibraryAssetFromBlobListItem(result, prefix);
        if (asset?.kind === "image") {
          applyUrl(asset.downloadUrl);
        } else {
          setUploadErr("Upload did not return an image.");
        }
      } catch (e: unknown) {
        setUploadErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [prefix, applyUrl],
  );

  const openLibrary = React.useCallback(() => {
    if (!mediaLibrary) return;
    mediaLibrary.openSelection({
      allowedKinds: ["image"],
      onSelect: (asset) => {
        if (asset.kind !== "image") return;
        applyUrl(asset.downloadUrl);
      },
    });
  }, [mediaLibrary, applyUrl]);

  const openExplore = React.useCallback(() => {
    if (!mediaLibrary) return;
    mediaLibrary.openSelection({
      allowedKinds: ["image"],
      initialMainTab: "explore",
      onSelect: (asset) => {
        if (asset.kind !== "image") return;
        applyUrl(asset.downloadUrl);
      },
    });
  }, [mediaLibrary, applyUrl]);

  const hasImage = !isProposalImagePlaceholderUrl(block.url);

  const dropZone = (
    <div
      className={cn(
        "rounded-lg border-2 border-sky-500/45 p-2 dark:border-sky-400/40",
        dragOver && "border-primary ring-2 ring-primary/20",
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-md border border-dashed border-muted-foreground/40 bg-muted/15 px-5 py-10 text-center transition-colors",
          dragOver && "border-primary/55 bg-muted/25",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void uploadFile(f);
        }}
      >
        <ImageIcon className="h-10 w-10 text-muted-foreground/65" aria-hidden />
        <p className="text-sm font-medium text-muted-foreground">Drop an image here</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.svg"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void uploadFile(f);
          }}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className={pickerActionClass}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload
          </button>
          <button type="button" className={pickerActionClass} disabled={uploading || !mediaLibrary} onClick={openLibrary}>
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Library
          </button>
          <button type="button" className={pickerActionClass} disabled={uploading || !mediaLibrary} onClick={openExplore}>
            <Search className="h-4 w-4" aria-hidden />
            Explore
          </button>
        </div>
        {uploadErr ? <p className="text-xs text-destructive">{uploadErr}</p> : null}
        {uploading ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
        {!mediaLibrary ? (
          <p className="max-w-xs text-xs text-muted-foreground">
            Library and Explore open in the proposal editor when the media library is available.
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {!hasImage ? (
        dropZone
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary blob / external URLs in staff CMS */}
            <img src={block.url} alt="" className="max-h-64 w-full object-contain" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={pickerActionClass}
              onClick={() => applyUrl(PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL)}
            >
              Replace image
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`img-alt-${block.id}`}>Alt text</Label>
        <Input
          id={`img-alt-${block.id}`}
          value={block.alt ?? ""}
          onChange={(e) => onChange({ ...block, alt: e.target.value })}
          placeholder="Describe the image for accessibility"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`img-cap-${block.id}`}>Caption</Label>
        <Input
          id={`img-cap-${block.id}`}
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
        />
      </div>

      <div className="border-t border-border pt-3">
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => setShowUrlField((v) => !v)}
        >
          {showUrlField ? "Hide image URL" : "Paste image URL"}
        </button>
        {showUrlField ? (
          <div className="mt-2 space-y-1.5">
            <Label htmlFor={`img-url-${block.id}`}>Image URL</Label>
            <Input
              id={`img-url-${block.id}`}
              value={block.url}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
