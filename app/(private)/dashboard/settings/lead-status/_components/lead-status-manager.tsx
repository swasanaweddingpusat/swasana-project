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
  ChevronUp,
  ChevronDown,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadStatusItem {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isFinal: boolean;
  isSystem: boolean;
  isActive: boolean;
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const INITIAL_STATUSES: LeadStatusItem[] = [
  {
    id: "1",
    name: "Cold",
    color: "#3b82f6",
    sortOrder: 1,
    isDefault: true,
    isFinal: false,
    isSystem: false,
    isActive: true,
  },
  {
    id: "2",
    name: "Warm",
    color: "#f59e0b",
    sortOrder: 2,
    isDefault: false,
    isFinal: false,
    isSystem: false,
    isActive: true,
  },
  {
    id: "3",
    name: "Hot",
    color: "#ef4444",
    sortOrder: 3,
    isDefault: false,
    isFinal: false,
    isSystem: false,
    isActive: true,
  },
  {
    id: "4",
    name: "Freeze",
    color: "#6b7280",
    sortOrder: 4,
    isDefault: false,
    isFinal: false,
    isSystem: false,
    isActive: true,
  },
  {
    id: "5",
    name: "Lost",
    color: "#1f2937",
    sortOrder: 5,
    isDefault: false,
    isFinal: true,
    isSystem: false,
    isActive: true,
  },
  {
    id: "6",
    name: "Converted",
    color: "#22c55e",
    sortOrder: 6,
    isDefault: false,
    isFinal: true,
    isSystem: true,
    isActive: true,
  },
];

// ─── Preset Colors ────────────────────────────────────────────────────────────

const PRESET_COLORS: { label: string; value: string }[] = [
  { label: "Gray", value: "#6b7280" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Yellow", value: "#f59e0b" },
  { label: "Green", value: "#22c55e" },
  { label: "Red", value: "#ef4444" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Indigo", value: "#6366f1" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadStatusManager() {
  const [items, setItems] = useState<LeadStatusItem[]>(
    [...INITIAL_STATUSES].sort((a, b) => a.sortOrder - b.sortOrder)
  );

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeadStatusItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(PRESET_COLORS[0].value);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsFinal, setFormIsFinal] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<LeadStatusItem | null>(null);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormColor(PRESET_COLORS[0].value);
    setFormIsDefault(false);
    setFormIsFinal(false);
    setFormOpen(true);
  }

  function handleOpenEdit(item: LeadStatusItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormColor(item.color);
    setFormIsDefault(item.isDefault);
    setFormIsFinal(item.isFinal);
    setFormOpen(true);
  }

  function handleSave() {
    if (!formName.trim()) return;

    if (editingItem) {
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === editingItem.id) {
            return {
              ...i,
              name: formName.trim(),
              color: formColor,
              isFinal: formIsFinal,
              isDefault: formIsDefault,
            };
          }
          // If this item was set as default, unset all others
          if (formIsDefault) {
            return { ...i, isDefault: false };
          }
          return i;
        })
      );
    } else {
      const nextOrder =
        items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 1;
      const newItem: LeadStatusItem = {
        id: `${Date.now()}`,
        name: formName.trim(),
        color: formColor,
        sortOrder: nextOrder,
        isDefault: formIsDefault,
        isFinal: formIsFinal,
        isSystem: false,
        isActive: true,
      };

      setItems((prev) => {
        const updated = formIsDefault
          ? prev.map((i) => ({ ...i, isDefault: false }))
          : prev;
        return [...updated, newItem];
      });
    }

    toast.success("Status berhasil disimpan");
    setFormOpen(false);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Status berhasil dihapus");
    setDeleteTarget(null);
  }

  function handleMoveUp(id: string) {
    setItems((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((i) => i.id === id);
      if (idx <= 0) return prev;
      const result = [...sorted];
      const temp = result[idx].sortOrder;
      result[idx] = { ...result[idx], sortOrder: result[idx - 1].sortOrder };
      result[idx - 1] = { ...result[idx - 1], sortOrder: temp };
      return result.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  function handleMoveDown(id: string) {
    setItems((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((i) => i.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const result = [...sorted];
      const temp = result[idx].sortOrder;
      result[idx] = { ...result[idx], sortOrder: result[idx + 1].sortOrder };
      result[idx + 1] = { ...result[idx + 1], sortOrder: temp };
      return result.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="pb-6">
        <Card>
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    Lead Pipeline Status
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    ({items.length})
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Kelola status pipeline lead. Status bisa diubah, ditambah, dan
                  diurutkan.
                </p>
              </div>
              <Button
                onClick={handleOpenAdd}
                className="cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Status
              </Button>
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 px-6">Urutan</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-20">Warna</TableHead>
                  <TableHead className="w-28">Label</TableHead>
                  <TableHead className="w-36 text-right pr-6">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Belum ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item, idx) => (
                    <TableRow
                      key={item.id}
                      className={cn(item.isSystem && "bg-muted/30")}
                    >
                      {/* Sort order */}
                      <TableCell className="px-6 text-muted-foreground font-mono text-sm">
                        {item.sortOrder}
                      </TableCell>

                      {/* Name + color circle */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span
                            className={cn(
                              "font-medium",
                              item.isSystem && "text-muted-foreground"
                            )}
                          >
                            {item.name}
                          </span>
                          {item.isSystem && (
                            <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </TableCell>

                      {/* Color swatch */}
                      <TableCell>
                        <div
                          className="w-6 h-6 rounded border border-border"
                          style={{ backgroundColor: item.color }}
                          title={item.color}
                        />
                      </TableCell>

                      {/* Badges */}
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.isDefault && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0"
                            >
                              Default
                            </Badge>
                          )}
                          {item.isFinal && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0"
                            >
                              Final
                            </Badge>
                          )}
                          {item.isSystem && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0 bg-muted text-muted-foreground"
                            >
                              System
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end pr-2">
                          {/* Move Up */}
                          <button
                            onClick={() => handleMoveUp(item.id)}
                            disabled={idx === 0}
                            className="p-1.5 rounded-md hover:bg-muted cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Pindah ke atas"
                          >
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => handleMoveDown(item.id)}
                            disabled={idx === sortedItems.length - 1}
                            className="p-1.5 rounded-md hover:bg-muted cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Pindah ke bawah"
                          >
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            disabled={item.isSystem}
                            className="p-1.5 rounded-md hover:bg-muted cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Edit"
                          >
                            <PenLine className="w-4 h-4 text-muted-foreground" />
                          </button>

                          {/* Delete */}
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
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>
            {editingItem ? "Edit Status" : "Tambah Status"}
          </DialogTitle>
          <div className="space-y-5 pt-2">
            {/* Nama Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status-name">Nama Status</Label>
              <Input
                id="status-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Prospek, Negosiasi, Menunggu Konfirmasi"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSave();
                  }
                }}
              />
            </div>

            {/* Warna */}
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setFormColor(preset.value)}
                    className="w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                    style={{
                      backgroundColor: preset.value,
                      borderColor:
                        formColor === preset.value ? "currentColor" : "transparent",
                      outline:
                        formColor === preset.value
                          ? "2px solid currentColor"
                          : "2px solid transparent",
                      outlineOffset: "2px",
                    }}
                    aria-label={preset.label}
                    title={preset.label}
                  />
                ))}
                {/* Preview selected color */}
                <div className="ml-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span
                    className="inline-block w-4 h-4 rounded-full"
                    style={{ backgroundColor: formColor }}
                  />
                  <span className="font-mono text-xs">{formColor}</span>
                </div>
              </div>
            </div>

            {/* Set sebagai Default */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="space-y-0.5">
                <Label
                  htmlFor="form-is-default"
                  className="text-sm font-medium cursor-pointer"
                >
                  Set sebagai Default
                </Label>
                <p className="text-xs text-muted-foreground">
                  Status ini otomatis dipilih untuk lead baru
                </p>
              </div>
              <Switch
                id="form-is-default"
                checked={formIsDefault}
                onCheckedChange={setFormIsDefault}
              />
            </div>

            {/* Status Final */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="space-y-0.5">
                <Label
                  htmlFor="form-is-final"
                  className="text-sm font-medium cursor-pointer"
                >
                  Status Final
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tandai sebagai akhir pipeline (contoh: Lost, Converted)
                </p>
              </div>
              <Switch
                id="form-is-final"
                checked={formIsFinal}
                onCheckedChange={setFormIsFinal}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setFormOpen(false)}
                className="flex-1 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formName.trim()}
                className="flex-1 cursor-pointer"
              >
                {editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Status</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus status{" "}
              <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
