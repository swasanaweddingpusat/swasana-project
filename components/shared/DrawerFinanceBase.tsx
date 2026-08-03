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
import { CloseCircle, AlignVerticalSpacing } from "@solar-icons/react";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinanceCategoryEntry {
  categoryId: string | null;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
}

export interface DrawerFinanceSavePayload {
  categories: FinanceCategoryEntry[];
  margin: number;
  sellingPrice: number;
}

export interface DrawerFinanceBaseProps {
  isOpen: boolean;
  onClose: () => void;
  /** Initial categories to populate the drawer (in sortOrder order). */
  categories: FinanceCategoryEntry[];
  /** Shown in drawer title / header subtitle (e.g., "Package Name" or "Customer - Package - 100 pax"). */
  contextLabel: string;
  /** Optional subtitle below contextLabel (e.g., venue name). */
  venueName?: string;
  /** Header icon rendered in the info card. Defaults to null. */
  headerIcon?: React.ReactNode;
  /** Callback fired when the user confirms. Return { success, error? }. */
  onSave: (payload: DrawerFinanceSavePayload) => Promise<{ success: boolean; error?: string }>;
  /** When true, the save button shows a loading state. */
  isSaving?: boolean;
  /** Initial margin (%) when opening the drawer. */
  initialMargin?: number;
  /** Initial selling price when opening the drawer. */
  initialSellingPrice?: number;
  /** Drawer maxWidth override. */
  maxWidth?: string;
}

// ─── Internal State ───────────────────────────────────────────────────────────

interface InternalState {
  /** Ordered list of category names. */
  categories: string[];
  basePrices: Record<string, number>;
  isShow: Record<string, boolean>;
  margin: number;
  sellingPrice: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  if (!value) return "";
  return value.toLocaleString("id-ID");
}

function parse(value: string): number {
  return parseInt(value.replace(/\D/g, ""), 10) || 0;
}

function buildInternalState(
  categories: FinanceCategoryEntry[],
  initialMargin = 0,
  initialSellingPrice = 0,
): InternalState {
  const cats = categories.map((c) => c.categoryName);
  const basePrices: Record<string, number> = {};
  const isShowMap: Record<string, boolean> = {};
  for (const c of categories) {
    basePrices[c.categoryName] = c.basePrice;
    isShowMap[c.categoryName] = c.isShow;
  }
  const base = cats.reduce((s, cat) => s + (basePrices[cat] ?? 0), 0);
  const sp =
    initialSellingPrice > 0
      ? initialSellingPrice
      : base + Math.round(base * (initialMargin / 100));
  return { categories: cats, basePrices, isShow: isShowMap, margin: initialMargin, sellingPrice: sp };
}

