"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Package, Plus, X, GripVertical } from "lucide-react";
import type { PackageQueryItem } from "@/lib/queries/packages";
import { useSaveVariantPrices } from "@/hooks/use-packages";
import { toast } from "sonner";

interface DrawerFinanceProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: PackageQueryItem | null;
}

const DEFAULT_CATEGORIES = [
  "Catering",
  "Dekorasi",
  "Rias Busana",
  "Photography",
  "Entertainment",
  "MC",
  "WO",
  "Adat",
  "Siraman",
  "LED Videotron",
  "Lighting Ambiance / Effect Dry Ice",
  "RAB Event",
  "Izin Kepolisian",
  "Bonus Sales",
  "Bonus Manager",
  "Bonus Direktur",
  "Bonus Venue Specialist",
  "Discount Client",
  "Gedung (min 70 event/thn)",
  "Usher",
  "Digital Invitation & Guest Book",
  "Hotel / Wisma",
  "Wedding Content Creator",
];

interface VariantFinance {
  categories: string[];
  basePrices: Record<string, number>;
  margin: number;
  newCat: string;
}

function fmt(value: number): string {
  if (!value) return "";
  return value.toLocaleString("id-ID");
}

function parse(value: string): number {
  return parseInt(value.replace(/\D/g, "")) || 0;
}

function initVariantFinance(): VariantFinance {
  return { categories: [...DEFAULT_CATEGORIES], basePrices: {}, margin: 0, newCat: "" };
}

