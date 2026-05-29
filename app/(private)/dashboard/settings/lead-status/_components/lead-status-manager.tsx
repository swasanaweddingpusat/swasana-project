"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  PenLine,
  Trash2,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLeadStatuses,
  useCreateLeadStatus,
  useUpdateLeadStatus,
  useDeleteLeadStatus,
} from "@/hooks/use-lead-statuses";
import type { LeadStatusItem } from "@/lib/queries/leads";

// ─── Preset Colors (monochrome + 1 destructive) ───────────────────────────────

const PRESET_COLORS: { label: string; value: string }[] = [
  { label: "Light gray", value: "#cbd5e1" },
  { label: "Medium gray", value: "#94a3b8" },
  { label: "Dark gray", value: "#475569" },
  { label: "Near-black", value: "#0f172a" },
  { label: "Black", value: "#111827" },
  { label: "Muted", value: "#6b7280" },
  { label: "Red (destructive)", value: "#dc2626" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadStatusManager() {
  const { data: statuses = [], isLoading } = useLeadStatuses();
  const { mutateAsync: createStatus, isPending: isCreating } = useCreateLeadStatus();
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateLeadStatus();
  const { mutateAsync: deleteStatus, isPending: isDeleting } = useDeleteLeadStatus();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeadStatusItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(PRESET_COLORS[0].value);
  const [formCustomColor, setFormCustomColor] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsFinal, setFormIsFinal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadStatusItem | null>(null);

  const isSaving = isCreating || isUpdating;
  const sortedItems = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormColor(PRESET_COLORS[0].value);
    setFormCustomColor("");
    setFormIsDefault(false);
    setFormIsFinal(false);
    setFormOpen(true);
  }

  function handleOpenEdit(item: LeadStatusItem) {
    if (item.isSystem) {
      toast.error("Status sistem tidak dapat diedit.");
      return;
    }
    setEditingItem(item);
    setFormName(item.name);
    setFormColor(item.color);
    setFormCustomColor("");
    setFormIsDefault(item.isDefault);
    setFormIsFinal(item.isFinal);
    setFormOpen(true);
  }

  async function handleSave() {
    const name = formName.trim();
    if (!name) return;

    const effectiveColor = formCustomColor.trim() || formColor;
    const nextOrder =
      sortedItems.length > 0
        ? Math.max(...sortedItems.map((i) => i.sortOrder)) + 1
        : 1;

    if (editingItem) {
      await updateStatus({ id: editingItem.id, name, color: effectiveColor, isDefault: formIsDefault, isFinal: formIsFinal });
      toast.success("Status berhasil diperbarui.");
    } else {
      await createStatus({ name, color: effectiveColor, sortOrder: nextOrder, isDefault: formIsDefault, isFinal: formIsFinal });
      toast.success("Status berhasil ditambahkan.");
    }

    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteStatus(deleteTarget.id);
      toast.success("Status berhasil dihapus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus status.");
    }
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="pb-6">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-start justify-between px-6 py-4 border-b">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Lead Pipeline Status</h2>
                  <span className="text-sm text-muted-foreground">({statuses.length})</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Kelola status pipeline lead. Status Cold–Hot dapat diubah. Deal adalah status sistem (lock).
                </p>
              </div>
              <Button onClick={handleOpenAdd} className="cursor-pointer shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Status
              </Button>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 px-6">Urutan</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-20">Warna</TableHead>
                    <TableHead className="w-40">Label</TableHead>
                    <TableHead className="w-28 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedItems.map((item) => (
                      <TableRow key={item.id} className={cn(item.isSystem && "bg-muted/30")}>
                        <TableCell className="px-6 text-muted-foreground font-mono text-sm">
                          {item.sortOrder}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span
                              className="inline-block w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className={cn("font-medium", item.isSystem && "text-muted-foreground")}>
                              {item.name}
                            </span>
                            {item.isSystem && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className="w-6 h-6 rounded border border-border"
                            style={{ backgroundColor: item.color }}
                            title={item.color}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            {item.isDefault && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">Default</Badge>
                            )}
                            {item.isFinal && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">Final</Badge>
                            )}
                            {item.isSystem && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-muted text-muted-foreground">
                                System
                              </Badge>
                            )}
                            {!item.isActive && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                                Nonaktif
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end pr-2">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              disabled={item.isSystem}
                              className="p-1.5 rounded-md hover:bg-muted cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Edit"
                            >
                              <PenLine className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              disabled={item.isSystem}
                              className="p-1.5 rounded-md hover:bg-muted cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Hapus"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit Status" : "Tambah Status"}</DialogTitle>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="status-name">Nama Status</Label>
              <Input
                id="status-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Prospek, Negosiasi, Menunggu Konfirmasi"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { void handleSave(); }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Warna</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => { setFormColor(preset.value); setFormCustomColor(""); }}
                    className="w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                    style={{
                      backgroundColor: preset.value,
                      borderColor: formColor === preset.value && !formCustomColor ? "currentColor" : "transparent",
                      outline: formColor === preset.value && !formCustomColor ? "2px solid currentColor" : "2px solid transparent",
                      outlineOffset: "2px",
                    }}
                    aria-label={preset.label}
                    title={preset.label}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={formCustomColor}
                  onChange={(e) => setFormCustomColor(e.target.value)}
                  placeholder="#hex atau kosongkan"
                  className="h-8 text-xs font-mono w-40"
                  maxLength={7}
                />
                <div
                  className="w-7 h-7 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: formCustomColor || formColor }}
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {formCustomColor || formColor}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="form-is-default" className="text-sm font-medium cursor-pointer">
                  Set sebagai Default
                </Label>
                <p className="text-xs text-muted-foreground">Status ini otomatis dipilih untuk lead baru</p>
              </div>
              <Switch id="form-is-default" checked={formIsDefault} onCheckedChange={setFormIsDefault} />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="form-is-final" className="text-sm font-medium cursor-pointer">
                  Status Final
                </Label>
                <p className="text-xs text-muted-foreground">Tandai sebagai akhir pipeline (contoh: Lost)</p>
              </div>
              <Switch id="form-is-final" checked={formIsFinal} onCheckedChange={setFormIsFinal} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1 cursor-pointer" disabled={isSaving}>
                Batal
              </Button>
              <Button onClick={() => { void handleSave(); }} disabled={!formName.trim() || isSaving} className="flex-1 cursor-pointer">
                {isSaving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Status</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus status <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan dan akan gagal jika masih ada lead dengan status ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { void handleDelete(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
