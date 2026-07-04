"use client";

import { TextBold, TextItalic, TextCross, Code, List, ListCheck, ChatRoundLine } from "@solar-icons/react";
import type { FormatType } from "@/lib/whatsapp-format";
import { cn } from "@/lib/utils";

interface Props {
  onFormat: (type: FormatType) => void;
  className?: string;
}

const BUTTONS: { type: FormatType; icon: typeof TextBold; label: string }[] = [
  { type: "bold", icon: TextBold, label: "Tebal (Ctrl+B)" },
  { type: "italic", icon: TextItalic, label: "Miring (Ctrl+I)" },
  { type: "strike", icon: TextCross, label: "Coret" },
  { type: "mono", icon: Code, label: "Monospace" },
  { type: "bullet", icon: List, label: "List bullet" },
  { type: "numbered", icon: ListCheck, label: "List nomor" },
  { type: "quote", icon: ChatRoundLine, label: "Kutipan" },
];

export function FormatToolbar({ onFormat, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-xl border border-border bg-card p-1 shadow-md",
        className,
      )}
    >
      {BUTTONS.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          type="button"
          // preventDefault on mousedown supaya seleksi textarea tetap utuh saat klik tombol
          onMouseDown={(e) => { e.preventDefault(); onFormat(type); }}
          aria-label={label}
          title={label}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            "transition-colors cursor-pointer",
          )}
        >
          <Icon weight="BoldDuotone" className={cn("h-4 w-4")} />
        </button>
      ))}
    </div>
  );
}
