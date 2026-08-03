"use client";

import { useState, useEffect, useRef } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SimpleEditor } from "@/components/ui/simple-editor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box, UsersGroupRounded, Settings, PenNewSquare, AddCircle, TrashBinTrash, AlignVerticalSpacing } from "@solar-icons/react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreatePackage, useUpdatePackage, useSaveVendorItems, useSaveInternalItems } from "@/hooks/use-packages";
import { useVenues } from "@/hooks/use-venues";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { PackageQueryItem } from "@/lib/queries/packages";
import { SignaturePad } from "@/components/shared/signature-pad";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultVendorItems = (): VendorItemState[] => [];

interface VendorItemState {
  id: string;
  categoryId: string | null;
  categoryName: string;
  itemText: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawerPackageProps {
  isOpen: boolean;
  onClose: () => void;
  editingPackage?: PackageQueryItem | null;
}

const stepperSteps = [
  { id: 1, title: "Detail Paket", subtitle: "Informasi dasar & pax", icon: Box },
  { id: 2, title: "Item Vendor", subtitle: "Item vendor per kategori", icon: UsersGroupRounded },
  { id: 3, title: "Item Internal", subtitle: "Atur item internal", icon: Settings },
  { id: 4, title: "Tanda Tangan", subtitle: "Konfirmasi & tanda tangan", icon: PenNewSquare },
];

// ─── Sortable Item Row ────────────────────────────────────────────────────────

function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2", isDragging && "opacity-50 shadow-lg")}
    >
      <div className={cn("flex items-center gap-2")}>
        <button type="button" {...attributes} {...listeners} className={cn("p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none")} tabIndex={-1}>
          <AlignVerticalSpacing weight="BoldDuotone" className="h-4 w-4" />
        </button>
        <div className={cn("flex-1 space-y-2")}>{children}</div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DrawerPackage({ isOpen, onClose, editingPackage }: DrawerPackageProps) {
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const saveVendorItemsMut = useSaveVendorItems();
  const saveInternalItemsMut = useSaveInternalItems();
  const { data: venues = [] } = useVenues();
  const { data: categories = [] } = useCategories();
  const createCategoryMut = useCreateCategory();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Package details
  const [packageName, setPackageName] = useState("");
  const [available, setAvailable] = useState(true);
  const [venueId, setVenueId] = useState("");
  const [notes, setNotes] = useState("");
  const [pax, setPax] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2: Vendor items
  const [vendorItems, setVendorItems] = useState<VendorItemState[]>([]);

  // Step 3: Internal items
  const [internalItems, setInternalItems] = useState<{ id: string; itemName: string; itemDescription: string }[]>([]);

  // Step 4: Signature
  const [signature, setSignature] = useState<string | null>(null);

  const isEdit = !!editingPackage;

  // Load data when editing
  useEffect(() => {
    if (isOpen && editingPackage) {
      setPackageName(editingPackage.packageName);
      setAvailable(editingPackage.available);
      setVenueId(editingPackage.venueId ?? "");
      setNotes(editingPackage.notes ?? "");
      setPax(editingPackage.pax ?? 0);
      setVendorItems(
        (editingPackage.vendorItems ?? []).length > 0
          ? (editingPackage.vendorItems ?? []).map((item) => ({ id: item.id, categoryId: item.categoryId ?? null, categoryName: item.categoryName, itemText: item.itemText }))
          : defaultVendorItems()
      );
      setInternalItems(
        (editingPackage.internalItems ?? []).map((item) => ({ id: item.id, itemName: item.itemName, itemDescription: item.itemDescription }))
      );
      setCurrentStep(1);
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, editingPackage]);

  // ─── LocalStorage draft (create mode only) ─────────────────────────────────
  const DRAFT_KEY = "package-draft";
  const draftLoaded = useRef(false);

  useEffect(() => {
    if (!isOpen || isEdit || draftLoaded.current) return;
    draftLoaded.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.packageName) setPackageName(d.packageName);
      if (d.available !== undefined) setAvailable(d.available);
      if (d.venueId) setVenueId(d.venueId);
      if (d.notes) setNotes(d.notes);
      if (typeof d.pax === "number") setPax(d.pax);
      if (d.vendorItems?.length) {
        setVendorItems(
          d.vendorItems.map((it: Partial<VendorItemState> & { id: string }) => ({
            id: it.id,
            categoryId: it.categoryId ?? null,
            categoryName: it.categoryName ?? "",
            itemText: it.itemText ?? "",
          })),
        );
      }
      if (d.internalItems?.length) setInternalItems(d.internalItems);
      if (d.currentStep) setCurrentStep(d.currentStep);
    } catch { /* ignore corrupt data */ }
  }, [isOpen, isEdit]);

