"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Drawer } from "@/components/shared/drawer";
import { TermConditionEditor } from "@/components/shared/TermConditionEditor";
import { updatePackageTC } from "@/actions/package";
import type { PackageQueryItem } from "@/lib/queries/packages";

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  pkg: PackageQueryItem | null;
  /** Judul/label yang ditampilkan di FE — default "Term & Condition". MICE pakai "Term & Payment". */
  label?: string;
}

export function PackageTCDrawer({ open, onClose, pkg, label = "Term & Condition" }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");

  // Sync local content when the drawer opens or the target package changes.
  // Adjusted during render (not in an effect) to avoid a cascading re-render.
  const syncKey = open ? (pkg?.id ?? "empty") : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setContent(pkg?.termAndCondition ?? "");
  }

  async function handleSave() {
    if (!pkg) return;
    setSaving(true);
    const value = content.trim() && content !== "<p></p>" ? content : null;
    const res = await updatePackageTC(pkg.id, value);
    setSaving(false);
    if (res.success) {
      toast.success("T&C berhasil disimpan.");
      await qc.invalidateQueries({ queryKey: ["packages"] });
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={`${label} — ${pkg?.packageName ?? ""}`}
      maxWidth="sm:max-w-full"
      childrenClassName="overflow-hidden flex flex-col"
      headerActions={
        <Button
          onClick={handleSave}
          disabled={saving || !pkg}
          size="sm"
          className="cursor-pointer"
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
        {/* Package info */}
        {pkg && (
          <div className="shrink-0">
            <Label className="text-sm font-medium mb-1 block">Paket</Label>
            <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border text-sm font-medium truncate">
              {pkg.category === "WEDDINGS" ? `${pkg.packageName} · ${pkg.pax} PAX` : pkg.packageName}
            </div>
          </div>
        )}

        {/* Editor + Variable Panel */}
        <TermConditionEditor
          value={content}
          onChange={setContent}
          placeholder={`Tulis ${label} di sini...`}
        />
      </div>
    </Drawer>
  );
}
