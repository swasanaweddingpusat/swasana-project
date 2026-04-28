"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SimpleEditor } from "@/components/ui/simple-editor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Package, Users, Settings, Plus, Trash2, ChevronDown } from "lucide-react";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreatePackage, useUpdatePackage, useCreateVariant, useUpdateVariant, useDeleteVariant, useSaveVendorItems, useSaveInternalItems } from "@/hooks/use-packages";
import { useVendorCategories } from "@/hooks/use-vendors";
import type { PackageQueryItem } from "@/lib/queries/packages";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (!value) return "";
  return value.toLocaleString("id-ID");
}

function parseCurrency(value: string): number {
  return parseInt(value.replace(/\D/g, "")) || 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalVariant {
  id?: string;
  variantName: string;
  pax: number;
  price: number;
  available: boolean;
}

interface VendorItemsByVariant {
  [variantIdx: number]: { [categoryName: string]: string };
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
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DrawerPackage({ isOpen, onClose, editingPackage }: DrawerPackageProps) {
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const createVariantMut = useCreateVariant();
  const updateVariantMut = useUpdateVariant();
  const deleteVariantMut = useDeleteVariant();
  const saveVendorItemsMut = useSaveVendorItems();
  const saveInternalItemsMut = useSaveInternalItems();
  const { data: vendorCategoriesData = [] } = useVendorCategories();
  const vendorCats = vendorCategoriesData.map((c) => ({ id: c.id, name: c.name }));

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

  const isEdit = !!editingPackage;

  // Load data when editing
  useEffect(() => {
    if (isOpen && editingPackage) {
      setPackageName(editingPackage.packageName);
      setAvailable(editingPackage.available);
      setVenueId(editingPackage.venueId ?? "");
      setNotes(editingPackage.notes ?? "");
      setVariants(
        (editingPackage.variants ?? []).map((v) => {
          // Extract price from category prices (take first entry or sum them)
          const categoryPrices = (v as any).package_variant_category_prices ?? [];
          const price = categoryPrices.length > 0 ? categoryPrices[0].basePrice : 0;
          return {
            id: v.id,
            variantName: v.variantName,
            pax: v.pax,
            price,
            available: v.available,
          };
        })
      );
      // Load vendor items (group by category)
      const vi: VendorItemsByVariant = {};
      (editingPackage.variants ?? []).forEach((v, idx) => {
        vi[idx] = {};
        (v.vendorItems ?? []).forEach((item) => {
          const cat = item.categoryName;
          vi[idx][cat] = vi[idx][cat]
            ? `${vi[idx][cat]}; ${item.itemText}`
            : item.itemText;
        });
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
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // ─── Variant management ─────────────────────────────────────────────────────

  function addVariant() {
    setVariants((prev) => [...prev, { variantName: "", pax: 100, price: 0, available: true }]);
    setOpenVariants((prev) => new Set([...prev, variants.length]));
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

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validateStep1(): string | null {
    const newErrors: Record<string, string> = {};
    if (!packageName.trim()) newErrors.packageName = "Nama paket wajib diisi";
    if (variants.length === 0) newErrors.variants = "Minimal satu varian diperlukan";
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.variantName.trim()) newErrors[`variant_${i}_variantName`] = "Nama varian wajib diisi";
      if (!v.pax || v.pax <= 0) newErrors[`variant_${i}_pax`] = "PAX harus > 0";
      if (!v.price || v.price <= 0) newErrors[`variant_${i}_price`] = "Harga harus > 0";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const first = Object.values(newErrors)[0];
      return first;
    }
    return null;
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function handleNext() {
    if (currentStep === 1) {
      const err = validateStep1();
      if (err) { toast.error(err); return; }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  }

  function handlePrevious() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  // ─── Final Submit ───────────────────────────────────────────────────────────

  async function handleSubmit() {
    try {
      setSubmitting(true);
      let pkgId: string;

      if (isEdit) {
        const res = await updatePkg.mutateAsync({
          id: editingPackage!.id,
          data: { packageName, available, venueId: venueId || null, notes: notes || null },
        });
        if (!res.success) { toast.error(res.error ?? "Gagal update"); return; }
        pkgId = editingPackage!.id;
      } else {
        const res = await createPkg.mutateAsync({ packageName, available, venueId: venueId || null, notes: notes || null });
        if (!res.success) { toast.error(res.error ?? "Gagal membuat paket"); return; }
        pkgId = res.data!.id;
      }

      // Save variants
      const variantIds: string[] = [];
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        let variantId = v.id;
        if (variantId) {
          await updateVariantMut.mutateAsync({ id: variantId, data: { variantName: v.variantName, pax: v.pax, price: v.price, available: v.available } });
        } else {
          const vRes = await createVariantMut.mutateAsync({ packageId: pkgId, variantName: v.variantName, pax: v.pax, price: v.price, available: v.available });
          if (vRes.success && vRes.data) variantId = vRes.data.id;
        }
        if (variantId) {
          variantIds.push(variantId);
          // Save vendor items for this variant (convert per-category map to array)
          const viMap = vendorItems[i] ?? {};
          const viItems = Object.entries(viMap)
            .filter(([, html]) => html.replace(/<[^>]*>/g, "").trim().length > 0)
            .map(([categoryName, itemText]) => ({ categoryName, itemText }));
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
                  <div className="space-y-3">
                    {variants.map((variant, idx) => (
                      <div key={idx} className={cn('border', 'border-gray-200', 'rounded-lg', 'bg-gray-50')}>
                        <button
                          type="button"
                          className={cn('w-full', 'px-4', 'py-3', 'hover:bg-gray-100', 'rounded-lg', 'flex', 'items-center', 'justify-between', 'cursor-pointer')}
                          onClick={() => toggleVariant(idx)}
                        >
                          <div className="text-left">
                            <h4 className={cn('font-medium', 'text-gray-900', 'text-sm')}>{variant.variantName || `Varian ${idx + 1}`}</h4>
                            <p className={cn('text-xs', 'text-gray-500')}>{variant.pax || 0} PAX {variant.price ? `• Rp. ${formatCurrency(variant.price)}` : ""}</p>
                          </div>
                          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", openVariants.has(idx) && "rotate-180")} />
                        </button>

                        {openVariants.has(idx) && (
                          <div className={cn('px-4', 'pb-4')}>
                            <div className={cn('grid', 'grid-cols-2', 'gap-3', 'mb-3')}>
                              <div>
                                <Label className={cn('text-xs', 'font-medium', 'text-gray-600')}>Nama Varian *</Label>
                                <Input
                                  placeholder="e.g., Paket 100 Pax"
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
                              <div>
                                <Label className={cn('text-xs', 'font-medium', 'text-gray-600')}>Harga (Rp) *</Label>
                                <div className={cn('relative', 'mt-1')}>
                                  <span className={cn('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'text-sm', 'text-gray-500')}>Rp.</span>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={variant.price ? formatCurrency(variant.price) : ""}
                                    onChange={(e) => updateVariantField(idx, "price", parseCurrency(e.target.value))}
                                    className={cn("pl-10 text-sm", errors[`variant_${idx}_price`] && "border-red-500")}
                                  />
                                </div>
                                {errors[`variant_${idx}_price`] && <p className={cn('mt-1', 'text-xs', 'text-red-500')}>{errors[`variant_${idx}_price`]}</p>}
                              </div>
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
                      </div>
                    ))}
                  </div>
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
                          <p className={cn('text-xs', 'text-gray-500')}>{variant.pax} PAX • Rp. {formatCurrency(variant.price)}</p>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", openVariants.has(variantIdx) && "rotate-180")} />
                      </button>

                      {openVariants.has(variantIdx) && (
                        <div className={cn('px-4', 'pb-4', 'space-y-4')}>
                          {vendorCats.map((cat) => (
                            <div key={cat.id} className="space-y-2">
                              <Label className={cn('text-sm', 'font-medium', 'text-gray-700')}>{cat.name}</Label>
                              <SimpleEditor
                                value={vendorItems[variantIdx]?.[cat.name] || ""}
                                onChange={(html) => setVendorItems((prev) => ({
                                  ...prev,
                                  [variantIdx]: { ...prev[variantIdx], [cat.name]: html },
                                }))}
                                placeholder={`Masukkan item ${cat.name.toLowerCase()}...`}
                              />
                            </div>
                          ))}
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
                          <p className={cn('text-xs', 'text-gray-500')}>{variant.pax} PAX • Rp. {formatCurrency(variant.price)}</p>
                        </div>
                        <div className={cn('flex', 'items-center', 'gap-2')}>
                          <span className={cn('text-xs', 'text-gray-500')}>{(internalItems[variantIdx] ?? []).length} items</span>
                          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", openVariants.has(variantIdx) && "rotate-180")} />
                        </div>
                      </button>

                      {openVariants.has(variantIdx) && (
                        <div className={cn('px-4', 'pb-4', 'space-y-3')}>
                          {(internalItems[variantIdx] ?? []).map((item) => (
                            <div key={item.id} className={cn('border', 'border-gray-200', 'rounded-lg', 'p-3', 'bg-gray-50', 'space-y-2')}>
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
                            </div>
                          ))}
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
              onClick={currentStep === 3 ? handleSubmit : handleNext}
              className={cn('flex-1', 'bg-black', 'text-white', 'hover:bg-gray-800', 'cursor-pointer')}
              disabled={submitting}
            >
              {submitting ? "Menyimpan..." : currentStep < 3 ? "Selanjutnya" : (isEdit ? "Simpan Perubahan" : "Buat Paket")}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
