import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { EmojiRatingPicker } from "./EmojiRatingPicker";

interface RatingSectionProps {
  title: string;
  subtitle?: string;
  personName?: string;
  onPersonNameChange?: (value: string) => void;
  rating: number | null | undefined;
  onRatingChange: (value: number | null) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  disabled?: boolean;
}

export function RatingSection({
  title,
  subtitle,
  personName,
  onPersonNameChange,
  rating,
  onRatingChange,
  notes,
  onNotesChange,
  disabled,
}: RatingSectionProps) {
  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 border">
      <div>
        <h3 className="font-heading text-lg font-semibold text-foreground">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {personName !== undefined && onPersonNameChange && (
        <div>
          <Label htmlFor={`person-name-${title}`} className="text-sm">
            Nama
          </Label>
          <Input
            id={`person-name-${title}`}
            type="text"
            value={personName}
            onChange={(e) => onPersonNameChange(e.target.value)}
            placeholder="Masukkan nama"
            disabled={disabled}
            className="mt-2"
          />
        </div>
      )}

      <div>
        <Label className="text-sm mb-2 block">Rating</Label>
        <EmojiRatingPicker
          value={rating ?? null}
          onChange={onRatingChange}
          disabled={disabled}
        />
      </div>

      <div>
        <Label htmlFor={`notes-${title}`} className="text-sm">
          Catatan
        </Label>
        <Textarea
          id={`notes-${title}`}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Tambahkan catatan..."
          disabled={disabled}
          className="mt-2 min-h-20"
        />
      </div>
    </div>
  );
}