  useEffect(() => {
    if (!isOpen) draftLoaded.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isEdit) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ packageName, available, venueId, notes, pax, vendorItems, internalItems, currentStep }));
      } catch { /* storage full */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [isOpen, isEdit, packageName, available, venueId, notes, pax, vendorItems, internalItems, currentStep]);

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  function resetForm() {
    setPackageName("");
    setAvailable(true);
    setVenueId("");
    setNotes("");
    setPax(0);
    setVendorItems([]);
    setInternalItems([]);
    setCurrentStep(1);
    setErrors({});
    setSignature(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validateStep1(): string | null {
    const newErrors: Record<string, string> = {};
    if (!packageName.trim()) newErrors.packageName = "Nama paket wajib diisi";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return Object.values(newErrors)[0];
    return null;
  }

  const isStep1Invalid = !packageName.trim();
  const isNextDisabled = submitting || (currentStep === 1 && isStep1Invalid);

  function handleNext() {
    if (currentStep === 1) {
      const err = validateStep1();
      if (err) { toast.error(err); return; }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  }

  function handlePrevious() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  // ─── DnD ─────────────────────────────────────────────────────────────────────

  const itemSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleVendorItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setVendorItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function handleInternalItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setInternalItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  // ─── Final Submit ───────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!signature) { toast.error("Tanda tangan wajib diisi"); return; }
    try {
      setSubmitting(true);
      let pkgId: string;

      if (isEdit) {
        const res = await updatePkg.mutateAsync({
          id: editingPackage!.id,
          data: { packageName, available, venueId: venueId || null, notes: notes || null, pax, signature },
        });
        if (!res.success) { toast.error(res.error ?? "Gagal update"); return; }
        pkgId = editingPackage!.id;
      } else {
        const res = await createPkg.mutateAsync({ packageName, available, venueId: venueId || null, notes: notes || null, pax, signature });
        if (!res.success) { toast.error(res.error ?? "Gagal membuat paket"); return; }
        pkgId = res.data!.id;
      }

      // Save vendor items
      const viItems = vendorItems
        .filter((item) => item.categoryName.trim() && item.itemText.trim())
        .map(({ categoryId, categoryName, itemText }) => ({ categoryId, categoryName, itemText }));
      if (viItems.length > 0) {
        await saveVendorItemsMut.mutateAsync({ packageId: pkgId, items: viItems });
      }

      // Save internal items
      if (internalItems.length > 0) {
        await saveInternalItemsMut.mutateAsync({
          packageId: pkgId,
          items: internalItems.map(({ itemName, itemDescription }) => ({ itemName, itemDescription })),
        });
      }

      toast.success(isEdit ? "Paket berhasil diupdate!" : "Paket berhasil dibuat!");
      clearDraft();
      handleClose();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Item helpers ──────────────────────────────────────────────────────────

  function addVendorItem() {
    setVendorItems((prev) => [...prev, { id: `temp-${Date.now()}`, categoryId: null, categoryName: "", itemText: "" }]);
  }

  function setVendorItemCategory(itemId: string, categoryId: string, categoryName: string) {
    setVendorItems((prev) => prev.map((item) => item.id === itemId ? { ...item, categoryId, categoryName } : item));
  }

  function updateVendorItemText(itemId: string, value: string) {
    setVendorItems((prev) => prev.map((item) => item.id === itemId ? { ...item, itemText: value } : item));
  }

  function removeVendorItem(itemId: string) {
    setVendorItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  function addInternalItem() {
    setInternalItems((prev) => [...prev, { id: `temp-${Date.now()}`, itemName: "", itemDescription: "" }]);
  }

  function updateInternalItem(itemId: string, field: "itemName" | "itemDescription", value: string) {
    setInternalItems((prev) => prev.map((item) => item.id === itemId ? { ...item, [field]: value } : item));
  }

  function removeInternalItem(itemId: string) {
    setInternalItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={isEdit ? "Edit Package" : "Create Package"} maxWidth="sm:max-w-[630px]">
      <div className={cn("flex flex-col h-full")}>
        {/* Stepper */}
        <Stepper currentStep={currentStep} steps={stepperSteps} />

        {/* Content */}
        <div className={cn("flex-1 overflow-y-auto px-1")}>
          {/* ─── Step 1: Details ─── */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className={cn("text-sm font-medium text-gray-700")}>Nama Paket *</Label>
                <Input
                  className={cn("mt-1 border-[#CCCCCC] bg-[#F9F9F9]", errors.packageName && "border-red-500")}
                  value={packageName}
                  onChange={(e) => { setPackageName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.packageName; return n; }); }}
                  placeholder="Masukkan nama paket"
                />
                {errors.packageName && <p className={cn("mt-1 text-xs text-destructive")}>{errors.packageName}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={cn("text-sm font-medium text-gray-700")}>PAX</Label>
                  <Input
                    type="number"
                    className={cn("mt-1 border-[#CCCCCC] bg-[#F9F9F9]")}
                    value={pax || ""}
                    onChange={(e) => setPax(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <Label className={cn("text-sm font-medium text-gray-700 mb-2")}>Ketersediaan</Label>
                  <div className={cn("flex items-center space-x-3")}>
                    <Switch checked={available} onCheckedChange={setAvailable} />
                    <span className={cn("text-sm text-gray-600")}>{available ? "Tersedia" : "Tidak Tersedia"}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label className={cn("text-sm font-medium text-gray-700")}>Venue</Label>
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger className={cn("mt-1 w-full border-[#CCCCCC] bg-[#F9F9F9]")}>
                    <SelectValue placeholder="Pilih venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className={cn("text-sm font-medium text-gray-700")}>Catatan (opsional)</Label>
                <Textarea
                  className={cn("mt-1 min-h-20 border-[#CCCCCC] bg-[#F9F9F9]")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan tentang paket"
                />
              </div>
            </div>
          )}

          {/* ─── Step 2: Vendor Items ─── */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className={cn("text-lg font-medium")}>Item Vendor</h3>
                <p className={cn("text-sm text-gray-600")}>Tambahkan item vendor per kategori.</p>
              </div>

              <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleVendorItemDragEnd}>
                <SortableContext items={vendorItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {vendorItems.map((item) => (
                      <SortableItemRow key={item.id} id={item.id}>
                        <div className={cn("flex items-center justify-between gap-2")}>
                          <SearchableSelect
                            options={categories.map((c) => ({ id: c.id, name: c.name }))}
                            value={item.categoryId ?? ""}
                            onChange={(val) => {
                              const cat = categories.find((c) => c.id === val);
                              if (cat) setVendorItemCategory(item.id, cat.id, cat.name);
                            }}
                            placeholder="Pilih kategori..."
                            searchPlaceholder="Cari kategori..."
                            emptyText="Kategori tidak ditemukan"
                            className="flex-1"
                            onAdd={async (name) => {
                              const res = await createCategoryMut.mutateAsync(name);
                              if (!res.success) { toast.error(res.error ?? "Gagal menambahkan"); return; }
                              setVendorItemCategory(item.id, res.category.id, res.category.name);
                              toast.success(`Kategori "${res.category.name}" ditambahkan`);
                            }}
                          />
                          <Button variant="outline" size="sm" onClick={() => removeVendorItem(item.id)} className={cn("h-8 w-8 p-0 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10")}>
                            <TrashBinTrash weight="BoldDuotone" className={cn("h-4 w-4")} />
                          </Button>
                        </div>
                        <SimpleEditor
                          value={item.itemText}
                          onChange={(html) => updateVendorItemText(item.id, html)}
                          placeholder="Deskripsi item vendor..."
                        />
                      </SortableItemRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button
                variant="outline"
                onClick={addVendorItem}
                className={cn("w-full border-dashed border-gray-300 text-gray-600 hover:bg-gray-50")}
              >
                <AddCircle weight="BoldDuotone" className={cn("h-4 w-4 mr-2")} />Tambah Item
              </Button>
            </div>
          )}

          {/* ─── Step 3: Internal Items ─── */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className={cn("text-lg font-medium")}>Item Internal</h3>
                <p className={cn("text-sm text-gray-600")}>Tambahkan item internal paket.</p>
              </div>

              <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleInternalItemDragEnd}>
                <SortableContext items={internalItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {internalItems.map((item) => (
                      <SortableItemRow key={item.id} id={item.id}>
                        <div className={cn("flex items-center justify-between gap-2")}>
                          <Input
                            value={item.itemName}
                            onChange={(e) => updateInternalItem(item.id, "itemName", e.target.value)}
                            placeholder="Nama item"
                            className={cn("text-sm font-medium border-gray-300")}
                          />
                          <Button variant="outline" size="sm" onClick={() => removeInternalItem(item.id)} className={cn("h-8 w-8 p-0 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10")}>
                            <TrashBinTrash weight="BoldDuotone" className={cn("h-4 w-4")} />
                          </Button>
                        </div>
                        <SimpleEditor
                          value={item.itemDescription}
                          onChange={(html) => updateInternalItem(item.id, "itemDescription", html)}
                          placeholder="Deskripsi item..."
                        />
                      </SortableItemRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button
                variant="outline"
                onClick={addInternalItem}
                className={cn("w-full border-dashed border-gray-300 text-gray-600 hover:bg-gray-50")}
              >
                <AddCircle weight="BoldDuotone" className={cn("h-4 w-4 mr-2")} />Tambah Item
              </Button>
            </div>
          )}

          {/* ─── Step 4: Signature ─── */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className={cn("text-lg font-medium")}>Tanda Tangan</h3>
                <p className={cn("text-sm text-gray-600")}>
                  {isEdit
                    ? "Konfirmasi perubahan paket. Data yang diubah akan dikirim ulang ke Manager dan Finance untuk disetujui."
                    : "Konfirmasi pembuatan paket. Setelah dibuat, data akan dikirim ke Manager dan Finance untuk disetujui."}
                </p>
              </div>
              <div className={cn("border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-1")}>
                <p className={cn("text-sm font-medium")}>{packageName}</p>
                <p className={cn("text-xs text-muted-foreground")}>{pax} PAX · {venues.find((v) => v.id === venueId)?.name ?? "-"}</p>
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
              className={cn("flex-1 cursor-pointer", currentStep === 1 ? "text-destructive border-destructive hover:bg-destructive/10" : "border-border text-foreground hover:bg-accent")}
              disabled={submitting}
            >
              {currentStep === 1 ? "Batal" : "Sebelumnya"}
            </Button>
            <Button
              onClick={currentStep === 4 ? handleSubmit : handleNext}
              className={cn("flex-1 cursor-pointer")}
              disabled={isNextDisabled || (currentStep === 4 && !signature)}
            >
              {submitting ? "Menyimpan..." : currentStep < 4 ? "Selanjutnya" : (isEdit ? "Simpan Perubahan" : "Buat Paket")}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
