"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box, ClipboardList, PenNewSquare, AddCircle, TrashBinTrash, AlignVerticalSpacing } from "@solar-icons/react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useVenues } from "@/hooks/use-venues";
import { SignaturePad } from "@/components/shared/signature-pad";
import { useCreatePackage, useUpdatePackage, useSaveMiceItems } from "@/hooks/use-packages";
import type { PackageQueryItem } from "@/lib/queries/packages";

// ─── Steps (MICE = 3 steps, no Item Internal, no T&C) ──────────────────────────

const stepperSteps = [
  { id: 1, title: "Detail Paket", subtitle: "Informasi dasar paket", icon: Box },
  { id: 2, title: "Item Paket", subtitle: "Daftar item paket", icon: ClipboardList },
  { id: 3, title: "Tanda Tangan", subtitle: "Konfirmasi & tanda tangan", icon: PenNewSquare },
];

// Local UI type — lowercase to match select values in the UI.
type MiceItemPriceTypeLocal = "pax" | "nominal";

interface MiceItemState {
  id: string;
  itemName: string;
  itemDescription: string;
  itemType: MiceItemPriceTypeLocal;
  itemPrice: number;
}

interface MicePackageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingPackage?: PackageQueryItem | null;
}

// ─── Sortable item row ─────────────────────────────────────────────────────────