function buildEmptyState(): InternalState {
  return { categories: [], basePrices: {}, isShow: {}, margin: 0, sellingPrice: 0 };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortableCategoryRow({
  cat,
  value,
  isShowRow,
  onChange,
  onToggleShow,
  onRemove,
}: {
  cat: string;
  value: number;
  isShowRow: boolean;
  onChange: (val: number) => void;
  onToggleShow: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2", isDragging && "opacity-50")}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
        tabIndex={-1}
      >
        <AlignVerticalSpacing weight="BoldDuotone" className="h-3.5 w-3.5" />
      </button>
      <Switch checked={isShowRow} onCheckedChange={onToggleShow} className="shrink-0" />
      <span
        className={cn("text-sm w-32 shrink-0 truncate", !isShowRow && "text-muted-foreground")}
        title={cat}
      >
        {cat}
      </span>
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
        <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
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
    <div className="relative w-48">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
      <Input
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={focused ? localText : fmt(sellingPrice)}
        onFocus={() => {
          setLocalText(fmt(sellingPrice));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          const num = parseInt(raw, 10) || 0;
          setLocalText(raw ? fmt(num) : "");
          onChange(num);
        }}
        className="h-9 text-sm pl-8 text-right font-bold"
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DrawerFinanceBase({
  isOpen,
  onClose,
  categories,
  contextLabel,
  venueName,
  headerIcon,
  onSave,
  isSaving = false,
  initialMargin = 0,
  initialSellingPrice = 0,
  maxWidth = "sm:max-w-130",
}: DrawerFinanceBaseProps) {
  const [state, setState] = useState<InternalState>(buildEmptyState);
  const [saving, setSaving] = useState(false);
  const { data: masterCategories = [] } = useCategories();
  const createCategoryMut = useCreateCategory();

  // Re-initialise state whenever the drawer opens with fresh data.
  useEffect(() => {
    if (isOpen) {
      if (categories.length > 0) {
        setState(buildInternalState(categories, initialMargin, initialSellingPrice));
      } else {
        setState(buildEmptyState());
      }
    }
  }, [isOpen, categories, initialMargin, initialSellingPrice]);

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

  // Master categories not yet present in the current list.
  const availableCategories = masterCategories.filter((c) => !state.categories.includes(c.name));

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

  // Derived display values.
  const base = state.categories.reduce((s, c) => s + (state.basePrices[c] ?? 0), 0);
  const profit = state.sellingPrice - base;
  const marginDisplay = base > 0 ? (profit / base) * 100 : 0;

  const isBusy = saving || isSaving;
  const canSave = Object.values(state.basePrices).some((p) => p > 0);

  async function handleSave() {
    setSaving(true);
    try {
      // Resolve categoryId from master by case-insensitive name match.
      const catByName = new Map(masterCategories.map((c) => [c.name.trim().toUpperCase(), c.id]));
      const payloadCategories: FinanceCategoryEntry[] = state.categories.map((cat, idx) => ({
        categoryId: catByName.get(cat.trim().toUpperCase()) ?? null,
        categoryName: cat,
        basePrice: state.basePrices[cat] ?? 0,
        sortOrder: idx + 1,
        isShow: state.isShow[cat] ?? true,
      }));
      const res = await onSave({
        categories: payloadCategories,
        margin: state.margin,
        sellingPrice: state.sellingPrice,
      });
      if (!res.success) {
        toast.error(res.error ?? "Gagal menyimpan");
        return;
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
    <Drawer isOpen={isOpen} onClose={onClose} title="Set Harga" maxWidth={maxWidth}>
      <div className="flex flex-col h-full">
        {/* Context Info */}
        <div className="space-y-3 pb-3 border-b border-border">
          <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg border border-border">
            {headerIcon && (
              <div className="p-2 bg-background rounded-md border border-border shrink-0">
                {headerIcon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{contextLabel}</p>
              {venueName && (
                <p className="text-xs text-muted-foreground">{venueName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex flex-col flex-1 min-h-0 pt-3 overflow-y-auto space-y-4 px-1">
          <Separator />

          {/* Category List */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Harga Pokok per Kategori</Label>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={state.categories} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {state.categories.map((cat) => (
                    <SortableCategoryRow
                      key={cat}
                      cat={cat}
                      value={state.basePrices[cat] ?? 0}
                      isShowRow={state.isShow[cat] ?? true}
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

            {/* Add category — pick from master list or create new inline */}
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
                const res = await createCategoryMut.mutateAsync(name);
                if (!res.success) {
                  toast.error(res.error ?? "Gagal menambahkan");
                  return;
                }
                if (!state.categories.includes(res.category.name)) {
                  setState((v) => ({ ...v, categories: [...v.categories, res.category.name] }));
                }
                toast.success(`Kategori "${res.category.name}" ditambahkan`);
              }}
            />
          </div>

          <Separator />

          {/* Total Harga Pokok */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted-foreground">Total Harga Pokok</span>
            <span className="text-sm font-semibold">{base > 0 ? `Rp ${fmt(base)}` : "-"}</span>
          </div>

          <Separator />

          {/* Margin + Harga Jual */}
          <div className="space-y-3 px-1">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Margin</Label>
                <p className="text-xs text-muted-foreground">Persentase dari harga pokok</p>
              </div>
              <div className="relative w-24">
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
                  className="h-9 text-sm pr-7 text-right"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>

            {base > 0 && marginDisplay !== state.margin && (
              <p className="text-xs text-muted-foreground text-right">
                Margin aktual: {marginDisplay.toFixed(2)}%
              </p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Keuntungan</span>
              <span className="text-sm text-muted-foreground">
                {profit > 0 ? `+ Rp ${fmt(profit)}` : "-"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
              <Label className="text-sm font-bold shrink-0">Harga Jual</Label>
              <SellingPriceInput
                sellingPrice={state.sellingPrice}
                onChange={(sell) => {
                  const newMargin =
                    base > 0 ? parseFloat((((sell - base) / base) * 100).toFixed(2)) : 0;
                  setState((v) => ({ ...v, sellingPrice: sell, margin: Math.max(0, newMargin) }));
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border mt-auto">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={isBusy}>
              Tutup
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={isBusy || !canSave}
            >
              {isBusy ? "Menyimpan..." : "Simpan Harga"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
