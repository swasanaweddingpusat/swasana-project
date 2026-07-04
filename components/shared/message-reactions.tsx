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
        "inline-flex flex-nowrap w-fit rounded-full border border-border bg-card shadow-sm overflow-hidden",
      )}
    >
      {reactions.map(({ emoji, count, reactedByMe, names }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          title={names.length > 0 ? names.join(", ") : undefined}
          className={cn(
            "inline-flex items-center gap-px px-1 py-0.5 leading-none",
            "transition-colors select-none cursor-pointer",
            reactedByMe ? "bg-accent" : "hover:bg-accent/60",
          )}
          aria-pressed={reactedByMe}
          aria-label={`${emoji} ${count} reaksi`}
        >
          <span className="text-[13px]">{emoji}</span>
          {count > 1 && <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{count}</span>}
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
  /** Render just the preset row inline (no Popover wrapper) — for use inside DropdownMenu */
  inline?: boolean;
}

export function AddReactionButton({ onToggle, side = "top", align = "start", onOpenChange, inline }: AddReactionButtonProps) {
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

  // Inline mode: just the preset row, no Popover
  if (inline) {
    return (
      <div className="flex items-center gap-0.5">
        {PRESET_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handlePreset(emoji); }}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-base hover:bg-accent transition-colors cursor-pointer"
            aria-label={`Reaksi ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <Popover>
          <PopoverTrigger
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-lg",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              "transition-colors cursor-pointer",
            )}
            aria-label="Pilih emoji lainnya"
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="p-2 w-auto">
            <EmojiPicker onSelect={handleFullPick} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

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
        className="p-2 w-auto"
      >
        {showFullPicker ? (
          <div>
            <EmojiPicker onSelect={handleFullPick} />
          </div>
        ) : (
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

// ─── QuickReactionBar ─────────────────────────────────────────────────────────
// Floating preset-emoji row shown on bubble hover. Full picker via "+" button.

interface QuickReactionBarProps {
  onToggle: (emoji: string) => void;
  isSelf: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

export function QuickReactionBar({ onToggle, isSelf, onPickerOpenChange }: QuickReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePickerOpen = (open: boolean) => {
    setPickerOpen(open);
    onPickerOpenChange?.(open);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-md",
      )}
    >
      {PRESET_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onToggle(emoji); }}
          className="h-7 w-7 flex items-center justify-center rounded-full text-base hover:bg-accent hover:scale-110 transition-all cursor-pointer"
          aria-label={`Reaksi ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      <Popover open={pickerOpen} onOpenChange={handlePickerOpen}>
        <PopoverTrigger
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-full",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
            "transition-colors cursor-pointer",
          )}
          aria-label="Pilih emoji lainnya"
        >
          <AddCircle weight="BoldDuotone" className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent side="top" align={isSelf ? "end" : "start"} className="p-2 w-auto">
          <EmojiPicker onSelect={(emoji) => { onToggle(emoji); handlePickerOpen(false); }} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