function SortableCategoryRow({
  cat,
  value,
  onChange,
  onRemove,
}: {
  cat: string;
  value: number;
  onChange: (val: number) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-sm w-32 shrink-0 truncate" title={cat}>{cat}</span>
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={fmt(value)}
          onChange={(e) => onChange(parse(e.target.value))}
          className="pl-8 h-9 text-sm"
        />
      </div>
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function DrawerFinance({ isOpen, onClose, pkg }: DrawerFinanceProps) {
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [variantData, setVariantData] = useState<VariantFinance[]>([]);
  const [syncAll, setSyncAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveVariantPricesMut = useSaveVariantPrices();

  useEffect(() => {
    if (isOpen && pkg) {
      setVariantData(pkg.variants.map((v) => {
        // Load existing category prices if available
        if (v.categoryPrices && v.categoryPrices.length > 0) {
          const cats = v.categoryPrices.map((c) => c.categoryName);
          const basePrices: Record<string, number> = {};
          for (const c of v.categoryPrices) basePrices[c.categoryName] = Number(c.basePrice);
          return { categories: cats, basePrices, margin: v.margin ?? 0, newCat: "" };
        }
        return initVariantFinance();
      }));
      setActiveVariantIdx(0);
      setSyncAll(false);
    }
  }, [isOpen, pkg]);

  function updateVariant(idx: number, updater: (v: VariantFinance) => VariantFinance) {
    setVariantData((prev) =>
      syncAll
        ? prev.map((v) => updater(v))
        : prev.map((v, i) => (i === idx ? updater(v) : v))
    );
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateVariant(activeVariantIdx, (v) => {
      const oldIdx = v.categories.indexOf(String(active.id));
      const newIdx = v.categories.indexOf(String(over.id));
      return { ...v, categories: arrayMove(v.categories, oldIdx, newIdx) };
    });
  }

  function addCategory(idx: number) {
    const name = variantData[idx]?.newCat.trim();
    if (!name || variantData[idx].categories.includes(name)) return;
    updateVariant(idx, (v) => ({ ...v, categories: [...v.categories, name], newCat: "" }));
  }

  function removeCategory(idx: number, cat: string) {
    updateVariant(idx, (v) => {
      const bp = { ...v.basePrices };
      delete bp[cat];
      return { ...v, categories: v.categories.filter((c) => c !== cat), basePrices: bp };
    });
  }

  if (!pkg) return null;

  async function handleSave() {
    if (!pkg) return;
    setSaving(true);
    try {
      for (let i = 0; i < pkg.variants.length; i++) {
        const variant = pkg.variants[i];
        const vd = variantData[i];
        if (!vd) continue;
        const categories = vd.categories.map((cat, idx) => ({
          categoryName: cat,
          basePrice: vd.basePrices[cat] ?? 0,
          sortOrder: idx + 1,
        }));
        const res = await saveVariantPricesMut.mutateAsync({ variantId: variant.id, categories, margin: vd.margin });
        if (!res.success) { toast.error(res.error ?? "Gagal menyimpan"); setSaving(false); return; }
      }
      toast.success("Harga berhasil disimpan");
      onClose();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  const active = variantData[activeVariantIdx];
  const totalBase = active ? active.categories.reduce((s, c) => s + (active.basePrices[c] ?? 0), 0) : 0;
  const profit = Math.round(totalBase * ((active?.margin ?? 0) / 100));
  const totalSelling = totalBase + profit;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Set Harga Package" maxWidth="sm:max-w-130">
      <div className="flex flex-col h-full">
        {/* Sticky Header */}
        <div className="space-y-3 pb-3 border-b border-border">
          {/* Package Info */}
          <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg border border-border">
            <div className="p-2 bg-background rounded-md border border-border">
              <Package className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{pkg.packageName}</p>
              <p className="text-xs text-muted-foreground">{pkg.venue?.name ?? "-"}</p>
            </div>
          </div>

          {/* Variant Dropdown */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Varian</Label>
            <SearchableSelect
              options={pkg.variants.map((v, idx) => ({
                id: String(idx),
                name: `${v.variantName}. ${v.pax} pax`,
              }))}
              value={String(activeVariantIdx)}
              onChange={(val) => setActiveVariantIdx(Number(val))}
              placeholder="Pilih varian..."
              searchPlaceholder="Cari varian..."
            />
          </div>

          {/* Sync All Toggle */}
          {pkg.variants.length > 1 && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Edit Semua Varian Sekaligus</p>
                <p className="text-xs text-muted-foreground">Perubahan harga & margin berlaku untuk semua varian</p>
              </div>
              <Switch checked={syncAll} onCheckedChange={setSyncAll} />
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 px-1 pt-4">
          {active && (
            <>
              <Separator />

              {/* Category List */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold">Harga Pokok per Kategori</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Untuk varian <span className="font-medium text-foreground">{pkg.variants[activeVariantIdx]?.variantName}</span></p>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={active.categories} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {active.categories.map((cat) => (
                        <SortableCategoryRow
                          key={cat}
                          cat={cat}
                          value={active.basePrices[cat] ?? 0}
                          onChange={(val) =>
                            updateVariant(activeVariantIdx, (v) => ({
                              ...v,
                              basePrices: { ...v.basePrices, [cat]: val },
                            }))
                          }
                          onRemove={() => removeCategory(activeVariantIdx, cat)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Add Custom Category */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Tambah kategori..."
                    value={active.newCat}
                    onChange={(e) => updateVariant(activeVariantIdx, (v) => ({ ...v, newCat: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(activeVariantIdx); } }}
                    className="h-9 text-sm flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addCategory(activeVariantIdx)}
                    disabled={!active.newCat.trim() || active.categories.includes(active.newCat.trim())}
                    className="h-9 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Total Harga Pokok */}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-muted-foreground">Total Harga Pokok</span>
                <span className="text-sm font-semibold">{totalBase > 0 ? `Rp ${fmt(totalBase)}` : "-"}</span>
              </div>

              <Separator />

              {/* Margin */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <Label className="text-sm font-semibold">Margin</Label>
                  <p className="text-xs text-muted-foreground">Persentase dari total harga pokok</p>
                </div>
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={active.margin || ""}
                    onChange={(e) =>
                      updateVariant(activeVariantIdx, (v) => ({
                        ...v,
                        margin: Math.max(0, parseFloat(e.target.value) || 0),
                      }))
                    }
                    className="h-9 text-sm pr-7 text-right"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>

              <Separator />

              {/* Harga Jual */}
              <div className="space-y-2 px-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Keuntungan</span>
                  <span className="text-sm text-muted-foreground">{profit > 0 ? `+ Rp ${fmt(profit)}` : "-"}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                  <span className="text-sm font-bold">Harga Jual</span>
                  <span className="text-lg font-bold">{totalSelling > 0 ? `Rp ${fmt(totalSelling)}` : "-"}</span>
                </div>
              </div>

              {/* Summary semua variant */}
              {pkg.variants.length > 1 && (
                <>
                  <Separator />
                  <div className="space-y-1.5 px-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ringkasan Semua Varian</p>
                    {pkg.variants.map((v, idx) => {
                      const vd = variantData[idx];
                      if (!vd) return null;
                      const vBase = vd.categories.reduce((s, c) => s + (vd.basePrices[c] ?? 0), 0);
                      const vSell = vBase + Math.round(vBase * (vd.margin / 100));
                      return (
                        <div key={v.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{v.variantName} ({v.pax} pax)</span>
                          <div className="flex items-center gap-2">
                            {vd.margin > 0 && <Badge variant="secondary" className="text-xs">{vd.margin}%</Badge>}
                            <span className="font-medium">{vSell > 0 ? `Rp ${fmt(vSell)}` : "-"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border mt-auto">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Tutup</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || variantData.every((v) => Object.values(v.basePrices).every((p) => !p))}>
              {saving ? "Menyimpan..." : "Simpan Harga"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
