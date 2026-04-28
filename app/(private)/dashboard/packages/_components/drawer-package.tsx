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
import { Package, Users, Settings, PenLine, Plus, Trash2, ChevronDown, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreatePackage, useUpdatePackage, useCreateVariant, useUpdateVariant, useDeleteVariant, useSaveVendorItems, useSaveInternalItems } from "@/hooks/use-packages";
import { useVenues } from "@/hooks/use-venues";
import type { PackageQueryItem } from "@/lib/queries/packages";
import { SignaturePad } from "@/components/shared/signature-pad";

// ─── Helpers ──────────────────────────────────────────────────────────────────



const DEFAULT_VENDOR_CATEGORIES = ["Catering", "Dekorasi", "Rias & Busana", "Photography", "Entertainment", "MC"];
const defaultVendorItems = () => DEFAULT_VENDOR_CATEGORIES.map((cat, i) => ({ id: `default-${i}-${Date.now()}`, categoryName: cat, itemText: "" }));

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalVariant {
  id?: string;
  variantName: string;
  pax: number;
  available: boolean;
}

interface VendorItemsByVariant {
  [variantIdx: number]: { id: string; categoryName: string; itemText: string }[];
}

interface InternalItemsByVariant {
  [variantIdx: number]: { id: string; itemName: string; itemDescription: string }[];
}

interface DrawerPackageProps {
  isOpen: boolean;
  onClose: () => void;
  editingPackage?: PackageQueryItem | null;
}

const stepperSteps = [
  { id: 1, title: "Detail Paket", subtitle: "Informasi dasar & varian", icon: Package },
  { id: 2, title: "Item Vendor", subtitle: "Item vendor per kategori", icon: Users },
  { id: 3, title: "Item Internal", subtitle: "Atur item internal", icon: Settings },
  { id: 4, title: "Tanda Tangan", subtitle: "Konfirmasi & tanda tangan", icon: PenLine },
];

// ─── Component ────────────────────────────────────────────────────────────────

function SortableVariantRow({ id, onToggle, isOpen, label, pax, children }: {
  id: number;
  onToggle: () => void;
  isOpen: boolean;
  label: string;
  pax: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border border-gray-200 rounded-lg bg-gray-50 ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <div className={cn('flex', 'items-center')}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn('pl-3', 'pr-1', 'py-3', 'text-gray-400', 'hover:text-gray-600', 'cursor-grab', 'active:cursor-grabbing')}
          tabIndex={-1}
        >
          <GripVertical className={cn('h-4', 'w-4')} />
        </button>
        <button
          type="button"
          className={cn('flex-1', 'px-2', 'py-3', 'hover:bg-gray-100', 'rounded-r-lg', 'flex', 'items-center', 'justify-between', 'cursor-pointer')}
          onClick={onToggle}
        >
          <div className="text-left">
            <h4 className={cn('font-medium', 'text-gray-900', 'text-sm')}>{label}</h4>
            <p className={cn('text-xs', 'text-gray-500')}>{pax || 0} PAX</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform mr-2", isOpen && "rotate-180")} />
        </button>
      </div>
      {children}
    </div>
  );
}

function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('border', 'border-gray-200', 'rounded-lg', 'p-3', 'bg-gray-50', 'space-y-2', isDragging && 'opacity-50 shadow-lg')}
    >
      <div className={cn('flex', 'items-center', 'gap-2')}>
        <button type="button" {...attributes} {...listeners} className={cn('text-gray-400', 'hover:text-gray-600', 'cursor-grab', 'active:cursor-grabbing', 'shrink-0')} tabIndex={-1}>
          <GripVertical className={cn('h-4', 'w-4')} />
        </button>
        <div className={cn('flex-1', 'space-y-2')}>{children}</div>
      </div>
    </div>
  );
}

