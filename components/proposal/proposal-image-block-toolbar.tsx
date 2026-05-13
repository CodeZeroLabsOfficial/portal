"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Crop,
  ImageIcon,
  LayoutGrid,
  Link2,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { ImageBlock } from "@/types/proposal";
import { useProposalMediaLibraryOptional } from "@/components/proposal/proposal-media-library";
import { PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX } from "@/lib/proposal-media-library-blob";
import {
  fetchProposalMediaLibraryPrefix,
  uploadImageFileToProposalLibrary,
} from "@/lib/proposal-image-library-upload";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isProposalImagePlaceholderUrl, PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL } from "@/components/proposal/proposal-image-block-editor";

/** Matches {@link BlockToolbar} `appearance="surface"` chrome (not the dark `elevated` bar). */
const barShell = cn(
  "inline-flex max-w-[calc(100vw-3rem)] shrink-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-full border border-border/70 bg-muted/95 p-1 text-foreground shadow-sm ring-1 ring-black/[0.04] backdrop-blur-sm",
  "dark:bg-zinc-800/95 dark:ring-white/10",
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
);

function tbIconBtn(active?: boolean, opts?: { compactLabel?: boolean }) {
  return cn(
    "inline-flex h-8 shrink-0 items-center justify-center rounded-full text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    opts?.compactLabel ? "min-w-8 px-1.5 text-[10px] font-bold tracking-wide" : "w-8",
    "text-muted-foreground hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
    active && "bg-primary/15 text-foreground",
  );
}

function toolbarDivider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

export type ProposalImageBlockToolbarProps = {
  variant: "shell" | "embedded";
  block: ImageBlock;
  onChange: (next: ImageBlock) => void;
  className?: string;
  onDelete?: () => void;
};

export function ProposalImageBlockToolbar({
  variant: _variant,
  block,
  onChange,
  className,
  onDelete,
}: ProposalImageBlockToolbarProps) {
  const mediaLibrary = useProposalMediaLibraryOptional();
  const [prefix, setPrefix] = React.useState(PROPOSAL_MEDIA_LIBRARY_DEFAULT_PREFIX);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkDraft, setLinkDraft] = React.useState(block.href ?? "");
  const [altOpen, setAltOpen] = React.useState(false);
  const [altDraft, setAltDraft] = React.useState(block.alt ?? "");
  const [capDraft, setCapDraft] = React.useState(block.caption ?? "");

  React.useEffect(() => {
    let cancelled = false;
    void fetchProposalMediaLibraryPrefix().then((p) => {
      if (!cancelled) setPrefix(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (linkOpen) setLinkDraft(block.href ?? "");
  }, [linkOpen, block.href]);

  React.useEffect(() => {
    if (altOpen) {
      setAltDraft(block.alt ?? "");
      setCapDraft(block.caption ?? "");
    }
  }, [altOpen, block.alt, block.caption]);

  const applyUrl = (url: string) => onChange({ ...block, url });

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|gif|webp|avif|svg)$/i.test(file.name)) return;
    setUploading(true);
    try {
      const url = await uploadImageFileToProposalLibrary(prefix, file);
      applyUrl(url);
    } catch {
      /* toast optional */
    } finally {
      setUploading(false);
    }
  };

  const openLibrary = () => {
    if (!mediaLibrary) return;
    mediaLibrary.openSelection({
      allowedKinds: ["image"],
      onSelect: (asset) => {
        if (asset.kind !== "image") return;
        applyUrl(asset.downloadUrl);
      },
    });
  };

  const openExplore = () => {
    if (!mediaLibrary) return;
    mediaLibrary.openSelection({
      allowedKinds: ["image"],
      initialMainTab: "explore",
      onSelect: (asset) => {
        if (asset.kind !== "image") return;
        applyUrl(asset.downloadUrl);
      },
    });
  };

  const align = block.align ?? "center";
  const hasImage = !isProposalImagePlaceholderUrl(block.url);

  const applyLink = () => {
    const t = linkDraft.trim();
    onChange({ ...block, href: t ? t : undefined });
    setLinkOpen(false);
  };

  const applyAltCaption = () => {
    onChange({
      ...block,
      alt: altDraft.trim() ? altDraft.trim() : undefined,
      caption: capDraft.trim() ? capDraft.trim() : undefined,
    });
    setAltOpen(false);
  };

  const setAlign = (next: NonNullable<ImageBlock["align"]>) => {
    onChange({ ...block, align: next });
  };

  return (
    <div className={cn("pointer-events-auto", className)}>
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

      <div
        className={barShell}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={tbIconBtn(Boolean(block.href?.trim()))}
              aria-label="Image link"
              title="Link"
            >
              <Link2 className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start" sideOffset={8} onCloseAutoFocus={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor={`img-href-${block.id}`} className="text-xs">
                URL
              </Label>
              <Input
                id={`img-href-${block.id}`}
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                placeholder="https://…"
                className="h-9"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setLinkOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" className="h-8 text-xs" onClick={applyLink}>
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={tbIconBtn()}
              aria-label="Replace image"
              title="Replace image"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[11rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={(e) => {
                e.preventDefault();
                fileRef.current?.click();
              }}
            >
              <Upload className="h-4 w-4" /> Upload
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              disabled={!mediaLibrary}
              onClick={(e) => {
                e.preventDefault();
                openLibrary();
              }}
            >
              <LayoutGrid className="h-4 w-4" /> Library
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              disabled={!mediaLibrary}
              onClick={(e) => {
                e.preventDefault();
                openExplore();
              }}
            >
              <Search className="h-4 w-4" /> Explore
            </DropdownMenuItem>
            {hasImage ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-muted-foreground focus:text-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    applyUrl(PROPOSAL_IMAGE_BLOCK_PLACEHOLDER_URL);
                  }}
                >
                  Clear image
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <button type="button" className={tbIconBtn()} title="Crop (coming soon)" disabled>
          <Crop className="h-4 w-4" />
        </button>

        <Popover open={altOpen} onOpenChange={setAltOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={tbIconBtn(Boolean(block.alt?.trim() || block.caption?.trim()), { compactLabel: true })}
              aria-label="Alt text and caption"
              title="Alt text and caption"
            >
              ALT
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="center" sideOffset={8} onCloseAutoFocus={(e) => e.preventDefault()}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`toolbar-alt-${block.id}`} className="text-xs">
                  Alt text
                </Label>
                <Input id={`toolbar-alt-${block.id}`} value={altDraft} onChange={(e) => setAltDraft(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`toolbar-cap-${block.id}`} className="text-xs">
                  Caption
                </Label>
                <Input id={`toolbar-cap-${block.id}`} value={capDraft} onChange={(e) => setCapDraft(e.target.value)} className="h-9" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setAltOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" className="h-8 text-xs" onClick={applyAltCaption}>
                  Done
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          className={tbIconBtn(align === "left")}
          aria-label="Align left"
          title="Align left"
          onClick={() => setAlign("left")}
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={tbIconBtn(align === "center")}
          aria-label="Align center"
          title="Align center"
          onClick={() => setAlign("center")}
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={tbIconBtn(align === "right")}
          aria-label="Align right"
          title="Align right"
          onClick={() => setAlign("right")}
        >
          <AlignRight className="h-4 w-4" />
        </button>

        {onDelete ? (
          <>
            {toolbarDivider()}
            <button
              type="button"
              className={cn(tbIconBtn(), "text-destructive hover:bg-red-500/15 hover:text-destructive")}
              aria-label="Delete block"
              title="Delete block"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