function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("border border-border rounded-xl p-3 bg-muted/40 space-y-2", isDragging && "opacity-50 shadow-lg")}
    >
      <div className={cn("flex items-start gap-2")}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn("mt-1 p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none")}
          tabIndex={-1}
        >
          <AlignVerticalSpacing weight="BoldDuotone" className="h-4 w-4" />
        </button>
        <div className={cn("flex-1 space-y-2")}>{children}</div>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MicePackageDrawer({ isOpen, onClose, editingPackage }: MicePackageDrawerProps) {
  const { data: venues = [] } = useVenues();
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const saveMiceItemsMut = useSaveMiceItems();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — details
  const [packageName, setPackageName] = useState("");
  const [available, setAvailable] = useState(true);
  const [venueId, setVenueId] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2 — items
  const [items, setItems] = useState<MiceItemState[]>([]);

  // Step 3 — signature
  const [signature, setSignature] = useState<string | null>(null);

  const isEdit = !!editingPackage;

  function resetForm() {
    setPackageName("");
    setAvailable(true);
    setVenueId("");
    setNotes("");
    setItems([]);
    setSignature(null);
    setCurrentStep(1);
    setErrors({});
  }

  // Populate/reset form when the drawer opens. Syncing form state to incoming
  // props on open is a legitimate effect use, so the setState calls are expected.
  useEffect(() => {
    if (isOpen && editingPackage) {
      setPackageName(editingPackage.packageName);
      setAvailable(editingPackage.available);
      setVenueId(editingPackage.venueId ?? "");
      setNotes(editingPackage.notes ?? "");
      // Map DB uppercase itemType → local lowercase for the UI selector
      setItems(
        (editingPackage.miceItems ?? []).map((it) => ({
          id: it.id,
          itemName: it.itemName,
          itemDescription: it.itemDescription,
          itemType: it.itemType.toLowerCase() as MiceItemPriceTypeLocal,
          itemPrice: it.itemPrice,
        })),
      );
      setSignature(null);
      setCurrentStep(1);
      setErrors({});
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, editingPackage]); // resetForm is stable (defined inside component, no deps)

  function handleClose() {
    resetForm();
    onClose();
  }

  // ─── Validation & navigation ─────────────────────────────────────────────────

  const isStep1Invalid = !packageName.trim() || !venueId;
  const isStep2Invalid = items.length === 0 || items.some((it) => !it.itemName.trim());
  const isNextDisabled =
    submitting || (currentStep === 1 && isStep1Invalid) || (currentStep === 2 && isStep2Invalid);

  function handleNext() {
    if (currentStep === 1) {
      const nextErrors: Record<string, string> = {};
      if (!packageName.trim()) nextErrors.packageName = "Nama paket wajib diisi";
      if (!venueId) nextErrors.venueId = "Venue wajib dipilih";
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        toast.error("Lengkapi semua field yang wajib diisi");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (items.length === 0) {
        toast.error("Tambahkan minimal satu item paket");
        return;
      }
      if (items.some((it) => !it.itemName.trim())) {
        toast.error("Setiap item wajib punya nama");
        return;
      }
      setCurrentStep(3);
    }
  }

  function handlePrevious() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  // ─── DnD ──────────────────────────────────────────────────────────────────────

  const itemSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  // ─── Item helpers ─────────────────────────────────────────────────────────────

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `temp-${prev.length}-${Math.round(performance.now())}`,
        itemName: "",
        itemDescription: "",
        itemType: "pax",
        itemPrice: 0,
      },
    ]);
  }

  function updateItem(itemId: string, field: "itemName" | "itemDescription", value: string) {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
  }

  function updateItemType(itemId: string, itemType: MiceItemPriceTypeLocal) {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, itemType } : item)));
  }

  function updateItemPrice(itemId: string, itemPrice: number) {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, itemPrice } : item)));
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!signature) {
      toast.error("Tanda tangan wajib diisi");
      return;
    }
    try {
      setSubmitting(true);
      let pkgId: string;

      if (isEdit) {
        const res = await updatePkg.mutateAsync({
          id: editingPackage!.id,
          data: {
            packageName,
            available,
            venueId: venueId || null,
            notes: notes.trim() || null,
            signature,
          },
        });
        if (!res.success) {
          toast.error(res.error ?? "Gagal update paket");
          return;
        }
        pkgId = editingPackage!.id;
      } else {
        const res = await createPkg.mutateAsync({
          packageName,
          available,
          venueId: venueId || null,
          notes: notes.trim() || null,
          signature,
          category: "MICE",
        });
        if (!res.success) {
          toast.error(res.error ?? "Gagal membuat paket");
          return;
        }
        pkgId = res.data!.id;
      }

      // Save mice items — convert local lowercase itemType → DB uppercase
      const cleanItems = items
        .filter((it) => it.itemName.trim())
        .map((it) => ({
          itemName: it.itemName.trim(),
          itemDescription: it.itemDescription.trim(),
          itemType: it.itemType.toUpperCase(), // "pax" → "PAX", "nominal" → "NOMINAL"
          itemPrice: it.itemPrice,
        }));

      await saveMiceItemsMut.mutateAsync({ packageId: pkgId, items: cleanItems });

      toast.success(isEdit ? "Paket MICE berhasil diupdate!" : "Paket MICE berhasil dibuat!");
      handleClose();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={isEdit ? "Edit Paket MICE" : "Buat Paket MICE"} maxWidth="sm:max-w-[630px]">
      <div className={cn("flex flex-col h-full")}>
        <Stepper currentStep={currentStep} steps={stepperSteps} />

        <div className={cn("flex-1 overflow-y-auto px-1")}>
          {/* ─── Step 1: Detail Paket ─── */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className={cn("text-sm font-medium text-foreground")}>Nama Paket <span className={cn("text-destructive")}>*</span></Label>
                <Input
                  className={cn("mt-1", errors.packageName && "border-destructive")}
                  value={packageName}
                  onChange={(e) => {
                    setPackageName(e.target.value);
                    setErrors((p) => {
                      const n = { ...p };
                      delete n.packageName;
                      return n;
                    });
                  }}
                  placeholder="Masukkan nama paket"
                />
                {errors.packageName && <p className={cn("mt-1 text-xs text-destructive")}>{errors.packageName}</p>}
              </div>

              {/* Venue */}
              <div>
                <Label className={cn("text-sm font-medium text-foreground")}>Venue <span className={cn("text-destructive")}>*</span></Label>
                <Select
                  value={venueId}
                  onValueChange={(v) => {
                    setVenueId(v);
                    setErrors((p) => {
                      const n = { ...p };
                      delete n.venueId;
                      return n;
                    });
                  }}
                >
                  <SelectTrigger className={cn("mt-1 w-full", errors.venueId && "border-destructive")}>
                    <SelectValue placeholder="Pilih venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.venueId && <p className={cn("mt-1 text-xs text-destructive")}>{errors.venueId}</p>}
                <p className={cn("mt-1.5 text-xs text-muted-foreground")}>Harga paket diatur lewat tombol &quot;Set Harga&quot; di daftar paket.</p>
              </div>

              {/* Catatan (opsional) */}
              <div>
                <Label className={cn("text-sm font-medium text-foreground")}>Catatan (opsional)</Label>
                <Textarea
                  className={cn("mt-1 min-h-20")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan tentang paket"
                />
              </div>

              {/* Ketersediaan */}
              <div>
                <Label className={cn("text-sm font-medium text-foreground mb-2 block")}>Ketersediaan</Label>
                <div className={cn("flex items-center gap-3")}>
                  <Switch checked={available} onCheckedChange={setAvailable} />
                  <span className={cn("text-sm text-muted-foreground")}>{available ? "Tersedia" : "Tidak Tersedia"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Item Paket ─── */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className={cn("text-lg font-medium text-foreground")}>Item Paket <span className={cn("text-destructive")}>*</span></h3>
                <p className={cn("text-sm text-muted-foreground")}>Tambahkan minimal satu item paket beserta deskripsinya. Nama item wajib diisi.</p>
              </div>

              <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <SortableItemRow key={item.id} id={item.id}>
                        <div className={cn("flex items-center justify-between gap-2")}>
                          <Input
                            value={item.itemName}
                            onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                            placeholder="Nama item"
                            className={cn("text-sm font-medium")}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className={cn("h-8 w-8 p-0 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10")}
                          >
                            <TrashBinTrash weight="BoldDuotone" className={cn("h-4 w-4")} />
                          </Button>
                        </div>

                        {/* Tipe harga + nominal per item */}
                        <div className={cn("flex items-center gap-2")}>
                          <Select value={item.itemType} onValueChange={(v) => updateItemType(item.id, v as MiceItemPriceTypeLocal)}>
                            <SelectTrigger className={cn("h-9 w-32 shrink-0 text-sm")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pax">Pax</SelectItem>
                              <SelectItem value="nominal">Nominal</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className={cn("relative flex-1")}>
                            <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground")}>Rp</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={item.itemPrice ? item.itemPrice.toLocaleString("id-ID") : ""}
                              onChange={(e) => updateItemPrice(item.id, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
                              placeholder="0"
                              className={cn("h-9 pl-8 text-sm")}
                            />
                          </div>
                        </div>
                        {item.itemType === "pax" && (
                          <p className={cn("text-xs text-muted-foreground")}>Harga per pax — dikali jumlah pax saat membuat quotation.</p>
                        )}

                        <Textarea
                          value={item.itemDescription}
                          onChange={(e) => updateItem(item.id, "itemDescription", e.target.value)}
                          placeholder="Deskripsi item (opsional)"
                          className={cn("min-h-16 text-sm")}
                        />
                      </SortableItemRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {items.length === 0 && (
                <div className={cn("flex flex-col items-center justify-center py-8 text-muted-foreground")}>
                  <ClipboardList weight="BoldDuotone" className={cn("h-9 w-9 mb-2 opacity-40")} />
                  <p className="text-sm">Belum ada item. Tambahkan item pertama.</p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={addItem}
                className={cn("w-full border-dashed text-muted-foreground hover:bg-muted/50")}
              >
                <AddCircle weight="BoldDuotone" className={cn("h-4 w-4 mr-2")} />Tambah Item
              </Button>
            </div>
          )}

          {/* ─── Step 3: Tanda Tangan ─── */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className={cn("text-lg font-medium text-foreground")}>Tanda Tangan</h3>
                <p className={cn("text-sm text-muted-foreground")}>
                  Konfirmasi {isEdit ? "perubahan" : "pembuatan"} paket MICE dengan tanda tangan di bawah.
                </p>
              </div>
              <div className={cn("border border-border rounded-xl p-4 bg-muted/40 space-y-1")}>
                <p className={cn("text-sm font-medium text-foreground")}>{packageName || "—"}</p>
                <p className={cn("text-xs text-muted-foreground")}>
                  {venues.find((v) => v.id === venueId)?.name ?? "Venue —"} · {items.filter((i) => i.itemName.trim()).length} item
                </p>
                <p className={cn("text-xs text-muted-foreground")}>Harga paket diatur lewat tombol &quot;Set Harga&quot; di daftar paket.</p>
              </div>
              <SignaturePad onSignature={setSignature} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn("sticky bottom-0 bg-background border-t border-border pt-4 mt-4")}>
          <div className={cn("flex gap-2")}>
            <Button
              variant="outline"
              onClick={currentStep === 1 ? handleClose : handlePrevious}
              className={cn(
                "flex-1 cursor-pointer",
                currentStep === 1
                  ? "text-destructive border-destructive hover:bg-destructive/10"
                  : "border-border text-foreground hover:bg-accent",
              )}
              disabled={submitting}
            >
              {currentStep === 1 ? "Batal" : "Sebelumnya"}
            </Button>
            <Button
              onClick={currentStep === 3 ? handleSubmit : handleNext}
              className={cn("flex-1 cursor-pointer")}
              disabled={isNextDisabled || (currentStep === 3 && !signature) || submitting}
            >
              {submitting
                ? "Menyimpan..."
                : currentStep < 3
                ? "Selanjutnya"
                : isEdit
                ? "Simpan Perubahan"
                : "Buat Paket"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