export function DrawerPackage({ isOpen, onClose, editingPackage }: DrawerPackageProps) {
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const createVariantMut = useCreateVariant();
  const updateVariantMut = useUpdateVariant();
  const deleteVariantMut = useDeleteVariant();
  const saveVendorItemsMut = useSaveVendorItems();
  const saveInternalItemsMut = useSaveInternalItems();
  const { data: venues = [] } = useVenues();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Package details
  const [packageName, setPackageName] = useState("");
  const [available, setAvailable] = useState(true);
  const [venueId, setVenueId] = useState("");
  const [notes, setNotes] = useState("");
  const [variants, setVariants] = useState<LocalVariant[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Collapsible state
  const [openVariants, setOpenVariants] = useState<Set<number>>(new Set());

  // Step 2: Vendor items per variant per category
  const [vendorItems, setVendorItems] = useState<VendorItemsByVariant>({});

  // Step 3: Internal items per variant
  const [internalItems, setInternalItems] = useState<InternalItemsByVariant>({});

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
      setVariants(
        (editingPackage.variants ?? []).map((v) => ({
          id: v.id,
          variantName: v.variantName,
          pax: v.pax,
          available: v.available,
        }))
      );
      // Load vendor items — flat array per variant
      const vi: VendorItemsByVariant = {};
      (editingPackage.variants ?? []).forEach((v, idx) => {
        vi[idx] = (v.vendorItems ?? []).length > 0
          ? (v.vendorItems ?? []).map((item) => ({ id: item.id, categoryName: item.categoryName, itemText: item.itemText }))
          : defaultVendorItems();
      });
      setVendorItems(vi);
      // Load internal items
      const ii: InternalItemsByVariant = {};
      (editingPackage.variants ?? []).forEach((v, idx) => {
        ii[idx] = (v.internalItems ?? []).map((item) => ({
          id: item.id,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
        }));
      });
      setInternalItems(ii);
      setCurrentStep(1);
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, editingPackage]);

  // ─── LocalStorage draft (create mode only) ─────────────────────────────────
  const DRAFT_KEY = "package-draft";
  const draftLoaded = useRef(false);

  // Load draft when opening create mode
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
      if (d.variants?.length) setVariants(d.variants);
      if (d.vendorItems) setVendorItems(d.vendorItems);
      if (d.internalItems) setInternalItems(d.internalItems);
      if (d.currentStep) setCurrentStep(d.currentStep);
    } catch { /* ignore corrupt data */ }
  }, [isOpen, isEdit]);

  // Reset ref when drawer closes
  useEffect(() => {
    if (!isOpen) draftLoaded.current = false;
  }, [isOpen]);

  // Save draft on changes (create mode only, debounced)
  useEffect(() => {
    if (!isOpen || isEdit) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ packageName, available, venueId, notes, variants, vendorItems, internalItems, currentStep }));
      } catch { /* storage full */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [isOpen, isEdit, packageName, available, venueId, notes, variants, vendorItems, internalItems, currentStep]);

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  function resetForm() {
    setPackageName("");
    setAvailable(true);
    setVenueId("");
    setNotes("");
    setVariants([]);
    setVendorItems({});
    setInternalItems({});
    setCurrentStep(1);
    setErrors({});
    setOpenVariants(new Set());
    setSignature(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // ─── Variant management ─────────────────────────────────────────────────────

  function addVariant() {
    const newIdx = variants.length;
    setVariants((prev) => [...prev, { variantName: "", pax: 100, available: true }]);
    setVendorItems((prev) => ({ ...prev, [newIdx]: defaultVendorItems() }));
    setOpenVariants((prev) => new Set([...prev, newIdx]));
  }

  function updateVariantField(idx: number, field: keyof LocalVariant, value: string | number | boolean) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
    // Clear error
    setErrors((prev) => { const n = { ...prev }; delete n[`variant_${idx}_${field}`]; return n; });
  }

  function removeVariant(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
    setOpenVariants((prev) => { const n = new Set(prev); n.delete(idx); return n; });
  }

  function toggleVariant(idx: number) {
    setOpenVariants((prev) => {
      const n = new Set(prev);
      if (n.has(idx)) { n.delete(idx); } else { n.add(idx); }
      return n;
    });
  }

  const variantSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const itemSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleVendorItemDragEnd(variantIdx: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setVendorItems((prev) => {
      const items = prev[variantIdx] ?? [];
      const oldIdx = items.findIndex((i) => i.id === active.id);
      const newIdx = items.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return { ...prev, [variantIdx]: arrayMove(items, oldIdx, newIdx) };
    });
  }

  function handleInternalItemDragEnd(variantIdx: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setInternalItems((prev) => {
      const items = prev[variantIdx] ?? [];
      const oldIdx = items.findIndex((i) => i.id === active.id);
      const newIdx = items.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return { ...prev, [variantIdx]: arrayMove(items, oldIdx, newIdx) };
    });
  }

  function handleVariantDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = Number(active.id);
    const newIdx = Number(over.id);
    setVariants((prev) => arrayMove(prev, oldIdx, newIdx));
    // update openVariants indices
    setOpenVariants((prev) => {
      const arr = Array.from(prev);
      const mapped = arr.map((i) => {
        if (i === oldIdx) return newIdx;
        if (oldIdx < newIdx && i > oldIdx && i <= newIdx) return i - 1;
        if (oldIdx > newIdx && i < oldIdx && i >= newIdx) return i + 1;
        return i;
      });
      return new Set(mapped);
    });
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validateStep1(): string | null {
    const newErrors: Record<string, string> = {};
    if (!packageName.trim()) newErrors.packageName = "Nama paket wajib diisi";
    if (variants.length === 0) newErrors.variants = "Minimal satu varian diperlukan";
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.variantName.trim()) newErrors[`variant_${i}_variantName`] = "Nama varian wajib diisi";
      if (!v.pax || v.pax <= 0) newErrors[`variant_${i}_pax`] = "PAX harus > 0";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const first = Object.values(newErrors)[0];
      return first;
    }
    return null;
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const isStep1Invalid = !packageName.trim() || variants.length === 0 || variants.some((v) => !v.variantName.trim() || !v.pax || v.pax <= 0);
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

  // ─── Final Submit ───────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!signature) { toast.error("Tanda tangan wajib diisi"); return; }
    try {
      setSubmitting(true);
      let pkgId: string;

      if (isEdit) {
        const res = await updatePkg.mutateAsync({
          id: editingPackage!.id,
          data: { packageName, available, venueId: venueId || null, notes: notes || null, signature },
        });
        if (!res.success) { toast.error(res.error ?? "Gagal update"); return; }
        pkgId = editingPackage!.id;
      } else {
        const res = await createPkg.mutateAsync({ packageName, available, venueId: venueId || null, notes: notes || null, signature });
        if (!res.success) { toast.error(res.error ?? "Gagal membuat paket"); return; }
        pkgId = res.data!.id;
      }

      // Save variants
      const variantIds: string[] = [];
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        let variantId = v.id;
        if (variantId) {
          await updateVariantMut.mutateAsync({ id: variantId, data: { variantName: v.variantName, pax: v.pax, available: v.available } });
        } else {
          const vRes = await createVariantMut.mutateAsync({ packageId: pkgId, variantName: v.variantName, pax: v.pax, available: v.available });
          if (vRes.success && vRes.data) variantId = vRes.data.id;
        }
        if (variantId) {
          variantIds.push(variantId);
          // Save vendor items — flat array
          const viItems = (vendorItems[i] ?? [])
            .filter((item) => item.categoryName.trim() && item.itemText.trim())
            .map(({ categoryName, itemText }) => ({ categoryName, itemText }));
          if (viItems.length > 0) await saveVendorItemsMut.mutateAsync({ variantId, items: viItems });
          // Save internal items for this variant
          const ii = internalItems[i] ?? [];
          if (ii.length > 0) await saveInternalItemsMut.mutateAsync({ variantId, items: ii.map((item) => ({ itemName: item.itemName, itemDescription: item.itemDescription })) });
        }
      }

      // Delete removed variants
      if (isEdit && editingPackage?.variants) {
        const currentIds = new Set(variants.filter((v) => v.id).map((v) => v.id));
        for (const orig of editingPackage.variants) {
          if (!currentIds.has(orig.id)) await deleteVariantMut.mutateAsync(orig.id);
        }
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

  // ─── Internal item helpers ──────────────────────────────────────────────────

  function addInternalItem(variantIdx: number) {
    setInternalItems((prev) => ({
      ...prev,
      [variantIdx]: [...(prev[variantIdx] ?? []), { id: `temp-${Date.now()}`, itemName: "", itemDescription: "" }],
    }));
  }

  function updateInternalItem(variantIdx: number, itemId: string, field: "itemName" | "itemDescription", value: string) {
    setInternalItems((prev) => ({
      ...prev,
      [variantIdx]: (prev[variantIdx] ?? []).map((item) => item.id === itemId ? { ...item, [field]: value } : item),
    }));
  }

  function removeInternalItem(variantIdx: number, itemId: string) {
    setInternalItems((prev) => ({
      ...prev,
      [variantIdx]: (prev[variantIdx] ?? []).filter((item) => item.id !== itemId),
    }));
  }

  function addVendorItem(variantIdx: number) {
    setVendorItems((prev) => ({
      ...prev,
      [variantIdx]: [...(prev[variantIdx] ?? []), { id: `temp-${Date.now()}`, categoryName: "", itemText: "" }],
    }));
  }

  function updateVendorItem(variantIdx: number, itemId: string, field: "categoryName" | "itemText", value: string) {
    setVendorItems((prev) => ({
      ...prev,
      [variantIdx]: (prev[variantIdx] ?? []).map((item) => item.id === itemId ? { ...item, [field]: value } : item),
    }));
  }

  function removeVendorItem(variantIdx: number, itemId: string) {
    setVendorItems((prev) => ({
      ...prev,
      [variantIdx]: (prev[variantIdx] ?? []).filter((item) => item.id !== itemId),
    }));
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={isEdit ? "Edit Package" : "Create Package"} maxWidth="sm:max-w-[630px]">
      <div className={cn('flex', 'flex-col', 'h-full')}>
        {/* Stepper */}
        <Stepper currentStep={currentStep} steps={stepperSteps} />

        {/* Content */}
        <div className={cn('flex-1', 'overflow-y-auto', 'px-1')}>
          {/* ─── Step 1: Details + Variants ─── */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className={cn('text-sm', 'font-medium', 'text-gray-700')}>Nama Paket *</Label>
                <Input
                  className={cn("mt-1 border-[#CCCCCC] bg-[#F9F9F9]", errors.packageName && "border-red-500")}
                  value={packageName}
                  onChange={(e) => { setPackageName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.packageName; return n; }); }}
                  placeholder="Masukkan nama paket"
                />
                {errors.packageName && <p className={cn('mt-1', 'text-xs', 'text-red-500')}>{errors.packageName}</p>}
              </div>

              <div>
                <Label className={cn('text-sm', 'font-medium', 'text-gray-700')}>Ketersediaan</Label>
                <div className={cn('flex', 'items-center', 'space-x-3', 'mt-2')}>
                  <Switch checked={available} onCheckedChange={setAvailable} />
                  <span className={cn('text-sm', 'text-gray-600')}>{available ? "Tersedia" : "Tidak Tersedia"}</span>
                </div>
              </div>

              <div>
                <Label className={cn('text-sm', 'font-medium', 'text-gray-700')}>Venue *</Label>
                <Select value={venueId} onValueChange={(v) => { setVenueId(v); setErrors((p) => { const n = { ...p }; delete n.venueId; return n; }); }}>
                  <SelectTrigger className={cn("mt-1 w-full border-[#CCCCCC] bg-[#F9F9F9]", (errors as Record<string, string>).venueId && "border-red-500")}>
                    <SelectValue placeholder="Pilih venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(errors as Record<string, string>).venueId && <p className={cn('mt-1', 'text-xs', 'text-red-500')}>{(errors as Record<string, string>).venueId}</p>}
              </div>

              <div>
                <Label className={cn('text-sm', 'font-medium', 'text-gray-700')}>Catatan (opsional)</Label>
                <Textarea
                  className={cn('mt-1', 'min-h-20', 'border-[#CCCCCC]', 'bg-[#F9F9F9]')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan tentang paket"
                />
              </div>

              {/* Variants section */}
              <div>
                <div className={cn('flex', 'items-center', 'justify-between', 'mb-2')}>
                  <Label className={cn('text-sm', 'font-medium', 'text-gray-700')}>Varian Paket *</Label>
                  <Button type="button" size="sm" onClick={addVariant} className={cn('h-8', 'px-3', 'text-xs', 'bg-black', 'text-white', 'hover:bg-gray-800')}>
                    <Plus className={cn('h-3', 'w-3', 'mr-1')} />Tambah Varian
                  </Button>
                </div>

                {variants.length === 0 ? (
                  <div className={cn('text-center', 'py-8', 'text-gray-500', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-lg')}>
                    <Package className={cn('h-8', 'w-8', 'mx-auto', 'mb-2', 'text-gray-400')} />
                    <p className="text-sm">Belum ada varian</p>
                    <p className={cn('text-xs', 'text-gray-400')}>Klik &quot;Tambah Varian&quot; untuk mulai</p>
                  </div>
                ) : (
                  <DndContext sensors={variantSensors} collisionDetection={closestCenter} onDragEnd={handleVariantDragEnd}>
                    <SortableContext items={variants.map((_, i) => i)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
                        {variants.map((variant, idx) => (
                          <SortableVariantRow key={idx} id={idx} onToggle={() => toggleVariant(idx)} isOpen={openVariants.has(idx)} label={variant.variantName || `Varian ${idx + 1}`} pax={variant.pax}>
                            {openVariants.has(idx) && (
                              <div className={cn('px-4', 'pb-4')}>
                                <div className={cn('grid', 'grid-cols-2', 'gap-3', 'mb-3')}>
                                  <div>
                                    <Label className={cn('text-xs', 'font-medium', 'text-gray-600')}>Nama Varian *</Label>
                                    <Input
                                      placeholder={["GOLD", "SAPPHIRE", "PLATINUM"][idx % 3]}
                                      value={variant.variantName}
                                      onChange={(e) => updateVariantField(idx, "variantName", e.target.value)}
                                      className={cn("mt-1 text-sm", errors[`variant_${idx}_variantName`] && "border-red-500")}
                                    />
                                    {errors[`variant_${idx}_variantName`] && <p className={cn('mt-1', 'text-xs', 'text-red-500')}>{errors[`variant_${idx}_variantName`]}</p>}
                                  </div>
                                  <div>
                                    <Label className={cn('text-xs', 'font-medium', 'text-gray-600')}>PAX *</Label>
                                    <Input
                                      type="number"
                                      placeholder="100"
                                      value={variant.pax || ""}
                                      onChange={(e) => updateVariantField(idx, "pax", parseInt(e.target.value) || 0)}
                                      className={cn("mt-1 text-sm", errors[`variant_${idx}_pax`] && "border-red-500")}
                                      min={1}
                                    />
                                    {errors[`variant_${idx}_pax`] && <p className={cn('mt-1', 'text-xs', 'text-red-500')}>{errors[`variant_${idx}_pax`]}</p>}
                                  </div>
                                </div>
                                <div className={cn('grid', 'grid-cols-2', 'gap-3')}>
                                  <div className={cn('flex', 'items-end', 'pb-1', 'justify-between')}>
                                <div className={cn('flex', 'items-center', 'space-x-2')}>
                                  <Switch checked={variant.available} onCheckedChange={(checked) => updateVariantField(idx, "available", checked)} />
                                  <Label className={cn('text-xs', 'text-gray-600')}>Tersedia</Label>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => removeVariant(idx)} className={cn('h-7', 'px-2', 'text-xs', 'text-red-600', 'hover:text-red-700', 'hover:bg-red-50')}>
                                  <Trash2 className={cn('h-3', 'w-3', 'mr-1')} />Hapus
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                          </SortableVariantRow>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
                {errors.variants && <p className={cn('mt-2', 'text-sm', 'text-red-500')}>{errors.variants}</p>}
              </div>
            </div>
          )}

          {/* ─── Step 2: Vendor Items ─── */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className={cn('text-lg', 'font-medium')}>Item Vendor</h3>
                <p className={cn('text-sm', 'text-gray-600')}>Tambahkan item vendor per kategori untuk setiap varian.</p>
              </div>

              {variants.length === 0 ? (
                <div className={cn('text-center', 'py-8', 'text-gray-500', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-lg')}>
                  <Package className={cn('h-8', 'w-8', 'mx-auto', 'mb-2', 'text-gray-400')} />
                  <p className="text-sm">Belum ada varian. Tambahkan di Step 1.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {variants.map((variant, variantIdx) => (
                    <div key={variantIdx} className={cn('border', 'border-gray-200', 'rounded-lg')}>
                      <button
                        type="button"
                        className={cn('w-full', 'px-4', 'py-3', 'hover:bg-gray-50', 'flex', 'items-center', 'justify-between', 'cursor-pointer')}
                        onClick={() => toggleVariant(variantIdx)}
                      >
                        <div className="text-left">
                          <h4 className={cn('font-medium', 'text-gray-900', 'text-sm')}>{variant.variantName}</h4>
                          <p className={cn('text-xs', 'text-gray-500')}>{variant.pax} PAX</p>
                        </div>
                        <div className={cn('flex', 'items-center', 'gap-2')}>
                          <span className={cn('text-xs', 'text-gray-500')}>{(vendorItems[variantIdx] ?? []).length} items</span>
                          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", openVariants.has(variantIdx) && "rotate-180")} />
                        </div>
                      </button>

                      {openVariants.has(variantIdx) && (
                        <div className={cn('px-4', 'pb-4', 'space-y-3')}>
                          <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleVendorItemDragEnd(variantIdx, e)}>
                            <SortableContext items={(vendorItems[variantIdx] ?? []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-3">
                                {(vendorItems[variantIdx] ?? []).map((item) => (
                                  <SortableItemRow key={item.id} id={item.id}>
                                    <div className={cn('flex', 'items-center', 'justify-between', 'gap-2')}>
                                      <Input
                                        value={item.categoryName}
                                        onChange={(e) => updateVendorItem(variantIdx, item.id, "categoryName", e.target.value)}
                                        placeholder="Nama item"
                                        className={cn('text-sm', 'font-medium', 'border-gray-300')}
                                      />
                                      <Button variant="outline" size="sm" onClick={() => removeVendorItem(variantIdx, item.id)} className={cn('h-8', 'w-8', 'p-0', 'shrink-0', 'text-red-600', 'hover:text-red-700', 'hover:bg-red-50')}>
                                        <Trash2 className={cn('h-4', 'w-4')} />
                                      </Button>
                                    </div>
                                    <SimpleEditor
                                      value={item.itemText}
                                      onChange={(html) => updateVendorItem(variantIdx, item.id, "itemText", html)}
                                      placeholder="Deskripsi item vendor..."
                                    />
                                  </SortableItemRow>
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                          <Button
                            variant="outline"
                            onClick={() => addVendorItem(variantIdx)}
                            className={cn('w-full', 'border-dashed', 'border-gray-300', 'text-gray-600', 'hover:bg-gray-50')}
                          >
                            <Plus className={cn('h-4', 'w-4', 'mr-2')} />Tambah Item
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 3: Internal Items ─── */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className={cn('text-lg', 'font-medium')}>Item Internal</h3>
                <p className={cn('text-sm', 'text-gray-600')}>Tambahkan item internal untuk setiap varian.</p>
              </div>

              {variants.length === 0 ? (
                <div className={cn('text-center', 'py-8', 'text-gray-500', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-lg')}>
                  <Package className={cn('h-8', 'w-8', 'mx-auto', 'mb-2', 'text-gray-400')} />
                  <p className="text-sm">Belum ada varian.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {variants.map((variant, variantIdx) => (
                    <div key={variantIdx} className={cn('border', 'border-gray-200', 'rounded-lg')}>
                      <button
                        type="button"
                        className={cn('w-full', 'px-4', 'py-3', 'hover:bg-gray-50', 'flex', 'items-center', 'justify-between', 'cursor-pointer')}
                        onClick={() => toggleVariant(variantIdx)}
                      >
                        <div className="text-left">
                          <h4 className={cn('font-medium', 'text-gray-900', 'text-sm')}>{variant.variantName}</h4>
                          <p className={cn('text-xs', 'text-gray-500')}>{variant.pax} PAX</p>
                        </div>
                        <div className={cn('flex', 'items-center', 'gap-2')}>
                          <span className={cn('text-xs', 'text-gray-500')}>{(internalItems[variantIdx] ?? []).length} items</span>
                          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", openVariants.has(variantIdx) && "rotate-180")} />
                        </div>
                      </button>

                      {openVariants.has(variantIdx) && (
                        <div className={cn('px-4', 'pb-4', 'space-y-3')}>
                          <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleInternalItemDragEnd(variantIdx, e)}>
                            <SortableContext items={(internalItems[variantIdx] ?? []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-3">
                                {(internalItems[variantIdx] ?? []).map((item) => (
                                  <SortableItemRow key={item.id} id={item.id}>
                                    <div className={cn('flex', 'items-center', 'justify-between', 'gap-2')}>
                                      <Input
                                        value={item.itemName}
                                        onChange={(e) => updateInternalItem(variantIdx, item.id, "itemName", e.target.value)}
                                        placeholder="Nama item"
                                        className={cn('text-sm', 'font-medium', 'border-gray-300')}
                                      />
                                      <Button variant="outline" size="sm" onClick={() => removeInternalItem(variantIdx, item.id)} className={cn('h-8', 'w-8', 'p-0', 'shrink-0', 'text-red-600', 'hover:text-red-700', 'hover:bg-red-50')}>
                                        <Trash2 className={cn('h-4', 'w-4')} />
                                      </Button>
                                    </div>
                                    <SimpleEditor
                                      value={item.itemDescription}
                                      onChange={(html) => updateInternalItem(variantIdx, item.id, "itemDescription", html)}
                                      placeholder="Deskripsi item..."
                                    />
                                  </SortableItemRow>
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                          <Button
                            variant="outline"
                            onClick={() => addInternalItem(variantIdx)}
                            className={cn('w-full', 'border-dashed', 'border-gray-300', 'text-gray-600', 'hover:bg-gray-50')}
                          >
                            <Plus className={cn('h-4', 'w-4', 'mr-2')} />Tambah Item
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 4: Signature ─── */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className={cn('text-lg', 'font-medium')}>Tanda Tangan</h3>
                <p className={cn('text-sm', 'text-gray-600')}>
                  {isEdit
                    ? "Konfirmasi perubahan paket. Data yang diubah akan dikirim ulang ke Manager dan Finance untuk disetujui."
                    : "Konfirmasi pembuatan paket. Setelah dibuat, data akan dikirim ke Manager dan Finance untuk disetujui."}
                </p>
              </div>
              <div className={cn('border', 'border-gray-200', 'rounded-lg', 'p-4', 'bg-gray-50', 'space-y-1')}>
                <p className={cn('text-sm', 'font-medium')}>{packageName}</p>
                <p className={cn('text-xs', 'text-muted-foreground')}>{variants.length} varian · {venues.find((v) => v.id === venueId)?.name ?? "-"}</p>
              </div>
              <SignaturePad onSignature={setSignature} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn('sticky', 'bottom-0', 'bg-white', 'border-t', 'pt-4', 'mt-4')}>
          <div className={cn('flex', 'gap-2')}>
            <Button
              variant="outline"
              onClick={currentStep === 1 ? handleClose : handlePrevious}
              className={cn("flex-1 cursor-pointer", currentStep === 1 ? "text-red-600 border-red-600 hover:bg-red-50" : "border-black text-black hover:bg-gray-100")}
              disabled={submitting}
            >
              {currentStep === 1 ? "Batal" : "Sebelumnya"}
            </Button>
            <Button
              onClick={currentStep === 4 ? handleSubmit : handleNext}
              className={cn('flex-1', 'bg-black', 'text-white', 'hover:bg-gray-800', 'cursor-pointer')}
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
