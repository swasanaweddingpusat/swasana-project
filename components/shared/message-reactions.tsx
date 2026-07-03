"use client";

/**
 * message-reactions.tsx
 *
 * Named exports:
 *   - MessageReactions   — badge list of existing reactions (hover to see names, click to toggle)
 *   - AddReactionButton  — trigger that opens preset + full EmojiPicker in a Popover
 *
 * Parent (booking-comment-panel) is responsible for:
 *   - calling `toggleCommentReaction(commentId, emoji)` action
 *   - optimistic React Query cache update
 * These components only call `onToggle(emoji)` and close the popover.
 */

import { useState } from "react";
import { AddCircle, SmileCircle } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

// ─── Shared types ─────────────────────────────────────────────────────────────

interface AggregatedReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  names: string[];
}

// ─── MessageReactions ─────────────────────────────────────────────────────────

interface MessageReactionsProps {
  reactions: AggregatedReaction[];
  onToggle: (emoji: string) => void;
  isSelf: boolean;
  align?: "start" | "end";
}

export function MessageReactions({ reactions, onToggle, isSelf, align = "start" }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 mt-1",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      {reactions.map(({ emoji, count, reactedByMe, names }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          title={names.length > 0 ? names.join(", ") : undefined}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
            "border transition-colors select-none cursor-pointer",
            reactedByMe
              ? isSelf
                ? "bg-primary-foreground/20 border-primary-foreground/60 text-primary-foreground font-medium"
                : "bg-accent border-primary/40 text-foreground font-medium"
              : "bg-card border-border text-foreground hover:bg-accent",
          )}
          aria-pressed={reactedByMe}
          aria-label={`${emoji} ${count} reaksi`}
        >
          <span>{emoji}</span>
          <span className="font-mono tabular-nums">{count}</span>
        </button>
      ))}
    </div>
  );
}

// ─── AddReactionButton ────────────────────────────────────────────────────────

interface AddReactionButtonProps {
  onToggle: (emoji: string) => void;
  side?: "top" | "bottom";
  align?: "start" | "end" | "center";
  onOpenChange?: (open: boolean) => void;
}

export function AddReactionButton({ onToggle, side = "top", align = "start", onOpenChange }: AddReactionButtonProps) {
  const [open, setOpen] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);

  const handlePreset = (emoji: string) => {
    onToggle(emoji);
    setOpen(false);
    setShowFullPicker(false);
  };

  const handleFullPick = (emoji: string) => {
    onToggle(emoji);
    setOpen(false);
    setShowFullPicker(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setShowFullPicker(false);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(
          "h-6 w-6 flex items-center justify-center rounded-full",
          "text-muted-foreground hover:text-foreground hover:bg-accent",
          "transition-colors cursor-pointer",
        )}
        aria-label="Tambah reaksi"
      >
        <SmileCircle weight="BoldDuotone" className="h-4 w-4" />
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={align}
        className={cn(
          "p-2 w-auto",
          showFullPicker ? "!w-auto" : "w-auto",
        )}
      >
        {showFullPicker ? (
          /* Full emoji picker */
          <div>
            <EmojiPicker onSelect={handleFullPick} />
          </div>
        ) : (
          /* Preset row + expand button */
          <div className="flex items-center gap-1">
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handlePreset(emoji); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-lg hover:bg-accent transition-colors cursor-pointer"
                aria-label={`Reaksi ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            {/* Open full picker */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowFullPicker(true); }}
              className={cn(
                "h-8 w-8 flex items-center justify-center rounded-lg",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
                "transition-colors cursor-pointer",
              )}
              aria-label="Pilih emoji lainnya"
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
