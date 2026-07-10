"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmojiRatingPicker } from "./EmojiRatingPicker";
import { TrashBinTrash, AddCircle } from "@solar-icons/react";

interface ProjectManager {
  name: string;
  rating: number | null;
  notes: string;
}

interface ProjectManagerSectionProps {
  projectManagers: ProjectManager[];
  onChange: (pms: ProjectManager[]) => void;
  disabled?: boolean;
}

export function ProjectManagerSection({
  projectManagers,
  onChange,
  disabled,
}: ProjectManagerSectionProps) {
  const addPM = () => {
    onChange([
      ...projectManagers,
      { name: "", rating: null, notes: "" },
    ]);
  };

  const removePM = (index: number) => {
    onChange(projectManagers.filter((_, i) => i !== index));
  };

  const updatePM = (index: number, pm: Partial<ProjectManager>) => {
    const updated = [...projectManagers];
    updated[index] = { ...updated[index], ...pm };
    onChange(updated);
  };

  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 border">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold text-foreground">
            Project Manager
          </h3>
          <p className="text-sm text-muted-foreground">
            Tambahkan daftar Project Manager dan berikan rating
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPM}
          disabled={disabled}
        >
          <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-2" />
          Tambah PM
        </Button>
      </div>

      {projectManagers.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">
          Belum ada Project Manager
        </p>
      ) : (
        <div className="space-y-4">
          {projectManagers.map((pm, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg bg-muted/30 p-4 border border-muted"
            >
              <div>
                <Label className="text-sm">Nama PM</Label>
                <Input
                  type="text"
                  value={pm.name}
                  onChange={(e) => updatePM(index, { name: e.target.value })}
                  placeholder="Nama Project Manager"
                  disabled={disabled}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Rating</Label>
                <EmojiRatingPicker
                  value={pm.rating}
                  onChange={(rating) => updatePM(index, { rating })}
                  disabled={disabled}
                />
              </div>

              <div>
                <Label className="text-sm">Catatan</Label>
                <Textarea
                  value={pm.notes}
                  onChange={(e) => updatePM(index, { notes: e.target.value })}
                  placeholder="Catatan untuk PM ini"
                  disabled={disabled}
                  className="mt-2 min-h-16"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removePM(index)}
                disabled={disabled}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <TrashBinTrash weight="BoldDuotone" className="h-4 w-4 mr-2" />
                Hapus
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
