import { Button } from "@/components/ui/button";

interface EmojiRatingPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

const ratings = [
  { score: 4.0, emoji: "😍", label: "Sangat Baik" },
  { score: 3.5, emoji: "😊", label: "Baik" },
  { score: 3.0, emoji: "😐", label: "Biasa Saja" },
  { score: 2.0, emoji: "😕", label: "Buruk" },
  { score: 1.0, emoji: "😠", label: "Sangat Buruk" },
];

export function EmojiRatingPicker({
  value,
  onChange,
  disabled,
}: EmojiRatingPickerProps) {
  return (
    <div className="flex gap-2">
      {ratings.map(({ score, emoji, label }) => (
        <Button
          key={score}
          type="button"
          variant={value === score ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(value === score ? null : score)}
          disabled={disabled}
          title={label}
          className="h-12 w-12 text-2xl p-0"
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}
