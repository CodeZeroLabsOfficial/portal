"use client";

import * as React from "react";
import { ImageIcon, LayoutGrid, Search, Upload } from "lucide-react";
import type { ImageBlock } from "@/types/proposal";
import { useProposalMediaLibraryOptional } from "@/components/proposal/proposal-media-library";
import { PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX } from "@/lib/proposal-media-library-blob";
import {
  fetchProposalMediaLibraryPrefix,
  uploadImageFileToProposalLibrary,
} from "@/lib/proposal-image-library-upload";
import { cn } from "@/lib/utils";

/** Matches `createBlock("image")` placeholder so new blocks show the picker surface. */
export const PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL = "https://";

export function isProposalImagePlaceholderUrl(url: string): boolean {
  const t = url.trim();
  return t === "" || t === PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL || t === "http://";
}

const pickerActionClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-50";

function imageAlignClass(align: ImageBlock["align"]): string {
  switch (align) {
    case "right":
      return "ml-auto mr-0";
    case "center":
      return "mx-auto";
    case "left":
    default:
      return "mr-auto ml-0";
  }
}

type ProposalImageBlockEditorProps = {
  block: ImageBlock;
  onChange: (next: ImageBlock) => void;
};

/**
 * In-canvas image block surface: empty state picker or aligned preview only.
 * Editing controls live on {@link ProposalImageBlockToolbar}.
 */
export function ProposalImageBlockEditor({ block, onChange }: ProposalImageBlockEditorProps) {
  const mediaLibrary = useProposalMediaLibraryOptional();
  const [prefix, setPrefix] = React.useState(PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX);
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchProposalMediaLibraryPrefix().then((p) => {
      if (!cancelled) setPrefix(p);
    });
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
        const url = await uploadImageFileToProposalLibrary(prefix, file);
        applyUrl(url);
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
  const align = block.align ?? "center";

  const dropZone = (
    <div
      className={cn(
        "w-full max-w-2xl rounded-lg border-2 border-sky-500/45 p-2 dark:border-sky-400/40",
        imageAlignClass(align),
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

  if (!hasImage) {
    return <div className="flex w-full flex-col">{dropZone}</div>;
  }

  return (
    <div className={cn("flex w-full max-w-3xl flex-col", imageAlignClass(align))}>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary blob / external URLs in staff CMS */}
      <img src={block.url} alt={block.alt ?? ""} className="max-h-[min(70vh,520px)] w-full object-contain" />
    </div>
  );
}
