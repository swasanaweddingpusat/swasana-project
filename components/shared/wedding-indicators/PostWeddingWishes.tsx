import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PostWeddingWishesData {
  logamMulia: boolean;
  mobil: boolean;
  rumah: boolean;
  honeymoon: boolean;
  romanticDinner: boolean;
  umroh: boolean;
  custom1: string;
  custom2: string;
}

interface PostWeddingWishesProps {
  data: PostWeddingWishesData;
  onChange: (data: PostWeddingWishesData) => void;
  disabled?: boolean;
}

const predefinedWishes = [
  { key: "logamMulia" as const, label: "Logam Mulia" },
  { key: "mobil" as const, label: "Mobil" },
  { key: "rumah" as const, label: "Rumah" },
  { key: "honeymoon" as const, label: "Honeymoon" },
  { key: "romanticDinner" as const, label: "Romantic Dinner" },
  { key: "umroh" as const, label: "Umroh" },
];

export function PostWeddingWishes({
  data,
  onChange,
  disabled,
}: PostWeddingWishesProps) {
  const handleCheckChange = (key: keyof PostWeddingWishesData) => {
    onChange({
      ...data,
      [key]: !data[key],
    });
  };

  const handleCustomChange = (key: "custom1" | "custom2", value: string) => {
    onChange({
      ...data,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 border">
      <div>
        <h3 className="font-heading text-lg font-semibold text-foreground">
          Keinginan Pasca Pernikahan
        </h3>
        <p className="text-sm text-muted-foreground">
          Hadiah atau pengalaman yang diinginkan pasangan setelah pernikahan
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {predefinedWishes.map(({ key, label }) => (
          <div key={key} className="flex items-center space-x-2">
            <Checkbox
              id={key}
              checked={data[key]}
              onCheckedChange={() => handleCheckChange(key)}
              disabled={disabled}
            />
            <Label htmlFor={key} className="text-sm cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t pt-4">
        <div>
          <Label htmlFor="custom1" className="text-sm">
            Lainnya 1
          </Label>
          <Input
            id="custom1"
            type="text"
            value={data.custom1}
            onChange={(e) => handleCustomChange("custom1", e.target.value)}
            placeholder="Masukkan keinginan lainnya..."
            disabled={disabled}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="custom2" className="text-sm">
            Lainnya 2
          </Label>
          <Input
            id="custom2"
            type="text"
            value={data.custom2}
            onChange={(e) => handleCustomChange("custom2", e.target.value)}
            placeholder="Masukkan keinginan lainnya..."
            disabled={disabled}
            className="mt-2"
          />
        </div>
      </div>
    </div>
  );
}
