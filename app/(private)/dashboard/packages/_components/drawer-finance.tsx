"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Box, AddCircle, CloseCircle, MenuDots, Copy } from "@solar-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { PackageQueryItem } from "@/lib/queries/packages";
import { useSaveVariantPrices } from "@/hooks/use-packages";
import { toast } from "sonner";
import { cn } from "../../../../../lib/utils";

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

interface VariantFinance {
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

function initVariantFinance(): VariantFinance {
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
        className={cn('p-1', 'text-muted-foreground', 'hover:text-foreground', 'cursor-grab', 'active:cursor-grabbing', 'shrink-0')}
        tabIndex={-1}
      >
        <MenuDots weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
      </button>
      <Switch checked={isShow} onCheckedChange={onToggleShow} className="shrink-0" />
      <span className={cn('text-sm', 'w-32', 'shrink-0', 'truncate', !isShow && 'text-muted-foreground')} title={cat}>{cat}</span>
      <div className={cn('relative', 'flex-1')}>
        <span className={cn('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'text-xs', 'text-muted-foreground')}>Rp</span>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={fmt(value)}
          onChange={(e) => onChange(parse(e.target.value))}
          className={cn('pl-8', 'h-9', 'text-sm')}
        />
      </div>
      <button
        onClick={onRemove}
        className={cn('p-1', 'rounded', 'hover:bg-muted', 'text-muted-foreground', 'hover:text-destructive', 'transition-colors', 'shrink-0')}
      >
        <CloseCircle weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
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
    <div className={cn('relative', 'w-48')}>
      <span className={cn('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'text-xs', 'text-muted-foreground')}>Rp</span>
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
        className={cn('h-9', 'text-sm', 'pl-8', 'text-right', 'font-bold')}
      />
    </div>
  );
}

export function DrawerFinance({ isOpen, onClose, pkg }: DrawerFinanceProps) {
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [variantData, setVariantData] = useState<VariantFinance[]>([]);
  const [saving, setSaving] = useState(false);
  const saveVariantPricesMut = useSaveVariantPrices();

  useEffect(() => {
    if (isOpen && pkg) {
      setVariantData(pkg.variants.map((v) => {
        if (v.categoryPrices && v.categoryPrices.length > 0) {
          const cats = v.categoryPrices.map((c) => c.categoryName);
          const basePrices: Record<string, number> = {};
          const isShowMap: Record<string, boolean> = {};
          for (const c of v.categoryPrices) {
            basePrices[c.categoryName] = Number(c.basePrice);
            isShowMap[c.categoryName] = c.isShow ?? true;
          }
          const base = cats.reduce((s, c) => s + (basePrices[c] ?? 0), 0);
          const margin = v.margin ?? 0;
          const sp = (v.sellingPrice && v.sellingPrice > 0) ? v.sellingPrice : base + Math.round(base * (margin / 100));
          return { categories: cats, basePrices, isShow: isShowMap, margin, sellingPrice: sp, newCat: "" };
        }
        return initVariantFinance();
      }));
      setActiveVariantIdx(0);
    }
  }, [isOpen, pkg]);

  function updateVariant(idx: number, updater: (v: VariantFinance) => VariantFinance) {
    setVariantData((prev) => prev.map((v, i) => (i === idx ? updater(v) : v)));
  }

  function handleCopyFromVariant(targetIdx: number, sourceIdx: number) {
    setVariantData((prev) =>
      prev.map((v, i) =>
        i === targetIdx ? { ...prev[sourceIdx], newCat: "" } : v
      )
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
          isShow: vd.isShow[cat] ?? true,
        }));
        const res = await saveVariantPricesMut.mutateAsync({ variantId: variant.id, categories, margin: vd.margin, sellingPrice: vd.sellingPrice });
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

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Set Harga Package" maxWidth="sm:max-w-130">
      <div className={cn('flex', 'flex-col', 'h-full')}>
        {/* Sticky Header */}
        <div className={cn('space-y-3', 'pb-3', 'border-b', 'border-border')}>
          {/* Package Info */}
          <div className={cn('flex', 'items-start', 'gap-3', 'p-3', 'bg-muted/40', 'rounded-lg', 'border', 'border-border')}>
            <div className={cn('p-2', 'bg-background', 'rounded-md', 'border', 'border-border')}>
              <Box weight="BoldDuotone" className={cn('h-4', 'w-4')} />
            </div>
            <div className={cn('flex-1', 'min-w-0')}>
              <p className={cn('font-semibold', 'text-sm', 'truncate')}>{pkg.packageName}</p>
              <p className={cn('text-xs', 'text-muted-foreground')}>{pkg.venue?.name ?? "-"}</p>
            </div>
          </div>
        </div>

        {/* Variant Selector + Copy */}
        <div className={cn('flex', 'flex-col', 'flex-1', 'min-h-0', 'pt-3')}>
          {pkg.variants.length > 1 && (
            <div className={cn('flex', 'items-center', 'gap-2', 'pb-3', 'shrink-0')}>
              <Select
                value={String(activeVariantIdx)}
                onValueChange={(val) => setActiveVariantIdx(Number(val))}
              >
                <SelectTrigger className={cn('flex-1', 'h-9', 'text-sm')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pkg.variants.map((v, idx) => (
                    <SelectItem key={v.id} value={String(idx)}>
                      {v.variantName} ({v.pax} pax)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-9', 'w-9', 'p-0', 'shrink-0')}>
                    <Copy weight="BoldDuotone" className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Salin dari varian</DropdownMenuLabel>
                  {pkg.variants.map((sv, sIdx) =>
                    sIdx !== activeVariantIdx ? (
                      <DropdownMenuItem key={sv.id} onSelect={() => handleCopyFromVariant(activeVariantIdx, sIdx)}>
                        {sv.variantName} ({sv.pax} pax)
                      </DropdownMenuItem>
                    ) : null
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Scrollable Content — Active Variant */}
          {(() => {
            const idx = activeVariantIdx;
            const v = pkg.variants[idx];
            const vd = variantData[idx];
            if (!v || !vd) return null;
            const vBase = vd.categories.reduce((s, c) => s + (vd.basePrices[c] ?? 0), 0);
            const vSell = vd.sellingPrice;
            const vProfit = vSell - vBase;
            const vMarginDisplay = vBase > 0 ? ((vProfit / vBase) * 100) : 0;
            return (
              <div className={cn('flex-1', 'overflow-y-auto', 'space-y-4', 'px-1')}>
                <Separator />

                {/* Category List */}
                <div className="space-y-3">
                  <div>
                    <Label className={cn('text-sm', 'font-semibold')}>Harga Pokok per Kategori</Label>
                    <p className={cn('text-xs', 'text-muted-foreground', 'mt-0.5')}>Untuk varian <span className={cn('font-medium', 'text-foreground')}>{v.variantName}</span></p>
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={vd.categories} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {vd.categories.map((cat) => (
                          <SortableCategoryRow
                            key={cat}
                            cat={cat}
                            value={vd.basePrices[cat] ?? 0}
                            isShow={vd.isShow[cat] ?? true}
                            onChange={(val) =>
                              updateVariant(idx, (vv) => {
                                const newBp = { ...vv.basePrices, [cat]: val };
                                const newBase = vv.categories.reduce((s, c) => s + (newBp[c] ?? 0), 0);
                                const newSell = newBase + Math.round(newBase * (vv.margin / 100));
                                return { ...vv, basePrices: newBp, sellingPrice: newSell };
                              })
                            }
                            onToggleShow={() =>
                              updateVariant(idx, (vv) => ({
                                ...vv,
                                isShow: { ...vv.isShow, [cat]: !(vv.isShow[cat] ?? true) },
                              }))
                            }
                            onRemove={() => removeCategory(idx, cat)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {/* Add Custom Category */}
                  <div className={cn('flex', 'items-center', 'gap-2')}>
                    <Input
                      placeholder="Tambah kategori..."
                      value={vd.newCat}
                      onChange={(e) => updateVariant(idx, (vv) => ({ ...vv, newCat: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(idx); } }}
                      className={cn('h-9', 'text-sm', 'flex-1')}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addCategory(idx)}
                      disabled={!vd.newCat.trim() || vd.categories.includes(vd.newCat.trim())}
                      className={cn('h-9', 'shrink-0')}
                    >
                      <AddCircle weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'mr-1')} /> Tambah
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Total Harga Pokok */}
                <div className={cn('flex', 'items-center', 'justify-between', 'px-1')}>
                  <span className={cn('text-sm', 'text-muted-foreground')}>Total Harga Pokok</span>
                  <span className={cn('text-sm', 'font-semibold')}>{vBase > 0 ? `Rp ${fmt(vBase)}` : "-"}</span>
                </div>

                <Separator />

                {/* Margin + Harga Jual */}
                <div className={cn('space-y-3', 'px-1')}>
                  <div className={cn('flex', 'items-center', 'justify-between')}>
                    <div>
                      <Label className={cn('text-sm', 'font-semibold')}>Margin</Label>
                      <p className={cn('text-xs', 'text-muted-foreground')}>Persentase dari harga pokok</p>
                    </div>
                    <div className={cn('relative', 'w-24')}>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={vd.margin || ""}
                        onChange={(e) => {
                          const margin = Math.max(0, parseFloat(e.target.value) || 0);
                          const newSell = vBase + Math.round(vBase * (margin / 100));
                          updateVariant(idx, (vv) => ({ ...vv, margin, sellingPrice: newSell }));
                        }}
                        className={cn('h-9', 'text-sm', 'pr-7', 'text-right')}
                      />
                      <span className={cn('absolute', 'right-3', 'top-1/2', '-translate-y-1/2', 'text-xs', 'text-muted-foreground')}>%</span>
                    </div>
                  </div>

                  {vBase > 0 && vMarginDisplay !== vd.margin && (
                    <p className={cn('text-xs', 'text-muted-foreground', 'text-right')}>
                      Margin aktual: {vMarginDisplay.toFixed(2)}%
                    </p>
                  )}

                  <div className={cn('flex', 'items-center', 'justify-between')}>
                    <span className={cn('text-sm', 'text-muted-foreground')}>Keuntungan</span>
                    <span className={cn('text-sm', 'text-muted-foreground')}>{vProfit > 0 ? `+ Rp ${fmt(vProfit)}` : "-"}</span>
                  </div>

                  <div className={cn('flex', 'items-center', 'justify-between', 'p-3', 'bg-muted/40', 'rounded-lg', 'border', 'border-border')}>
                    <Label className={cn('text-sm', 'font-bold', 'shrink-0')}>Harga Jual</Label>
                    <SellingPriceInput
                      sellingPrice={vSell}
                      onChange={(sell) => {
                        const newMargin = vBase > 0 ? parseFloat((((sell - vBase) / vBase) * 100).toFixed(2)) : 0;
                        updateVariant(idx, (vv) => ({ ...vv, sellingPrice: sell, margin: Math.max(0, newMargin) }));
                      }}
                    />
                  </div>
                </div>

                {/* Summary semua variant */}
                {pkg.variants.length > 1 && (
                  <>
                    <Separator />
                    <div className={cn('space-y-1.5', 'px-1')}>
                      <p className={cn('text-xs', 'font-semibold', 'text-muted-foreground', 'uppercase', 'tracking-wide')}>Ringkasan Semua Varian</p>
                      {pkg.variants.map((sv, sIdx) => {
                        const svd = variantData[sIdx];
                        if (!svd) return null;
                        const svBase = svd.categories.reduce((s, c) => s + (svd.basePrices[c] ?? 0), 0);
                        const svMargin = svBase > 0 ? ((svd.sellingPrice - svBase) / svBase) * 100 : 0;
                        return (
                          <div key={sv.id} className={cn('flex', 'items-center', 'justify-between', 'text-xs')}>
                            <span className="text-muted-foreground">{sv.variantName} ({sv.pax} pax)</span>
                            <div className={cn('flex', 'items-center', 'gap-2')}>
                              {svMargin > 0 && <Badge variant="secondary" className="text-xs">{svMargin.toFixed(1)}%</Badge>}
                              <span className="font-medium">{svd.sellingPrice > 0 ? `Rp ${fmt(svd.sellingPrice)}` : "-"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className={cn('pt-4', 'border-t', 'border-border', 'mt-auto')}>
          <div className={cn('flex', 'gap-2')}>
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
