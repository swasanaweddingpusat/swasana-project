"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── Emoji dataset (grouped) ────────────────────────────────────────────────
// Curated subset — cukup buat chat ops, tanpa nambah dependency.

interface EmojiCategory {
  key: string;
  icon: string;
  label: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    key: "smileys",
    icon: "😀",
    label: "Smiley & Emosi",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "😊",
      "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙",
      "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎",
      "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😣", "😖",
      "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯",
      "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔",
      "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😴",
      "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒",
    ],
  },
  {
    key: "gestures",
    icon: "👍",
    label: "Gestur & Orang",
    emojis: [
      "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖",
      "👋", "🤝", "🙏", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶",
      "💪", "🦾", "🖕", "✍️", "🤳", "💅", "🫵", "👀", "👁️", "🧠",
    ],
  },
  {
    key: "hearts",
    icon: "❤️",
    label: "Hati & Simbol",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💯",
      "✅", "❌", "⭕", "❗", "❓", "‼️", "⚠️", "🔥", "⭐", "🌟",
      "✨", "💫", "🎉", "🎊", "👑", "💎", "🔔", "📌", "📎", "🔒",
    ],
  },
  {
    key: "objects",
    icon: "💼",
    label: "Objek & Kerja",
    emojis: [
      "💼", "📁", "📂", "🗂️", "📅", "📆", "🗓️", "📝", "✏️", "📄",
      "📃", "📊", "📈", "📉", "📋", "📌", "📍", "🖇️", "📐", "📏",
      "💰", "💵", "💳", "🧾", "💸", "🏦", "📧", "📨", "📩", "📤",
      "📥", "📦", "☎️", "📞", "📱", "💻", "🖥️", "⌨️", "🖨️", "🕐",
    ],
  },
  {
    key: "food",
    icon: "🍽️",
    label: "Makanan & Acara",
    emojis: [
      "🍽️", "🍴", "🥂", "🍾", "🥳", "🎂", "🍰", "🧁", "🍮", "🍭",
      "☕", "🍵", "🥤", "🧃", "🍹", "🍸", "🍷", "🍺", "🎈", "🎁",
      "🎀", "🎗️", "🏆", "🥇", "🌸", "💐", "🌹", "🌺", "🌷", "🌼",
      "💒", "💍", "👰", "🤵", "🎼", "🎵", "🎶", "🎤", "📸", "🎥",
    ],
  },
];

interface Props {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: Props) {
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].key);
  const category = CATEGORIES.find((c) => c.key === activeCat) ?? CATEGORIES[0];

  return (
    <div className={cn("flex", "flex-col", "w-72", "h-64", "bg-card", "rounded-xl", "overflow-hidden")}>
      {/* Emoji grid */}
      <div className={cn("flex-1", "overflow-y-auto", "p-2")}>
        <p className={cn("text-[10px]", "font-medium", "text-muted-foreground", "px-1", "mb-1", "sticky", "top-0")}>
          {category.label}
        </p>
        <div className={cn("grid", "grid-cols-8", "gap-0.5")}>
          {category.emojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(emoji); }}
              className={cn(
                "h-8", "w-8", "flex", "items-center", "justify-center",
                "rounded-lg", "text-lg", "leading-none",
                "hover:bg-accent", "transition-colors", "cursor-pointer",
              )}
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className={cn("shrink-0", "flex", "items-center", "gap-0.5", "border-t", "border-border", "px-1.5", "py-1")}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setActiveCat(c.key); }}
            className={cn(
              "flex-1", "h-8", "flex", "items-center", "justify-center",
              "rounded-lg", "text-base", "leading-none", "transition-colors", "cursor-pointer",
              c.key === activeCat ? "bg-accent" : "hover:bg-accent/50 opacity-60",
            )}
            aria-label={c.label}
          >
            {c.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
