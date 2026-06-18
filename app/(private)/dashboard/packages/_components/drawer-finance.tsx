"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Box, CloseCircle, AlignVerticalSpacing } from "@solar-icons/react";
import type { PackageQueryItem } from "@/lib/queries/packages";
import { useSavePackagePrices } from "@/hooks/use-packages";
import { useCategories } from "@/hooks/use-categories";
import { createCategory } from "@/actions/category";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DrawerFinanceProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: PackageQueryItem | null;
}

const DEFAULT_CATEGORIES = [
  "CATERING",
  "DEKORASI",
  "RIAS BUSANA",
  "PHOTOGRAPHY",
  "ENTERTAINMENT",
  "MC",
  "WO",
  "ADAT",
  "SIRAMAN",
  "LED VIDEOTRON",
  "LIGHTING AMBIANCE / EFFECT DRY ICE",
  "RAB EVENT",
  "IZIN KEPOLISIAN",
  "BONUS SALES",
  "BONUS MANAGER",
  "BONUS DIREKTUR",
  "BONUS VENUE SPECIALIST",
  "BONUS CLIENT",
  "GEDUNG (MIN 70 EVENT/THN)",
  "USHER",
  "DIGITAL INVITATION & GUEST BOOK",
  "HOTEL / WISMA",
  "WEDDING CONTENT CREATOR",
];

interface FinanceState {
  categories: string[];
  basePrices: Record<string, number>;
  isShow: Record<string, boolean>;
  margin: number;
  sellingPrice: number;
  newCat: string;
}

function fmt(value: number): string {
  if (!value) return "";
  return value.toLocaleString("id-ID");
}

function parse(value: string): number {
  return parseInt(value.replace(/\D/g, "")) || 0;
}

function initFinanceState(): FinanceState {
  const isShow: Record<string, boolean> = {};
  for (const cat of DEFAULT_CATEGORIES) isShow[cat] = false;
  return { categories: [...DEFAULT_CATEGORIES], basePrices: {}, isShow, margin: 0, sellingPrice: 0, newCat: "" };
}

function SortableCategoryRow({
  cat,
  value,
  isShow,
  onChange,
  onToggleShow,
  onRemove,
}: {
  cat: string;
  value: number;
  isShow: boolean;
  onChange: (val: number) => void;
  onToggleShow: () => void;
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
        className={cn("p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0")}
        tabIndex={-1}
      >
        <AlignVerticalSpacing weight="BoldDuotone" className="h-3.5 w-3.5" />
      </button>
      <Switch checked={isShow} onCheckedChange={onToggleShow} className="shrink-0" />
      <span className={cn("text-sm w-32 shrink-0 truncate", !isShow && "text-muted-foreground")} title={cat}>{cat}</span>
      <div className={cn("relative flex-1")}>
        <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground")}>Rp</span>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={fmt(value)}
          onChange={(e) => onChange(parse(e.target.value))}
          className={cn("pl-8 h-9 text-sm")}
        />
      </div>
      <button
        onClick={onRemove}
        className={cn("p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0")}
      >
        <CloseCircle weight="BoldDuotone" className={cn("h-3.5 w-3.5")} />
      </button>
    </div>
  );
}

function SellingPriceInput({
  sellingPrice,
  onChange,
}: {
  sellingPrice: number;
  onChange: (value: number) => void;
}) {
  const [localText, setLocalText] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div className={cn("relative w-48")}>
      <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground")}>Rp</span>
      <Input
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={focused ? localText : fmt(sellingPrice)}
        onFocus={() => { setLocalText(fmt(sellingPrice)); setFocused(true); }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          const num = parseInt(raw) || 0;
          setLocalText(raw ? fmt(num) : "");
          onChange(num);
        }}
        className={cn("h-9 text-sm pl-8 text-right font-bold")}
      />
    </div>
  );
}

