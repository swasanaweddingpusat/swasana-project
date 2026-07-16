interface NpsSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function NpsSlider({ value, onChange, disabled }: NpsSliderProps) {
  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 border">
      <div>
        <h3 className="font-heading text-lg font-semibold text-foreground">
          Skor Rekomendasi (NPS)
        </h3>
        <p className="text-sm text-muted-foreground">
          Seberapa mungkin Anda merekomendasikan pernikahan ini ke teman?
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Tidak Mungkin (0)
          </span>
          <span className="inline-block bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
            {value}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            Sangat Mungkin (10)
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="10"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
        />
      </div>
    </div>
  );
}
