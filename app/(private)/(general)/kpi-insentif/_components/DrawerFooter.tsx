import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface DrawerFooterProps {
  onCancel: () => void;
  isSaving: boolean;
  submitLabel: string;
  savingLabel?: string;
  submitIcon?: ReactNode;
  cancelLabel?: string;
}

export function DrawerFooter({
  onCancel,
  isSaving,
  submitLabel,
  savingLabel = "Menyimpan...",
  submitIcon,
  cancelLabel = "Batal",
}: DrawerFooterProps) {
  return (
    <div className="sticky bottom-0 bg-background border-t border-border pt-4 flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="flex-1 rounded-full"
        onClick={onCancel}
        disabled={isSaving}
      >
        {cancelLabel}
      </Button>
      <Button type="submit" className="flex-1 rounded-full gap-1.5" disabled={isSaving}>
        {submitIcon}
        {isSaving ? savingLabel : submitLabel}
      </Button>
    </div>
  );
}