export function DrawerFinance({ isOpen, onClose, pkg }: DrawerFinanceProps) {
  const [state, setState] = useState<FinanceState>(initFinanceState());
  const [saving, setSaving] = useState(false);
  const savePackagePricesMut = useSavePackagePrices();
  const { data: categories = [] } = useCategories();
  const qc = useQueryClient();

  useEffect(() => {
    if (isOpen && pkg) {
      if (pkg.categoryPrices && pkg.categoryPrices.length > 0) {
        const cats = pkg.categoryPrices.map((c) => c.categoryName);
        const basePrices: Record<string, number> = {};
        const isShowMap: Record<string, boolean> = {};
        for (const c of pkg.categoryPrices) {
          basePrices[c.categoryName] = Number(c.basePrice);
          isShowMap[c.categoryName] = c.isShow ?? true;
        }
        const base = cats.reduce((s, c) => s + (basePrices[c] ?? 0), 0);
        const margin = pkg.margin ?? 0;
        const sp = (pkg.sellingPrice && pkg.sellingPrice > 0) ? pkg.sellingPrice : base + Math.round(base * (margin / 100));
        setState({ categories: cats, basePrices, isShow: isShowMap, margin, sellingPrice: sp, newCat: "" });
      } else {
        setState(initFinanceState());
      }
    }
  }, [isOpen, pkg]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setState((v) => {
      const oldIdx = v.categories.indexOf(String(active.id));
      const newIdx = v.categories.indexOf(String(over.id));
      return { ...v, categories: arrayMove(v.categories, oldIdx, newIdx) };
    });
  }

  // Categories from master not yet added to this package.
  const availableCategories = categories.filter((c) => !state.categories.includes(c.name));

  function removeCategory(cat: string) {
    setState((v) => {
      const bp = { ...v.basePrices };
      const is = { ...v.isShow };
      delete bp[cat];
      delete is[cat];
      const newCats = v.categories.filter((c) => c !== cat);
      const newBase = newCats.reduce((s, c) => s + (bp[c] ?? 0), 0);
      const newSell = newBase + Math.round(newBase * (v.margin / 100));
      return { ...v, categories: newCats, basePrices: bp, isShow: is, sellingPrice: newSell };
    });
  }

  if (!pkg) return null;

  const base = state.categories.reduce((s, c) => s + (state.basePrices[c] ?? 0), 0);
  const profit = state.sellingPrice - base;
  const marginDisplay = base > 0 ? ((profit / base) * 100) : 0;

  async function handleSave() {
    if (!pkg) return;
    setSaving(true);
    try {
      // Resolve categoryId from master by case-insensitive name match.
      const catByName = new Map(categories.map((c) => [c.name.trim().toUpperCase(), c.id]));
      const payloadCategories = state.categories.map((cat, idx) => ({
        categoryId: catByName.get(cat.trim().toUpperCase()) ?? null,
        categoryName: cat,
        basePrice: state.basePrices[cat] ?? 0,
        sortOrder: idx + 1,
        isShow: state.isShow[cat] ?? true,
      }));
      const res = await savePackagePricesMut.mutateAsync({
        packageId: pkg.id,
        categories: payloadCategories,
        margin: state.margin,
        sellingPrice: state.sellingPrice,
      });
      if (!res.success) { toast.error(res.error ?? "Gagal menyimpan"); setSaving(false); return; }
      toast.success("Harga berhasil disimpan");
      onClose();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Set Harga Package" maxWidth="sm:max-w-130">
      <div className={cn("flex flex-col h-full")}>
        {/* Package Info */}
        <div className={cn("space-y-3 pb-3 border-b border-border")}>
          <div className={cn("flex items-start gap-3 p-3 bg-muted/40 rounded-lg border border-border")}>
            <div className={cn("p-2 bg-background rounded-md border border-border")}>
              <Box weight="BoldDuotone" className={cn("h-4 w-4")} />
            </div>
            <div className={cn("flex-1 min-w-0")}>
              <p className={cn("font-semibold text-sm truncate")}>{pkg.packageName}</p>
              <p className={cn("text-xs text-muted-foreground")}>{pkg.pax} PAX · {pkg.venue?.name ?? "-"}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className={cn("flex flex-col flex-1 min-h-0 pt-3 overflow-y-auto space-y-4 px-1")}>
          <Separator />

          {/* Category List */}
          <div className="space-y-3">
            <div>
              <Label className={cn("text-sm font-semibold")}>Harga Pokok per Kategori</Label>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={state.categories} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {state.categories.map((cat) => (
                    <SortableCategoryRow
                      key={cat}
                      cat={cat}
                      value={state.basePrices[cat] ?? 0}
                      isShow={state.isShow[cat] ?? true}
                      onChange={(val) =>
                        setState((v) => {
                          const newBp = { ...v.basePrices, [cat]: val };
                          const newBase = v.categories.reduce((s, c) => s + (newBp[c] ?? 0), 0);
                          const newSell = newBase + Math.round(newBase * (v.margin / 100));
                          return { ...v, basePrices: newBp, sellingPrice: newSell };
                        })
                      }
                      onToggleShow={() =>
                        setState((v) => ({
                          ...v,
                          isShow: { ...v.isShow, [cat]: !(v.isShow[cat] ?? true) },
                        }))
                      }
                      onRemove={() => removeCategory(cat)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add Category — pilih dari master kategori global, atau tambah baru inline */}
            <SearchableSelect
              options={availableCategories.map((c) => ({ id: c.name, name: c.name }))}
              value=""
              onChange={(name) => {
                if (name && !state.categories.includes(name)) {
                  setState((v) => ({ ...v, categories: [...v.categories, name] }));
                }
              }}
              placeholder="Tambah kategori..."
              searchPlaceholder="Cari / ketik kategori baru..."
              emptyText="Kategori tidak ditemukan"
              className="w-full"
              onAdd={async (name) => {
                const res = await createCategory(name);
                if (!res.success) { toast.error(res.error ?? "Gagal menambahkan"); return; }
                await qc.invalidateQueries({ queryKey: ["categories"] });
                if (!state.categories.includes(res.category.name)) {
                  setState((v) => ({ ...v, categories: [...v.categories, res.category.name] }));
                }
                toast.success(`Kategori "${res.category.name}" ditambahkan`);
              }}
            />
          </div>

          <Separator />

          {/* Total Harga Pokok */}
          <div className={cn("flex items-center justify-between px-1")}>
            <span className={cn("text-sm text-muted-foreground")}>Total Harga Pokok</span>
            <span className={cn("text-sm font-semibold")}>{base > 0 ? `Rp ${fmt(base)}` : "-"}</span>
          </div>

          <Separator />

          {/* Margin + Harga Jual */}
          <div className={cn("space-y-3 px-1")}>
            <div className={cn("flex items-center justify-between")}>
              <div>
                <Label className={cn("text-sm font-semibold")}>Margin</Label>
                <p className={cn("text-xs text-muted-foreground")}>Persentase dari harga pokok</p>
              </div>
              <div className={cn("relative w-24")}>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={state.margin || ""}
                  onChange={(e) => {
                    const margin = Math.max(0, parseFloat(e.target.value) || 0);
                    const newSell = base + Math.round(base * (margin / 100));
                    setState((v) => ({ ...v, margin, sellingPrice: newSell }));
                  }}
                  className={cn("h-9 text-sm pr-7 text-right")}
                />
                <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground")}>%</span>
              </div>
            </div>

            {base > 0 && marginDisplay !== state.margin && (
              <p className={cn("text-xs text-muted-foreground text-right")}>
                Margin aktual: {marginDisplay.toFixed(2)}%
              </p>
            )}

            <div className={cn("flex items-center justify-between")}>
              <span className={cn("text-sm text-muted-foreground")}>Keuntungan</span>
              <span className={cn("text-sm text-muted-foreground")}>{profit > 0 ? `+ Rp ${fmt(profit)}` : "-"}</span>
            </div>

            <div className={cn("flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border")}>
              <Label className={cn("text-sm font-bold shrink-0")}>Harga Jual</Label>
              <SellingPriceInput
                sellingPrice={state.sellingPrice}
                onChange={(sell) => {
                  const newMargin = base > 0 ? parseFloat((((sell - base) / base) * 100).toFixed(2)) : 0;
                  setState((v) => ({ ...v, sellingPrice: sell, margin: Math.max(0, newMargin) }));
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={cn("pt-4 border-t border-border mt-auto")}>
          <div className={cn("flex gap-2")}>
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Tutup</Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || Object.values(state.basePrices).every((p) => !p)}
            >
              {saving ? "Menyimpan..." : "Simpan Harga"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
