"use client";

import { CloseCircle } from "@solar-icons/react";
import { useLinkPreview } from "@/hooks/use-link-preview";
import { cn } from "@/lib/utils";

interface Props {
  url: string;
  onDismiss: () => void;
}

export function LinkPreviewCard({ url, onDismiss }: Props) {
  const { data, isLoading } = useLinkPreview(url);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-3 flex gap-3 animate-pulse">
        <div className="shrink-0 w-16 h-16 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!data || "error" in data || (!data.title && !data.description && !data.image)) return null;

  let domain = "";
  try { domain = new URL(data.url ?? url).hostname; } catch { domain = ""; }

  return (
    <div className="rounded-xl border bg-card p-3 flex gap-3 relative shadow-sm">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Tutup preview"
      >
        <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
      </button>

      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt={data.title ?? "preview"}
          className="shrink-0 w-16 h-16 rounded-lg object-cover bg-muted"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}

      <div className="flex-1 min-w-0 pr-5">
        {domain && (
          <p className={cn("text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 truncate")}>{domain}</p>
        )}
        {data.title && (
          <p className="text-sm font-semibold line-clamp-2 leading-snug">{data.title}</p>
        )}
        {data.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{data.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── BubbleLinkPreview ──────────────────────────────────────────────────────
// Inline preview rendered INSIDE a sent message bubble (WhatsApp style):
// image on top (full width), then title/description/domain below.

interface BubblePreviewProps {
  url: string;
  isSelf: boolean;
}

export function BubbleLinkPreview({ url, isSelf }: BubblePreviewProps) {
  const { data, isLoading } = useLinkPreview(url);

  if (isLoading || !data || "error" in data || (!data.title && !data.description && !data.image)) return null;

  let domain = "";
  try { domain = new URL(data.url ?? url).hostname; } catch { domain = ""; }

  const surface = isSelf ? "bg-primary-foreground/10" : "bg-black/5";
  const accent = isSelf ? "border-primary-foreground/40" : "border-primary/40";
  const subtle = isSelf ? "text-primary-foreground/70" : "text-muted-foreground";

  return (
    <a
      href={data.url ?? url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block rounded-lg overflow-hidden mb-1 border-l-2 no-underline",
        surface, accent,
      )}
    >
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt={data.title ?? "preview"}
          className="w-full max-h-40 object-cover bg-black/10"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
      <div className="px-2 py-1.5 min-w-0">
        {domain && <p className={cn("text-[10px] uppercase tracking-wide truncate", subtle)}>{domain}</p>}
        {data.title && <p className="text-xs font-semibold line-clamp-2 leading-snug">{data.title}</p>}
        {data.description && <p className={cn("text-[11px] line-clamp-2 mt-0.5", subtle)}>{data.description}</p>}
      </div>
    </a>
  );
}
