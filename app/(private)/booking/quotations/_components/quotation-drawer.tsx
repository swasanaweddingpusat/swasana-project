"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray, type UseFormReturn, type FieldPath } from "react-hook-form";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCreateQuotation, useUpdateQuotation } from "@/hooks/use-quotations";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SearchableSelect,
} from "@/components/ui/searchable-select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { ComplimentarySelect } from "@/components/shared/ComplimentarySelect";
import { BonusSelect } from "@/components/shared/BonusSelect";
import {
  AddCircle,
  TrashBinTrash,
  Refresh,
  ArrowRight,
  AltArrowDown,
  Calendar as CalendarSolarIcon,
  AlignVerticalSpacing,
  Box,
  BillList,
  Gift,
  MedalStar,
  Calculator,
  SafeSquare,
} from "@solar-icons/react";
import { cn, parseDateOnly } from "@/lib/utils";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useComplimentaries } from "@/hooks/use-complimentaries";
import { useBonuses } from "@/hooks/use-bonuses";
import { usePermissions } from "@/hooks/use-permissions";
import { createComplimentary } from "@/actions/complimentary";
import { createBonus } from "@/actions/bonus";
import { parseContactNumbers } from "@/types/daily-activity";
import type { QuotationItem } from "./quotations-table";

// ── Types ────────────────────────────────────────────────────────────────────

interface QuotationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuotation: QuotationItem | null;
  onSuccess?: () => void;
}

interface QuotationItemForm {
  title: string;
  description: string; // rich text (HTML) dari TipTap
  qty: string;
  price: string;
  total: string;
  manualTotal: boolean;
}

type QuotationStatusValue = "draft" | "sent" | "revised" | "accepted" | "rejected";

interface QuotationFormValues {
  // Step 1 — informasi
  clientName: string;
  clientPhone: string;
  instansi: string;
  salesId: string;
  salesName: string;
  salesPhone: string;
  eventTypeId: string;
  eventTypeName: string; // nama event type untuk display/preview
  details: string;
  time: string;
  place: string;
  venueId: string;
  venue: string;
  eventDate: string;
  eventEndDate: string;
  status: QuotationStatusValue;
  // Step 2 — items + ringkasan
  items: QuotationItemForm[];
  // Additional — priced line items, UI-only for now (belum ada di server/DB;
  // JANGAN dikirim ke server action sampai schema server siap).
  additionals: QuotationItemForm[];
  discount: string;
  bookingFee: string;
  paymentNote: string;
  cancellationPolicy: string;
  closingNote: string;
  validUntil: string;
  notes: string;
  paymentMethodId: string;
}

// ── API response types ───────────────────────────────────────────────────────

interface ComplimentaryRow {
  id: string;
  complimentaryId: string | null;
  name: string;
  price: number;
  isShowPrice: boolean;
  description: string;
  qty: number;
}

interface BonusRow {
  id: string;
  bonusId: string | null;
  name: string;
  price: number;
  description: string;
  qty: number;
}

// Price — UI-only for now (belum ada table/DB; JANGAN dikirim ke server action
// sampai schema server siap). Mirrors the MicePriceType QTY/NOMINAL convention
// already established for package_mice_prices (lib/validations/package.ts):
// QTY rows carry qty+price (total = qty*price, computed client-side), NOMINAL
// rows carry only a directly-editable total (qty/price stay null).
type PriceType = "QTY" | "NOMINAL";

interface PriceRow {
  id: string;
  name: string;
  priceType: PriceType;
  qty: number | null;
  price: number | null;
  total: number;
}

// Tax & Deposit — UI-only for now (belum ada table/DB; JANGAN dikirim ke server
// action sampai schema server siap). Same local-useState architecture as Price.
interface TaxDepositRow {
  id: string;
  name: string;
  nominal: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNumericInput(raw: string): number {
  return parseInt(raw.replace(/\D/g, ""), 10) || 0;
}


function formatNumericDisplay(raw: string | number): string {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

function formatRupiah(amount: number): string {
  if (amount === 0) return "—";
  return amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const LABEL_CLASS = cn("text-sm", "font-medium", "text-foreground");

const TAB_TRIGGER_CLASS = cn(
  "h-auto flex-none items-center gap-1.5 rounded-none border-0 border-b border-b-transparent -mb-px bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors after:hidden hover:border-b-border hover:text-foreground data-active:border-b-primary data-active:bg-transparent data-active:text-foreground data-active:shadow-none",
);

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Default facility breakdown untuk quotation baru (dummy template, bisa diedit).
 * Section bundling (A/B/C) = 1 card: title = judul section, description = daftar
 * fasilitas (bullet list HTML untuk TipTap). Section ber-harga per-item (D/E)
 * tetap 1 card per item. Baris berharga di-set manualTotal karena total final
 * tidak selalu sama dengan qty × harga.
 */
// Items now come from the per-venue quotation template (auto-loaded on venue
// select). With no template, the form starts with an empty item list.
const DEFAULT_ITEMS: QuotationItemForm[] = [];

const EMPTY_ITEM: QuotationItemForm = {
  title: "",
  description: "",
  qty: "",
  price: "",
  total: "",
  manualTotal: false,
};

const DEFAULT_VALUES: QuotationFormValues = {
  clientName: "",
  clientPhone: "",
  instansi: "",
  salesId: "",
  salesName: "",
  salesPhone: "",
  eventTypeId: "",
  eventTypeName: "",
  details: "",
  time: "",
  place: "",
  venueId: "",
  venue: "",
  eventDate: "",
  eventEndDate: "",
  status: "draft",
  items: DEFAULT_ITEMS.map((it) => ({ ...it })),
  additionals: [],
  discount: "",
  bookingFee: "",
  paymentNote: "",
  cancellationPolicy: "",
  closingNote: "",
  validUntil: "",
  notes: "",
  paymentMethodId: "",
};

// ── Draft persistence (create mode only) ─────────────────────────────────────

const QUOTATION_DRAFT_KEY = "quotation-draft-v4";

type QuotationDraft = {
  values: Partial<QuotationFormValues>;
  signingLocation?: string;
  signatureSales?: string;
  complimentaries?: ComplimentaryRow[];
  bonuses?: BonusRow[];
  prices?: PriceRow[];
  taxDeposits?: TaxDepositRow[];
};

function readQuotationDraft(): QuotationDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUOTATION_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as QuotationDraft) : null;
  } catch {
    return null;
  }
}

function persistQuotationDraft(
  values: Partial<QuotationFormValues>,
  signingLocation?: string,
  signatureSales?: string,
  complimentaries?: ComplimentaryRow[],
  bonuses?: BonusRow[],
  prices?: PriceRow[],
  taxDeposits?: TaxDepositRow[],
) {
  if (typeof window === "undefined") return;
  const { ...rest } = values;
  const hasContent = Object.values(rest).some((v) => {
    if (Array.isArray(v)) return v.some((item: QuotationItemForm) => item.title?.trim());
    return typeof v === "string" && v.trim() !== "";
  });
  if (
    hasContent ||
    signingLocation?.trim() ||
    signatureSales ||
    (complimentaries && complimentaries.length > 0) ||
    (bonuses && bonuses.length > 0) ||
    (prices && prices.length > 0) ||
    (taxDeposits && taxDeposits.length > 0)
  ) {
    const draft: QuotationDraft = { values: rest };
    if (signingLocation !== undefined) draft.signingLocation = signingLocation;
    if (signatureSales !== undefined) draft.signatureSales = signatureSales;
    if (complimentaries !== undefined) draft.complimentaries = complimentaries;
    if (bonuses !== undefined) draft.bonuses = bonuses;
    if (prices !== undefined) draft.prices = prices;
    if (taxDeposits !== undefined) draft.taxDeposits = taxDeposits;
    localStorage.setItem(QUOTATION_DRAFT_KEY, JSON.stringify(draft));
  } else {
    localStorage.removeItem(QUOTATION_DRAFT_KEY);
  }
}

function clearQuotationDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(QUOTATION_DRAFT_KEY);
}

// ── Sub-component: ItemListEditor (DRY untuk step 2 & 3) ────────────────────

interface ItemListEditorProps {
  arrayName: "items" | "additionals";
  fields: Array<{ id: string }>;
  append: (value: QuotationItemForm) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  form: UseFormReturn<QuotationFormValues>;
  expandedSet: Set<string>;
  toggleExpanded: (id: string) => void;
  pendingExpandRef: React.MutableRefObject<boolean>;
  watchedArray: QuotationItemForm[];
}

// ── Sortable item row (inner component used by ItemListEditor) ───────────────

interface SortableItemRowProps {
  fieldItem: { id: string };
  index: number;
  arrayName: "items" | "additionals";
  remove: (index: number) => void;
  form: UseFormReturn<QuotationFormValues>;
  expandedSet: Set<string>;
  toggleExpanded: (id: string) => void;
  watchedArray: QuotationItemForm[];
  recomputeRowTotal: (index: number) => void;
  revertRowTotal: (index: number) => void;
}

function SortableItemRow({
  fieldItem,
  index,
  arrayName,
  remove,
  form,
  expandedSet,
  toggleExpanded,
  watchedArray,
  recomputeRowTotal,
  revertRowTotal,
}: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fieldItem.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const isManual = form.getValues(
    `${arrayName}.${index}.manualTotal` as FieldPath<QuotationFormValues>,
  ) as boolean;
  const isOpen = expandedSet.has(fieldItem.id);
  const titleVal = watchedArray?.[index]?.title ?? "";
  const totalVal = watchedArray?.[index]?.total ?? "";
  const qtyVal = watchedArray?.[index]?.qty ?? "";
  // Header = prefix huruf "A./B./C." (konvensi sheet QUO) ATAU diakhiri ":".
  const titleTrimmed = titleVal.trim();
  const isSectionHeader = /^[A-Z]\.\s/.test(titleTrimmed) || titleTrimmed.endsWith(":");

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Collapsible
        open={isOpen}
        onOpenChange={() => toggleExpanded(fieldItem.id)}
        className="rounded-xl border border-border bg-muted/30 overflow-hidden"
      >
        {/* Accordion header */}
        <div className="flex items-center gap-1 px-3 py-2.5">
          {/* Drag handle — sibling of CollapsibleTrigger, NOT nested inside it */}
          <button
            type="button"
            {...listeners}
            aria-label="Drag to reorder"
            className="shrink-0 p-1.5 rounded-lg cursor-grab touch-none text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:cursor-grabbing"
          >
            <AlignVerticalSpacing weight="BoldDuotone" className="h-4 w-4" />
          </button>

          <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
            <AltArrowDown
              weight="BoldDuotone"
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm truncate",
                  isSectionHeader
                    ? "font-semibold text-foreground"
                    : "font-medium text-foreground",
                  !titleVal && "text-muted-foreground italic",
                )}
              >
                {titleVal || "Untitled item"}
              </p>
              {arrayName === "additionals" && !isOpen && (totalVal || qtyVal) && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {qtyVal ? `Qty ${qtyVal}` : ""}
                  {qtyVal && totalVal ? " · " : ""}
                  {totalVal ? `Rp ${totalVal}` : ""}
                </p>
              )}
            </div>
          </CollapsibleTrigger>

          {/* Delete button — sibling of CollapsibleTrigger, NOT inside it */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              remove(index);
            }}
            aria-label="Delete item"
            className="shrink-0 h-7 w-7 text-destructive hover:bg-destructive/10"
          >
            <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Accordion body */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2 border-t border-border/60">
            <FormField
              control={form.control}
              name={`${arrayName}.${index}.title` as FieldPath<QuotationFormValues>}
              render={({ field }) => (
                <FormItem className="pt-2">
                  <FormLabel className="text-xs text-muted-foreground">
                    Item Title / Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value as string}
                      placeholder="e.g. Ballroom Facilities: or Rice Box"
                      className="w-full"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Description — rich text (TipTap) */}
            <FormField
              control={form.control}
              name={`${arrayName}.${index}.description` as FieldPath<QuotationFormValues>}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">
                    Description{" "}
                    <span className="font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <SimpleEditor
                      value={field.value as string}
                      onChange={field.onChange}
                      placeholder="Detailed item description..."
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {arrayName === "additionals" && (
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name={`${arrayName}.${index}.qty` as FieldPath<QuotationFormValues>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Qty <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          value={field.value as string}
                          onChange={(e) => {
                            field.onChange(e.target.value.replace(/\D/g, ""));
                            recomputeRowTotal(index);
                          }}
                          placeholder="0"
                          inputMode="numeric"
                          className="w-full"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`${arrayName}.${index}.price` as FieldPath<QuotationFormValues>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Price <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          value={field.value as string}
                          onChange={(e) => {
                            field.onChange(formatNumericDisplay(e.target.value));
                            recomputeRowTotal(index);
                          }}
                          placeholder="0 /pax"
                          inputMode="numeric"
                          className="w-full"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`${arrayName}.${index}.total` as FieldPath<QuotationFormValues>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Total</span>
                        {isManual && (
                          <button
                            type="button"
                            onClick={() => revertRowTotal(index)}
                            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline cursor-pointer"
                            aria-label="Revert to automatic"
                          >
                            <Refresh weight="BoldDuotone" className="h-3 w-3" />
                            auto
                          </button>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          value={field.value as string}
                          onChange={(e) => {
                            form.setValue(
                              `${arrayName}.${index}.manualTotal` as FieldPath<QuotationFormValues>,
                              true,
                            );
                            field.onChange(formatNumericDisplay(e.target.value));
                          }}
                          placeholder="0"
                          inputMode="numeric"
                          className={cn(
                            "w-full",
                            isManual && "border-primary/50",
                          )}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ItemListEditor({
  arrayName,
  fields,
  append,
  remove,
  move,
  form,
  expandedSet,
  toggleExpanded,
  pendingExpandRef,
  watchedArray,
}: ItemListEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function recomputeRowTotal(index: number) {
    const item = form.getValues(`${arrayName}.${index}` as FieldPath<QuotationFormValues>);
    const typedItem = item as QuotationItemForm;
    if (typedItem?.manualTotal) return;
    const qty = parseNumericInput(typedItem?.qty ?? "");
    const price = parseNumericInput(typedItem?.price ?? "");
    const total = qty * price;
    form.setValue(
      `${arrayName}.${index}.total` as FieldPath<QuotationFormValues>,
      total > 0 ? total.toLocaleString("id-ID") : "",
      { shouldDirty: true },
    );
  }

  function revertRowTotal(index: number) {
    form.setValue(
      `${arrayName}.${index}.manualTotal` as FieldPath<QuotationFormValues>,
      false,
      { shouldDirty: true },
    );
    recomputeRowTotal(index);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = fields.findIndex((f) => f.id === active.id);
    const toIndex = fields.findIndex((f) => f.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      move(fromIndex, toIndex);
    }
  }

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          {fields.map((fieldItem, index) => (
            <SortableItemRow
              key={fieldItem.id}
              fieldItem={fieldItem}
              index={index}
              arrayName={arrayName}
              remove={remove}
              form={form}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
              watchedArray={watchedArray}
              recomputeRowTotal={recomputeRowTotal}
              revertRowTotal={revertRowTotal}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          append({ ...EMPTY_ITEM });
          pendingExpandRef.current = true;
        }}
        className="w-full rounded-xl border-dashed"
      >
        <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1" />
        Add Item
      </Button>
    </div>
  );
}

// ── Sub-component: PriceRowCard (Step 2 "Harga" tab — same visual language as SortableItemRow) ──

interface PriceRowCardProps {
  row: PriceRow;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  onUpdate: (patch: Partial<PriceRow>) => void;
  onRemove: () => void;
}

function PriceRowCard({ row, isCollapsed, toggleCollapse, onUpdate, onRemove }: PriceRowCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const isOpen = !isCollapsed;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Collapsible
        open={isOpen}
        onOpenChange={toggleCollapse}
        className="rounded-xl border border-border bg-muted/30 overflow-hidden"
      >
        {/* Accordion header */}
        <div className="flex items-center gap-1 px-3 py-2.5">
          {/* Drag handle — sibling of CollapsibleTrigger, NOT nested inside it */}
          <button
            type="button"
            {...listeners}
            aria-label="Drag to reorder"
            className="shrink-0 p-1.5 rounded-lg cursor-grab touch-none text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:cursor-grabbing"
          >
            <AlignVerticalSpacing weight="BoldDuotone" className="h-4 w-4" />
          </button>

          <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
            <AltArrowDown
              weight="BoldDuotone"
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
            <p
              className={cn(
                "flex-1 min-w-0 truncate font-heading text-base italic",
                row.name ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {row.name || "Untitled item"}
            </p>
            {!isOpen && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatRupiah(row.total)}
              </span>
            )}
          </CollapsibleTrigger>

          {/* Delete button — sibling of CollapsibleTrigger, NOT inside it */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Delete price item"
            className="shrink-0 h-7 w-7 text-destructive hover:bg-destructive/10"
          >
            <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Accordion body */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-border/60">
            <div className="pt-2">
              <FormLabel className="text-xs text-muted-foreground">
                Item Title / Name <span className="text-destructive">*</span>
              </FormLabel>
              <Input
                value={row.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g. Ballroom Facilities: or Rice Box"
                className="mt-1.5"
              />
            </div>

            <div>
              <FormLabel className="text-xs text-muted-foreground">Price Type</FormLabel>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdate({ priceType: "QTY" })}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                    row.priceType === "QTY"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  Qty × Price
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ priceType: "NOMINAL", qty: null, price: null })}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                    row.priceType === "NOMINAL"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  Nominal
                </button>
              </div>
            </div>

            {row.priceType === "QTY" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FormLabel className="text-xs text-muted-foreground">
                      Qty <span className="text-destructive">*</span>
                    </FormLabel>
                    <Input
                      value={row.qty ?? ""}
                      onChange={(e) => onUpdate({ qty: parseNumericInput(e.target.value) || null })}
                      placeholder="0"
                      inputMode="numeric"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <FormLabel className="text-xs text-muted-foreground">
                      Price <span className="text-destructive">*</span>
                    </FormLabel>
                    <Input
                      value={row.price ? formatNumericDisplay(row.price) : ""}
                      onChange={(e) =>
                        onUpdate({ price: parseNumericInput(e.target.value) || null })
                      }
                      placeholder="0 /pax"
                      inputMode="numeric"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <FormLabel className="text-xs text-muted-foreground">Total</FormLabel>
                  <Input
                    value={row.total ? formatNumericDisplay(row.total) : ""}
                    readOnly
                    placeholder="0"
                    className="mt-1.5 bg-muted text-muted-foreground"
                  />
                </div>
              </div>
            ) : (
              <div>
                <FormLabel className="text-xs text-muted-foreground">
                  Total <span className="text-destructive">*</span>
                </FormLabel>
                <Input
                  value={row.total ? formatNumericDisplay(row.total) : ""}
                  onChange={(e) => onUpdate({ total: parseNumericInput(e.target.value) })}
                  placeholder="0"
                  inputMode="numeric"
                  className="mt-1.5"
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Sub-component: TaxDepositRowCard (Step 2 — same visual language as PriceRowCard, 2 fields only) ──

interface TaxDepositRowCardProps {
  row: TaxDepositRow;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  onUpdate: (patch: Partial<TaxDepositRow>) => void;
  onRemove: () => void;
}

function TaxDepositRowCard({ row, isCollapsed, toggleCollapse, onUpdate, onRemove }: TaxDepositRowCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const isOpen = !isCollapsed;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Collapsible
        open={isOpen}
        onOpenChange={toggleCollapse}
        className="rounded-xl border border-border bg-muted/30 overflow-hidden"
      >
        {/* Accordion header */}
        <div className="flex items-center gap-1 px-3 py-2.5">
          {/* Drag handle — sibling of CollapsibleTrigger, NOT nested inside it */}
          <button
            type="button"
            {...listeners}
            aria-label="Drag to reorder"
            className="shrink-0 p-1.5 rounded-lg cursor-grab touch-none text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:cursor-grabbing"
          >
            <AlignVerticalSpacing weight="BoldDuotone" className="h-4 w-4" />
          </button>

          <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
            <AltArrowDown
              weight="BoldDuotone"
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
            <p
              className={cn(
                "flex-1 min-w-0 truncate font-heading text-base italic",
                row.name ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {row.name || "Untitled item"}
            </p>
            {!isOpen && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatRupiah(row.nominal)}
              </span>
            )}
          </CollapsibleTrigger>

          {/* Delete button — sibling of CollapsibleTrigger, NOT inside it */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Delete tax & deposit item"
            className="shrink-0 h-7 w-7 text-destructive hover:bg-destructive/10"
          >
            <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Accordion body */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-border/60">
            <div className="pt-2">
              <FormLabel className="text-xs text-muted-foreground">
                Name <span className="text-destructive">*</span>
              </FormLabel>
              <Input
                value={row.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g. PPN 11% or Deposit Ballroom"
                className="mt-1.5"
              />
            </div>

            <div>
              <FormLabel className="text-xs text-muted-foreground">
                Nominal <span className="text-destructive">*</span>
              </FormLabel>
              <Input
                value={row.nominal ? formatNumericDisplay(row.nominal) : ""}
                onChange={(e) => onUpdate({ nominal: parseNumericInput(e.target.value) })}
                placeholder="0"
                inputMode="numeric"
                className="mt-1.5"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function QuotationDrawer({
  open,
  onOpenChange,
  editQuotation,
  onSuccess,
}: QuotationDrawerProps) {
  const isEdit = !!editQuotation;
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const queryClient = useQueryClient();

  // ── Mutation hooks ───────────────────────────────────────────────────────
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const isPending = createQuotation.isPending || updateQuotation.isPending;

  // Expanded state untuk accordion items (step 2)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  // Ref to signal that the next fields update should auto-expand the last item.
  const pendingExpandItemsRef = useRef(false);
  // Ref to signal that the first card should auto-expand on open.
  const pendingExpandFirstItemsRef = useRef(false);
  // Same, but for the "Additional" section (mirror items — separate ref since
  // it's a separate field array).
  const pendingExpandAdditionalsRef = useRef(false);

  // TTD state (step 4)
  const sigSalesRef = useRef<SignatureCanvas>(null);
  const [signatureSales, setSignatureSales] = useState("");
  const [signingLocation, setSigningLocation] = useState("");
  // Signature dataURL pending repaint onto the canvas once it mounts (step 4 only).
  const pendingSignatureRestoreRef = useRef<string | null>(null);

  // Package MICE picker (Step 2 — explode into line items, filtered by venue)
  const [selectedPackageId, setSelectedPackageId] = useState("");

  function toggleItem(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Complimentary (Step 2) ───────────────────────────────────────────────
  const [complimentaries, setComplimentaries] = useState<ComplimentaryRow[]>([]);
  // "none" = collapsed button | "create-new" = inline mini-form
  const [complimentaryMode, setComplimentaryMode] = useState<"none" | "create-new">("none");
  // Tracks which complimentary rows are collapsed (by c.id). Default = none → all open.
  const [collapsedComplimentaries, setCollapsedComplimentaries] = useState<Set<string>>(new Set());
  // Inline "buat baru" form state
  const [createNewComp, setCreateNewComp] = useState({ name: "", price: 0, description: "", isShowPrice: false });
  const [isCreatingComp, setIsCreatingComp] = useState(false);
  const { data: complimentaryResult } = useComplimentaries({ activeOnly: true, pageSize: 100 });
  const complimentaryOptions = complimentaryResult?.items ?? [];
  const { can: canPermission } = usePermissions();
  const canCreateComplimentary = canPermission("complimentary", "create");

  function toggleComplimentaryCollapse(id: string) {
    setCollapsedComplimentaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Bonus (Step 2) ────────────────────────────────────────────────────────
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  // "none" = collapsed button | "create-new" = inline mini-form
  const [bonusMode, setBonusMode] = useState<"none" | "create-new">("none");
  // Tracks which bonus rows are collapsed (by b.id). Default = none → all open.
  const [collapsedBonuses, setCollapsedBonuses] = useState<Set<string>>(new Set());
  // Inline "buat baru" form state
  const [createNewBonus, setCreateNewBonus] = useState({ name: "", price: 0, description: "" });
  const [isCreatingBonus, setIsCreatingBonus] = useState(false);
  const { data: bonusResult } = useBonuses({ activeOnly: true, pageSize: 100 });
  const bonusOptions = bonusResult?.data ?? [];
  const canCreateBonus = canPermission("bonus", "create");

  function toggleBonusCollapse(id: string) {
    setCollapsedBonuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Price (Step 2 — "Harga" tab) ────────────────────────────────────────────
  // UI-only for now — no master data table, no server/DB wiring yet. Plain
  // useState array (not RHF), same architecture as Bonus/Complimentary above.
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [collapsedPrices, setCollapsedPrices] = useState<Set<string>>(new Set());

  function togglePriceCollapse(id: string) {
    setCollapsedPrices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addPriceRow() {
    const id = crypto.randomUUID();
    setPrices((prev) => [
      ...prev,
      { id, name: "", priceType: "QTY", qty: null, price: null, total: 0 },
    ]);
  }

  function removePriceRow(id: string) {
    setPrices((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePriceRow(id: string, patch: Partial<PriceRow>) {
    setPrices((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        if (next.priceType === "QTY") {
          next.total = (next.qty ?? 0) * (next.price ?? 0);
        }
        return next;
      }),
    );
  }

  function movePriceRow(fromIndex: number, toIndex: number) {
    setPrices((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handlePriceDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = prices.findIndex((p) => p.id === active.id);
    const toIndex = prices.findIndex((p) => p.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) movePriceRow(fromIndex, toIndex);
  }

  const priceSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // ── Tax & Deposit (Step 2) ───────────────────────────────────────────────
  // UI-only for now — no master data table, no server/DB wiring yet. Plain
  // useState array (not RHF), same architecture as Price above.
  const [taxDeposits, setTaxDeposits] = useState<TaxDepositRow[]>([]);
  const [collapsedTaxDeposits, setCollapsedTaxDeposits] = useState<Set<string>>(new Set());

  function toggleTaxDepositCollapse(id: string) {
    setCollapsedTaxDeposits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addTaxDepositRow() {
    const id = crypto.randomUUID();
    setTaxDeposits((prev) => [...prev, { id, name: "", nominal: 0 }]);
  }

  function removeTaxDepositRow(id: string) {
    setTaxDeposits((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTaxDepositRow(id: string, patch: Partial<TaxDepositRow>) {
    setTaxDeposits((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function moveTaxDepositRow(fromIndex: number, toIndex: number) {
    setTaxDeposits((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleTaxDepositDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = taxDeposits.findIndex((t) => t.id === active.id);
    const toIndex = taxDeposits.findIndex((t) => t.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) moveTaxDepositRow(fromIndex, toIndex);
  }

  const taxDepositSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // ── Real data hooks ──────────────────────────────────────────────────────
  const { data: venues = [] } = useVenues();
  const { data: eventTypes = [] } = useEventTypes();
  const { users: salesUsers } = useSalesUsers();
  const { user } = useCurrentUser();

  // Sales auto-detect: salesUsers already contains both "sales" & "sales-mice"
  // roles, and s.id === profileId. If the logged-in user is in that list, lock
  // the sales field to themselves; admin/manager picks freely.
  const currentUserIsSales = !!user && salesUsers.some((s) => s.id === user.profileId);

  // ── Instansi lookup (leads search) ──────────────────────────────────────
  interface LeadSearchOption {
    id: string;
    name: string;
    instansi: string | null;
    contactNumbers: unknown;
  }
  const [instansiSearch, setInstansiSearch] = useState("");
  const [debouncedInstansi, setDebouncedInstansi] = useState("");
  const [instansiDropdownOpen, setInstansiDropdownOpen] = useState(false);
  const instansiDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedInstansi(instansiSearch), 300);
    return () => clearTimeout(t);
  }, [instansiSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (instansiDropdownRef.current && !instansiDropdownRef.current.contains(e.target as Node)) {
        setInstansiDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: leadsSearchResult } = useQuery({
    queryKey: ["leads-instansi-search", debouncedInstansi],
    queryFn: async () => {
      const res = await fetch(`/api/daily-activity?search=${encodeURIComponent(debouncedInstansi)}&pageSize=8`);
      if (!res.ok) return { items: [] as LeadSearchOption[] };
      const data = (await res.json()) as { items?: LeadSearchOption[] };
      return data;
    },
    enabled: debouncedInstansi.trim().length >= 1,
    staleTime: 30_000,
  });
  const leadInstansiOptions: LeadSearchOption[] = leadsSearchResult?.items ?? [];

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm<QuotationFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const { fields: itemFields, append: appendItem, remove: removeItem, move: moveItem, replace: replaceItems } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const {
    fields: additionalFields,
    append: appendAdditional,
    remove: removeAdditional,
    move: moveAdditional,
  } = useFieldArray({
    control: form.control,
    name: "additionals",
  });

  /**
   * Load the per-venue quotation template (items + default payment method) and
   * populate the form. Create mode only — never overwrites an existing edit.
   */
  async function loadVenueTemplate(venueId: string) {
    if (isEdit || !venueId) return;
    try {
      const res = await fetch(`/api/quotation-templates/${venueId}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        paymentMethodId?: string | null;
        bookingFee?: number | null;
      };
      // Item template per-venue SENGAJA tidak di-load ke daftar item — item MICE
      // diisi manual lewat dropdown "Pilih Package MICE". Cuma payment method &
      // booking fee (boilerplate Term & Payment) yang di-prefill dari template.
      form.setValue("paymentMethodId", data.paymentMethodId ?? "");
      form.setValue(
        "bookingFee",
        data.bookingFee && data.bookingFee > 0 ? formatNumericDisplay(data.bookingFee) : "",
      );
    } catch {
      /* network error — leave form as-is */
    }
  }

  // Auto-expand the last item when a new one is appended (items).
  useEffect(() => {
    if (pendingExpandItemsRef.current && itemFields.length > 0) {
      const lastId = itemFields[itemFields.length - 1].id;
      setExpandedItems((prev) => new Set([...prev, lastId]));
      pendingExpandItemsRef.current = false;
    }
  }, [itemFields]);

  // Auto-expand the FIRST card on open (at least one card visible).
  useEffect(() => {
    if (pendingExpandFirstItemsRef.current && itemFields.length > 0) {
      const firstId = itemFields[0].id;
      setExpandedItems((prev) => new Set([...prev, firstId]));
      pendingExpandFirstItemsRef.current = false;
    }
  }, [itemFields]);

  // Auto-expand the last item when a new one is appended (additionals).
  useEffect(() => {
    if (pendingExpandAdditionalsRef.current && additionalFields.length > 0) {
      const lastId = additionalFields[additionalFields.length - 1].id;
      setExpandedItems((prev) => new Set([...prev, lastId]));
      pendingExpandAdditionalsRef.current = false;
    }
  }, [additionalFields]);

  const watchedClientName = form.watch("clientName");
  const watchedSalesId = form.watch("salesId");
  const watchedSalesPhone = form.watch("salesPhone");
  const watchedVenueId = form.watch("venueId");
  const watchedItems = form.watch("items");
  const watchedAdditionals = form.watch("additionals");
  const watchedDiscount = form.watch("discount");
  const watchedEventTypeId = form.watch("eventTypeId");
  const watchedEventDate = form.watch("eventDate");
  const watchedPaymentMethodId = form.watch("paymentMethodId");

  // ── Selected payment method detail (Bank / Account Number / Account Name) ──
  // Same queryKey/params shape as BankAccountSelect so this shares its cache
  // entry instead of firing a second network request.
  interface PaymentMethodDetail {
    id: string;
    bankName: string;
    bankAccountNumber: string;
    bankRecipient: string;
  }
  const { data: paymentMethodsData } = useQuery<PaymentMethodDetail[]>({
    queryKey: ["payment-methods", watchedVenueId || "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (watchedVenueId) params.set("venueId", watchedVenueId);
      const r = await fetch(`/api/payment-methods?${params}`);
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d.data) ? d.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const selectedPaymentMethod = paymentMethodsData?.find((pm) => pm.id === watchedPaymentMethodId);

  // ── MICE packages available for this quotation's venue ───────────────────
  interface MicePackageQuotationOption {
    id: string;
    packageName: string;
    pax: number;
    venue: { id: string; name: string } | null;
    miceItems: Array<{
      id: string;
      itemName: string;
      itemDescription: string;
      sortOrder: number;
    }>;
  }
  const { data: micePackagesData } = useQuery({
    queryKey: ["mice-packages-quotation", watchedVenueId],
    queryFn: async () => {
      const qs = `/api/packages?forQuotation=true&category=MICE&venueId=${encodeURIComponent(watchedVenueId)}`;
      const res = await fetch(qs);
      if (!res.ok) return [] as MicePackageQuotationOption[];
      return (await res.json()) as MicePackageQuotationOption[];
    },
    enabled: open && !!watchedVenueId,
    staleTime: 30_000,
  });
  const micePackages: MicePackageQuotationOption[] = micePackagesData ?? [];

  /**
   * Explode a package's items into editable quotation line items and REPLACE
   * the entire items list with them (overwrites any existing template/manual
   * items). Package MICE items no longer carry pricing (Item Paket step only
   * has nama + detail) — qty/price/total start blank and are filled manually.
   */
  function handleApplyPackage(packageId: string) {
    const pkg = micePackages.find((p) => p.id === packageId);
    if (!pkg) return;
    if (pkg.miceItems.length === 0) {
      toast.error("This package doesn't have any items yet.");
      return;
    }
    const newItems = pkg.miceItems.map((item) => ({
      title: item.itemName,
      description: item.itemDescription,
      qty: "",
      price: "",
      total: "",
      manualTotal: false,
    }));
    replaceItems(newItems);
    toast.success(
      `${pkg.miceItems.length} item(s) from package "${pkg.packageName}" applied (replacing previous items). Fill in qty & price manually.`,
    );
    setSelectedPackageId("");
  }

  // TEMP — testing UI Step 1: skip required-field gate so "Lanjut" can be clicked even with
  // incomplete fields. Set to false / remove once Step 1's data logic is finalized.
  const TEMP_SKIP_STEP1_REQUIRED_GATE = true;

  const isStep1Incomplete =
    !TEMP_SKIP_STEP1_REQUIRED_GATE &&
    (!watchedClientName?.trim() ||
      !watchedSalesId ||
      !watchedEventTypeId ||
      !watchedEventDate);

  // Step 6 (signature) requires a signature + signing location.
  const isSignatureComplete = !!signatureSales && !!signingLocation.trim();

  // Name shown in the locked sales field — resolves from the current salesId so
  // edit mode displays the record's actual sales (not the logged-in user).
  const lockedSalesName =
    salesUsers.find((s) => s.id === watchedSalesId)?.fullName ??
    (currentUserIsSales ? (user?.name ?? "—") : "—");

  // ── Auto-fill sales name + phone when salesId changes ──────────────────
  useEffect(() => {
    const matched = salesUsers.find((u) => u.id === watchedSalesId);
    if (matched) {
      form.setValue("salesName", matched.fullName ?? "");
      form.setValue("salesPhone", matched.phoneNumber ?? "");
    }
  }, [watchedSalesId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Venue availability ───────────────────────────────────────────────────
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [availLoading, setAvailLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!watchedVenueId) {
      setAvailability({});
      return;
    }
    // NOTE: session reset dilakukan di venue picker onChange (saat venue benar-benar
    // berganti), BUKAN di sini — kalau di-reset di effect ini, session hasil restore
    // draft / navigasi bulan kalender ikut kehapus.
    setAvailLoading(true);
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    const params = new URLSearchParams({ month });
    fetch(`/api/venues/${watchedVenueId}/availability?${params}`)
      .then((r) => r.json())
      .then((data: Record<string, DayAvail>) => setAvailability(data))
      .catch(() => setAvailability({}))
      .finally(() => setAvailLoading(false));
  }, [watchedVenueId, visibleMonth]);

  function getDateStatus(d: Date): "available" | "partial" | "unavailable" | null {
    const key = format(d, "yyyy-MM-dd");
    const a = availability[key];
    if (!a) return null;
    const count = [a.morning, a.evening, a.fullday].filter(Boolean).length;
    if (count === 0) return "unavailable";
    if (count === 3) return "available";
    return "partial";
  }

  // ── Event types — quotation is MICE-only ────────────────────────────────
  const filteredEventTypes = eventTypes.filter((et) => et.category === "MICE");

  async function handleAddEventType(name: string) {
    try {
      const res = await fetch("/api/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category: "MICE" }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to create event type");
        return;
      }
      const created = (await res.json()) as { id: string; name: string; category: string; sortOrder: number; isActive: boolean; code: string; createdAt: string };
      // Invalidate cache so the hook reflects the new entry
      await queryClient.invalidateQueries({ queryKey: ["event-types"] });
      // Immediately select the new event type
      form.setValue("eventTypeId", created.id);
      form.setValue("eventTypeName", created.name);
      toast.success(`Event type "${created.name}" added`);
    } catch {
      toast.error("Failed to create event type");
    }
  }

  // ── Item totals ──────────────────────────────────────────────────────────
  const itemsSubtotal = (watchedItems ?? []).reduce(
    (sum, it) => sum + parseNumericInput(it?.total ?? ""),
    0,
  );
  const additionalsSubtotal = (watchedAdditionals ?? []).reduce(
    (sum, it) => sum + parseNumericInput(it?.total ?? ""),
    0,
  );
  const subtotal = itemsSubtotal + additionalsSubtotal;
  const discountNum = parseNumericInput(watchedDiscount);
  const grandTotal = Math.max(0, subtotal - discountNum);

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStep(1);
    // Reset accordion state; auto-expand the FIRST card so at least one card is
    // open when the user reaches step 2.
    setExpandedItems(new Set());
    pendingExpandFirstItemsRef.current = true;
    // Reset signature state
    sigSalesRef.current?.clear();
    setSignatureSales("");
    setSigningLocation("");
    pendingSignatureRestoreRef.current = null;
    // Reset instansi lookup state
    setInstansiSearch("");
    setDebouncedInstansi("");
    setInstansiDropdownOpen(false);
    // Reset Package MICE picker state
    setSelectedPackageId("");
    // Reset Complimentary state
    setComplimentaries([]);
    setComplimentaryMode("none");
    setCollapsedComplimentaries(new Set());
    setCreateNewComp({ name: "", price: 0, description: "", isShowPrice: false });
    setIsCreatingComp(false);
    // Reset Bonus state
    setBonuses([]);
    setBonusMode("none");
    setCollapsedBonuses(new Set());
    setCreateNewBonus({ name: "", price: 0, description: "" });
    setIsCreatingBonus(false);
    // Reset Price state (UI-only, never restored from editQuotation)
    setPrices([]);
    setCollapsedPrices(new Set());
    // Reset Tax & Deposit state (UI-only, never restored from editQuotation)
    setTaxDeposits([]);
    setCollapsedTaxDeposits(new Set());

    if (editQuotation) {
      const matchedVenue = venues.find((v) => v.name === editQuotation.venue);
      const matchedSales = salesUsers.find((u) => u.fullName === editQuotation.salesName);
      const items: QuotationItemForm[] =
        editQuotation.items && editQuotation.items.length > 0
          ? editQuotation.items.map((it) => ({
              title: it.description, // QuotationLineItem.description = DB title (see mapper)
              description: it.richDescription ?? "", // TipTap rich HTML
              qty: it.qty > 0 ? String(it.qty) : "",
              price: it.price > 0 ? formatNumericDisplay(it.price) : "",
              total: it.total > 0 ? formatNumericDisplay(it.total) : "",
              manualTotal: !!it.manualTotal,
            }))
          : [{ ...EMPTY_ITEM }];
      // Restore signature fields
      if (editQuotation.signingLocation) setSigningLocation(editQuotation.signingLocation);
      form.reset({
        clientName: editQuotation.leadName,
        clientPhone: editQuotation.leadPhone?.trim() ?? "",
        instansi: editQuotation.instansi ?? "",
        salesId: matchedSales?.id ?? "",
        salesName: editQuotation.salesName,
        salesPhone: editQuotation.salesPhone ?? "",
        eventTypeId: "",
        eventTypeName: editQuotation.eventType,
        details: editQuotation.details ?? "",
        time: editQuotation.time ?? "",
        place: editQuotation.place ?? "",
        venueId: matchedVenue?.id ?? "",
        venue: editQuotation.venue,
        eventDate: editQuotation.eventDate,
        eventEndDate: editQuotation.eventEndDate ?? "",
        status: (editQuotation.status as QuotationStatusValue) ?? "draft",
        items,
        // Additional belum ada di server/DB — quotation existing selalu mulai
        // kosong di sini (murni UI state, tidak dibaca dari editQuotation).
        additionals: [],
        discount:
          editQuotation.discount > 0
            ? formatNumericDisplay(editQuotation.discount)
            : "",
        bookingFee:
          editQuotation.bookingFee && editQuotation.bookingFee > 0
            ? formatNumericDisplay(editQuotation.bookingFee)
            : "",
        paymentNote: editQuotation.paymentNote ?? "",
        cancellationPolicy: editQuotation.cancellationPolicy ?? "",
        closingNote: editQuotation.closingNote ?? "",
        validUntil: editQuotation.validUntil,
        notes: editQuotation.notes,
        paymentMethodId: editQuotation.paymentMethodId ?? "",
      });
      // Sync instansi search input with existing value
      setInstansiSearch(editQuotation.instansi ?? "");
      // Restore complimentaries
      setComplimentaries(
        (editQuotation.complimentaries ?? []).map((c) => ({
          id: crypto.randomUUID(),
          complimentaryId: c.complimentaryId ?? null,
          name: c.name,
          price: c.price,
          isShowPrice: c.isShowPrice,
          description: c.description ?? "",
          qty: c.qty,
        })),
      );
      // Restore bonuses
      setBonuses(
        (editQuotation.bonuses ?? []).map((b) => ({
          id: crypto.randomUUID(),
          bonusId: b.bonusId ?? null,
          name: b.name,
          price: b.price,
          description: b.description ?? "",
          qty: b.qty,
        })),
      );
    } else {
      const draft = readQuotationDraft();
      if (draft?.values) {
        // Draft lama bisa berisi items kosong dari versi sebelum template default
        // ada. Kalau tidak ada item yang berisi, pakai DEFAULT_ITEMS biar template
        // tetap muncul saat create.
        const draftItems = draft.values.items;
        const draftHasItems =
          Array.isArray(draftItems) &&
          draftItems.some((it) => it?.title?.trim());
        form.reset({
          ...DEFAULT_VALUES,
          ...draft.values,
          items: draftHasItems
            ? draftItems
            : DEFAULT_ITEMS.map((it) => ({ ...it })),
        });
        // Sync instansi search input — form.reset di atas sudah restore field
        // value-nya, tapi kotak input pakai instansiSearch state terpisah (buat
        // dropdown autocomplete) yang harus disamakan manual.
        setInstansiSearch(draft.values.instansi ?? "");
        // Restore signingLocation dari draft
        if (draft.signingLocation) {
          setSigningLocation(draft.signingLocation);
        }
        // Restore signature — canvas belum mount di step 1, jadi dataURL-nya
        // ditahan dulu dan baru di-paint saat step 4 aktif (lihat effect di bawah).
        if (draft.signatureSales) {
          setSignatureSales(draft.signatureSales);
          pendingSignatureRestoreRef.current = draft.signatureSales;
        }
        // Restore complimentaries dari draft
        setComplimentaries(draft.complimentaries ?? []);
        // Restore bonuses dari draft
        setBonuses(draft.bonuses ?? []);
        // Restore prices dari draft (UI-only)
        setPrices(draft.prices ?? []);
        // Restore tax & deposit dari draft (UI-only)
        setTaxDeposits(draft.taxDeposits ?? []);
      } else {
        form.reset({
          ...DEFAULT_VALUES,
          items: DEFAULT_ITEMS.map((it) => ({ ...it })),
        });
      }
    }
  }, [open, editQuotation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create mode: force-assign the sales field to the logged-in sales user (also
  // covers salesUsers loading after the reset effect above has already run).
  useEffect(() => {
    if (open && !isEdit && currentUserIsSales && user?.profileId) {
      form.setValue("salesId", user.profileId);
    }
  }, [open, isEdit, currentUserIsSales, user?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist draft on form changes (create mode only).
  useEffect(() => {
    if (!open || isEdit) return;
    const sub = form.watch((values) => {
      persistQuotationDraft(values as Partial<QuotationFormValues>, signingLocation, signatureSales, complimentaries, bonuses, prices, taxDeposits);
    });
    return () => sub.unsubscribe();
  }, [open, isEdit, signingLocation, signatureSales, complimentaries, bonuses, prices, taxDeposits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist signingLocation/signatureSales/complimentaries/bonuses/prices/taxDeposits changes to draft (not triggered by form.watch).
  useEffect(() => {
    if (!open || isEdit) return;
    persistQuotationDraft(form.getValues(), signingLocation, signatureSales, complimentaries, bonuses, prices, taxDeposits);
  }, [signingLocation, signatureSales, complimentaries, bonuses, prices, taxDeposits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repaint the restored signature once the canvas mounts (step 6 only — see the
  // "Mount only when step 6 is active" note on SignatureCanvas below).
  useEffect(() => {
    if (step !== 6 || !pendingSignatureRestoreRef.current) return;
    sigSalesRef.current?.fromDataURL(pendingSignatureRestoreRef.current);
    pendingSignatureRestoreRef.current = null;
  }, [step]);

  // ── Navigation ───────────────────────────────────────────────────────────
  async function handleNext() {
    if (step === 1) {
      if (TEMP_SKIP_STEP1_REQUIRED_GATE) {
        setStep(2);
        return;
      }
      const step1Fields = [
        "clientName",
        "salesId",
        "venueId",
        "eventTypeId",
        "eventDate",
      ] as const;
      const ok = await form.trigger([...step1Fields]);
      if (ok) setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      setStep(6);
    }
  }

  function handlePrevious() {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      setStep(3);
    } else if (step === 5) {
      setStep(4);
    } else if (step === 6) {
      // Clear signature saat kembali dari step TTD
      sigSalesRef.current?.clear();
      setSignatureSales("");
      setStep(5);
    }
  }

  async function onSubmit(values: QuotationFormValues) {
    // Parse items — form stores qty/price/total as display strings ("1.000.000") → parse to int
    const items = values.items.map((it, idx) => ({
      title: it.title,
      description: it.description || null,
      qty: parseNumericInput(it.qty),
      price: parseNumericInput(it.price),
      total: parseNumericInput(it.total),
      manualTotal: it.manualTotal,
      sortOrder: idx,
    }));

    const discountNum = parseNumericInput(values.discount);
    const bookingFeeNum = parseNumericInput(values.bookingFee);

    const payload = {
      clientName: values.clientName,
      clientPhone: values.clientPhone || null,
      instansi: values.instansi || null,
      salesId: values.salesId,
      venueId: values.venueId,
      venueName: values.venue || null,
      eventTypeId: values.eventTypeId || null,
      eventTypeName: values.eventTypeName || null,
      category: "MICE" as const,
      weddingSession: null,
      complimentaries: complimentaries.map((c, i) => ({
        complimentaryId: c.complimentaryId,
        name: c.name,
        price: c.price,
        isShowPrice: c.isShowPrice,
        description: c.description || null,
        qty: c.qty,
        sortOrder: i,
      })),
      bonuses: bonuses.map((b, i) => ({
        bonusId: b.bonusId,
        name: b.name,
        price: b.price,
        description: b.description || null,
        qty: b.qty,
        sortOrder: i,
      })),
      eventDate: values.eventDate || null,
      eventEndDate: values.eventEndDate || null,
      time: values.time || null,
      place: values.place || null,
      details: values.details || null,
      items,
      discount: discountNum,
      bookingFee: bookingFeeNum > 0 ? bookingFeeNum : null,
      paymentNote: values.paymentNote || null,
      cancellationPolicy: values.cancellationPolicy || null,
      closingNote: values.closingNote || null,
      validUntil: values.validUntil,
      notes: values.notes || null,
      paymentMethodId: values.paymentMethodId || null,
      signingLocation: signingLocation || null,
      signatureSales: signatureSales || null,
      ...(isEdit && { status: values.status }),
    };

    let result: { success: boolean; error?: string };

    if (isEdit && editQuotation) {
      result = await updateQuotation.mutateAsync({ ...payload, id: editQuotation.id });
    } else {
      result = await createQuotation.mutateAsync(payload);
    }

    if (!result.success) {
      toast.error(result.error ?? "Failed to save quotation.");
      return;
    }

    if (!isEdit) clearQuotationDraft();
    toast.success(
      isEdit ? "Quotation updated successfully." : "Quotation saved successfully.",
    );
    // Reset signature setelah submit
    sigSalesRef.current?.clear();
    setSignatureSales("");
    setSigningLocation("");
    // Reset complimentary state setelah submit sukses
    setComplimentaries([]);
    setComplimentaryMode("none");
    setCollapsedComplimentaries(new Set());
    // Reset bonus state setelah submit sukses
    setBonuses([]);
    setBonusMode("none");
    setCollapsedBonuses(new Set());
    // Reset price state setelah submit sukses
    setPrices([]);
    setCollapsedPrices(new Set());
    // Reset tax & deposit state setelah submit sukses
    setTaxDeposits([]);
    setCollapsedTaxDeposits(new Set());
    if (!isEdit) onSuccess?.();
    onOpenChange(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Quotation" : "Add Quotation"}
      maxWidth="sm:max-w-2xl"
      steps={step}
      totalSteps={6}
      stepperType="short"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-2">
          <Form {...form}>
            <form className="space-y-3 pb-2">

              {/* ════════════════ STEP 1 — INFORMASI ════════════════ */}
              <div className={cn(step !== 1 && "hidden", "space-y-4")}>

                {/* ── Klien ───────────────────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground mb-1">Client</p>

                  {/* Perusahaan / Instansi */}
                  <div ref={instansiDropdownRef} className="w-full">
                    <FormField
                      control={form.control}
                      name="instansi"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>
                            Company / Institution{" "}
                            <span className="font-normal text-muted-foreground">(optional)</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                value={instansiSearch}
                                onChange={(e) => {
                                  setInstansiSearch(e.target.value);
                                  field.onChange(e.target.value);
                                  setInstansiDropdownOpen(true);
                                }}
                                onFocus={() => {
                                  if (instansiSearch.trim()) setInstansiDropdownOpen(true);
                                }}
                                placeholder="Type company / institution name..."
                                className="w-full"
                                autoComplete="off"
                              />
                              {instansiDropdownOpen && debouncedInstansi.trim().length >= 1 && leadInstansiOptions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 max-h-64 overflow-auto rounded-xl border bg-background shadow-md">
                                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    From Daily Activity
                                  </p>
                                  {leadInstansiOptions.map((lead) => (
                                    <div
                                      key={lead.id}
                                      className="cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setInstansiSearch(lead.name);
                                        field.onChange(lead.name);
                                        setInstansiDropdownOpen(false);
                                        const [pic] = parseContactNumbers(lead.contactNumbers);
                                        form.setValue("clientName", pic?.label ?? "", {
                                          shouldDirty: true,
                                          shouldValidate: true,
                                        });
                                        form.setValue("clientPhone", pic?.number ?? "", {
                                          shouldDirty: true,
                                          shouldValidate: true,
                                        });
                                      }}
                                    >
                                      <p className="font-medium">{lead.name}</p>
                                      {lead.instansi && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {lead.instansi}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* PIC / Nama Kontak */}
                  <FormField
                    control={form.control}
                    name="clientName"
                    rules={{ required: "PIC name is required" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          PIC Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Client contact / PIC name..." className="w-full" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* No. HP / WA */}
                  <FormField
                    control={form.control}
                    name="clientPhone"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Phone / WA Number{" "}
                          <span className="font-normal text-muted-foreground">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <PhoneInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* ── Sales ───────────────────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground mb-1">Sales</p>

                  {currentUserIsSales ? (
                    <div className="w-full">
                      <FormLabel className={LABEL_CLASS}>
                        Sales Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="mt-1.5 flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
                        {lockedSalesName}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Recorded under your name.
                      </p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="salesId"
                      rules={{ required: "Sales must be selected" }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>
                            Sales Name <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? "" }))}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Select sales..."
                              searchPlaceholder="Search sales..."
                              emptyText="Sales not found"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* No. HP Sales */}
                  <FormField
                    control={form.control}
                    name="salesPhone"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Sales Phone Number</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Enter sales phone number..."
                          />
                        </FormControl>
                        {!watchedSalesPhone?.trim() && (
                          <p className="text-xs text-muted-foreground">
                            Sales profile has no number yet — enter manually.
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                </div>

                {/* ── Event ───────────────────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">Event Details</p>
                    <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      MICE
                    </span>
                  </div>

                  {/* Venue — PERTAMA karena availability kalender bergantung venue */}
                  <FormField
                    control={form.control}
                    name="venueId"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Venue</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={venues.map((v) => ({ id: v.id, name: v.name }))}
                            value={field.value}
                            onChange={(id) => {
                              field.onChange(id);
                              const matched = venues.find((v) => v.id === id);
                              form.setValue("venue", matched?.name ?? "");
                              form.setValue("eventDate", "");
                              form.setValue("eventEndDate", "");
                              void loadVenueTemplate(id);
                            }}
                            placeholder="Select / search venue..."
                            searchPlaceholder="Search venue..."
                            emptyText="Venue not found"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Jenis Event */}
                  <FormField
                    control={form.control}
                    name="eventTypeId"
                    rules={{ required: "Event type must be selected" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Event Type <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={filteredEventTypes.map((et) => ({ id: et.id, name: et.name }))}
                            value={field.value}
                            onChange={(v) => {
                              field.onChange(v);
                              const matched = filteredEventTypes.find((et) => et.id === v);
                              form.setValue("eventTypeName", matched?.name ?? "");
                            }}
                            placeholder="Select event type..."
                            searchPlaceholder="Search / type new name..."
                            emptyText="No MICE event types yet"
                            onAdd={handleAddEventType}
                            addingLabel="Adding event type..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Event Date — bisa single atau rentang (klik 1 tanggal = single, klik ke-2 = rentang) */}
                  <FormField
                    control={form.control}
                    name="eventDate"
                    rules={{ required: "Event date is required" }}
                    render={({ field }) => {
                      const watchedEnd = form.watch("eventEndDate");
                      const selected: DateRange | undefined = field.value
                        ? {
                            from: new Date(field.value + "T00:00:00"),
                            to: watchedEnd ? new Date(watchedEnd + "T00:00:00") : undefined,
                          }
                        : undefined;

                      function fmt(date: Date): string {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, "0");
                        const d = String(date.getDate()).padStart(2, "0");
                        return `${y}-${m}-${d}`;
                      }

                      let triggerLabel: string;
                      if (!field.value) {
                        triggerLabel = "Select event date";
                      } else if (!watchedEnd || watchedEnd === field.value) {
                        triggerLabel = format(parseDateOnly(field.value), "dd MMM yyyy");
                      } else {
                        const from = parseDateOnly(field.value);
                        const to = parseDateOnly(watchedEnd);
                        const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
                        triggerLabel = sameMonth
                          ? `${format(from, "dd")} - ${format(to, "dd MMM yyyy")}`
                          : `${format(from, "dd MMM yyyy")} - ${format(to, "dd MMM yyyy")}`;
                      }

                      return (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>
                            Event Date <span className="text-destructive">*</span>
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger
                              render={
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  <CalendarSolarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                                  {triggerLabel}
                                </Button>
                              }
                            />
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="range"
                                numberOfMonths={2}
                                captionLayout="dropdown"
                                selected={selected}
                                onSelect={(range: DateRange | undefined) => {
                                  field.onChange(range?.from ? fmt(range.from) : "");
                                  form.setValue("eventEndDate", range?.to ? fmt(range.to) : "");
                                }}
                                disabled={(d) => getDateStatus(d) === "unavailable"}
                                fromYear={new Date().getFullYear() - 10}
                                toYear={new Date().getFullYear() + 5}
                                defaultMonth={field.value ? new Date(field.value + "T00:00:00") : new Date()}
                                onMonthChange={setVisibleMonth}
                                modifiers={{
                                  available: (d) => !!watchedVenueId && getDateStatus(d) === "available",
                                  partial: (d) => !!watchedVenueId && getDateStatus(d) === "partial",
                                  unavailable: (d) => !!watchedVenueId && getDateStatus(d) === "unavailable",
                                }}
                                modifiersClassNames={{
                                  available: "day-available",
                                  partial: "day-partial",
                                  unavailable: "day-unavailable",
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          {availLoading && (
                            <p className="text-xs text-muted-foreground mt-1">Checking availability...</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Click 1 date for a single date, click a 2nd date for a range.
                          </p>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {/* Waktu */}
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Time{" "}
                          <span className="font-normal text-muted-foreground">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <TimeRangePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select time (can be a range)..."
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Tempat */}
                  <FormField
                    control={form.control}
                    name="place"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Place{" "}
                          <span className="font-normal text-muted-foreground">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Ballroom, Outdoor..." className="w-full" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Keterangan / Details */}
                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Notes{" "}
                          <span className="font-normal text-muted-foreground">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder="e.g. Venue Only, Full Service, special notes..."
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* ════════════════ STEP 2 — ITEMS + RINGKASAN ════════════════ */}
              <div className={cn(step !== 2 && "hidden", "space-y-4")}>
                {/* ── Pilih Package MICE ────────────────────────────── */}
                {watchedVenueId && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Box weight="BoldDuotone" className="h-4 w-4 text-primary" />
                      <p className={LABEL_CLASS}>Select MICE Package</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {micePackages.length === 0
                        ? "No approved MICE packages for this venue yet."
                        : "Select a package — its items will REPLACE the item list below (can be edited afterward)."}
                    </p>
                    <SearchableSelect
                      options={micePackages.map((p) => ({ id: p.id, name: p.packageName }))}
                      value={selectedPackageId}
                      onChange={(id) => {
                        setSelectedPackageId(id);
                        handleApplyPackage(id);
                      }}
                      placeholder="Search & select a MICE package for this venue..."
                      searchPlaceholder="Search package..."
                      emptyText="No MICE packages"
                    />
                  </div>
                )}

                {/* ── Harga / Items / Additional / Tax & Deposit ──────── */}
                <Tabs defaultValue="harga">
                  <TabsList
                    variant="line"
                    className="h-auto w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto scrollbar-hide rounded-none border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-auto"
                  >
                    <TabsTrigger value="harga" className={TAB_TRIGGER_CLASS}>
                      <Calculator weight="BoldDuotone" className="size-4 shrink-0" />
                      Harga
                    </TabsTrigger>
                    <TabsTrigger value="items" className={TAB_TRIGGER_CLASS}>
                      <BillList weight="BoldDuotone" className="size-4 shrink-0" />
                      Items
                    </TabsTrigger>
                    <TabsTrigger value="additionals" className={TAB_TRIGGER_CLASS}>
                      <AddCircle weight="BoldDuotone" className="size-4 shrink-0" />
                      Additional
                    </TabsTrigger>
                    <TabsTrigger value="tax-deposit" className={TAB_TRIGGER_CLASS}>
                      <SafeSquare weight="BoldDuotone" className="size-4 shrink-0" />
                      Tax & Deposit
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Harga (UI-only, no server/DB yet) ────────────────── */}
                  <TabsContent value="harga" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                    {prices.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No price items yet. Click &quot;Add Item&quot; to add one.
                      </p>
                    ) : (
                      <DndContext
                        sensors={priceSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handlePriceDragEnd}
                      >
                        <SortableContext
                          items={prices.map((p) => p.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {prices.map((row) => (
                              <PriceRowCard
                                key={row.id}
                                row={row}
                                isCollapsed={collapsedPrices.has(row.id)}
                                toggleCollapse={() => togglePriceCollapse(row.id)}
                                onUpdate={(patch) => updatePriceRow(row.id, patch)}
                                onRemove={() => removePriceRow(row.id)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={addPriceRow}
                      className="w-full rounded-xl border-dashed"
                    >
                      <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </TabsContent>

                  {/* ── Items ─────────────────────────────────────────── */}
                  <TabsContent value="items" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                    {itemsSubtotal > 0 && (
                      <div className="flex justify-end">
                        <span className="text-xs font-medium tabular-nums text-muted-foreground">
                          {formatRupiah(itemsSubtotal)}
                        </span>
                      </div>
                    )}

                    <ItemListEditor
                      arrayName="items"
                      fields={itemFields}
                      append={appendItem}
                      remove={removeItem}
                      move={moveItem}
                      form={form}
                      expandedSet={expandedItems}
                      toggleExpanded={toggleItem}
                      pendingExpandRef={pendingExpandItemsRef}
                      watchedArray={watchedItems ?? []}
                    />
                  </TabsContent>

                  {/* ── Additional ────────────────────────────────────── */}
                  <TabsContent value="additionals" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                    {additionalsSubtotal > 0 && (
                      <div className="flex items-center justify-end gap-2">
                        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                          {formatRupiah(additionalsSubtotal)}
                        </span>
                      </div>
                    )}

                    <ItemListEditor
                      arrayName="additionals"
                      fields={additionalFields}
                      append={appendAdditional}
                      remove={removeAdditional}
                      move={moveAdditional}
                      form={form}
                      expandedSet={expandedItems}
                      toggleExpanded={toggleItem}
                      pendingExpandRef={pendingExpandAdditionalsRef}
                      watchedArray={watchedAdditionals ?? []}
                    />
                  </TabsContent>

                  {/* ── Tax & Deposit ─────────────────────────────────── */}
                  <TabsContent value="tax-deposit" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                    {taxDeposits.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No tax & deposit items yet. Click &quot;Add Item&quot; to add one.
                      </p>
                    ) : (
                      <DndContext
                        sensors={taxDepositSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleTaxDepositDragEnd}
                      >
                        <SortableContext
                          items={taxDeposits.map((t) => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {taxDeposits.map((row) => (
                              <TaxDepositRowCard
                                key={row.id}
                                row={row}
                                isCollapsed={collapsedTaxDeposits.has(row.id)}
                                toggleCollapse={() => toggleTaxDepositCollapse(row.id)}
                                onUpdate={(patch) => updateTaxDepositRow(row.id, patch)}
                                onRemove={() => removeTaxDepositRow(row.id)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={addTaxDepositRow}
                      className="w-full rounded-xl border-dashed"
                    >
                      <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </TabsContent>

                </Tabs>
              </div>

              {/* ════════════════ STEP 3 — BONUS & COMPLIMENTARY ════════════════ */}
              <div className={cn(step !== 3 && "hidden", "space-y-3")}>
                <Tabs defaultValue="bonus">
                  <TabsList
                    variant="line"
                    className="h-auto w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto scrollbar-hide rounded-none border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-auto"
                  >
                    <TabsTrigger value="bonus" className={TAB_TRIGGER_CLASS}>
                      <MedalStar weight="BoldDuotone" className="size-4 shrink-0" />
                      Bonus
                    </TabsTrigger>
                    <TabsTrigger value="complimentary" className={TAB_TRIGGER_CLASS}>
                      <Gift weight="BoldDuotone" className="size-4 shrink-0" />
                      Complimentary
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Bonus ─────────────────────────────────────────── */}
                  <TabsContent value="bonus" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                    {/* Pilih dari daftar (dropdown inline) — "Tambah" muncul di dalam dropdown saat search tidak exact-match */}
                    {bonusMode !== "create-new" && (
                      <BonusSelect
                        options={bonusOptions
                          .filter((opt) => !bonuses.some((b) => b.bonusId === opt.id))
                          .map((opt) => ({ id: opt.id, name: opt.name, badge: formatRupiah(opt.price), description: opt.description ?? undefined }))}
                        value=""
                        onChange={(selectedId) => {
                          const found = bonusOptions.find((x) => x.id === selectedId);
                          if (found) {
                            setBonuses((prev) => [{
                              id: crypto.randomUUID(),
                              bonusId: found.id,
                              name: found.name,
                              price: found.price,
                              description: found.description ?? "",
                              qty: 1,
                            }, ...prev]);
                          }
                        }}
                        onAddTrigger={canCreateBonus ? (text) => {
                          setBonusMode("create-new");
                          setCreateNewBonus({ name: text, price: 0, description: "" });
                        } : undefined}
                        placeholder="Select from bonus list..."
                        searchPlaceholder="Search bonus..."
                        emptyText="No bonus"
                      />
                    )}

                    {/* Mode: buat baru */}
                    {bonusMode === "create-new" && (
                      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Add a new bonus to the master list</p>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setBonusMode("none")}
                          >
                            Cancel
                          </button>
                        </div>

                        {/* Nama */}
                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">
                            Name <span className="text-destructive">*</span>
                          </label>
                          <Input
                            value={createNewBonus.name}
                            onChange={(e) => setCreateNewBonus((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Bonus name..."
                            className="h-8 text-sm"
                          />
                        </div>

                        {/* Harga */}
                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">
                            Price <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={createNewBonus.price ? formatNumericDisplay(createNewBonus.price) : ""}
                              onChange={(e) => {
                                const n = parseNumericInput(e.target.value);
                                setCreateNewBonus((p) => ({ ...p, price: n }));
                              }}
                              placeholder="Price"
                              inputMode="numeric"
                              className="h-8 text-sm pl-8"
                            />
                          </div>
                        </div>

                        {/* Deskripsi */}
                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">Description</label>
                          <Textarea
                            value={createNewBonus.description}
                            onChange={(e) => setCreateNewBonus((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Bonus description (optional)..."
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>

                        {/* Tombol simpan */}
                        <Button
                          type="button"
                          className="w-full rounded-xl"
                          disabled={!createNewBonus.name.trim() || !createNewBonus.price || isCreatingBonus}
                          onClick={async () => {
                            if (!createNewBonus.name.trim() || !createNewBonus.price || isCreatingBonus) return;
                            setIsCreatingBonus(true);
                            try {
                              const result = await createBonus({
                                name: createNewBonus.name.trim(),
                                price: createNewBonus.price,
                                description: createNewBonus.description.trim() || null,
                                isActive: true,
                              });
                              if (result.success) {
                                setBonuses((prev) => [{
                                  id: crypto.randomUUID(),
                                  bonusId: result.data.id,
                                  name: result.data.name,
                                  price: result.data.price,
                                  description: result.data.description ?? "",
                                  qty: 1,
                                }, ...prev]);
                                setBonusMode("none");
                                toast.success(`"${result.data.name}" added successfully`);
                              } else {
                                toast.error(result.error ?? "Failed to add bonus");
                              }
                            } finally {
                              setIsCreatingBonus(false);
                            }
                          }}
                        >
                          {isCreatingBonus ? "Saving..." : "Save & Add"}
                        </Button>
                      </div>
                    )}

                    {/* List bonus yang sudah ditambahkan — collapsible rows */}
                    {bonuses.map((b) => {
                      const isOpen = !collapsedBonuses.has(b.id);
                      return (
                        <Collapsible
                          key={b.id}
                          open={isOpen}
                          onOpenChange={() => toggleBonusCollapse(b.id)}
                          className="rounded-xl border border-border bg-muted/30 overflow-hidden"
                        >
                          {/* Header */}
                          <div className="flex items-center gap-1 px-3 py-2.5">
                            <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
                              <AltArrowDown
                                weight="BoldDuotone"
                                className={cn(
                                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                  isOpen && "rotate-180",
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                                {!isOpen && (
                                  <p className="text-xs text-muted-foreground tabular-nums">
                                    {b.price ? formatRupiah(b.price) : ""}
                                  </p>
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBonuses((prev) => prev.filter((x) => x.id !== b.id));
                                setCollapsedBonuses((prev) => {
                                  const next = new Set(prev);
                                  next.delete(b.id);
                                  return next;
                                });
                              }}
                              aria-label="Delete bonus"
                              className="shrink-0 h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Body */}
                          <CollapsibleContent>
                            <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                              <div>
                                <label className="text-xs font-medium text-foreground block mb-1">
                                  Name <span className="text-destructive">*</span>
                                </label>
                                <Input
                                  value={b.name}
                                  onChange={(e) => setBonuses((prev) => prev.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))}
                                  placeholder="Bonus name..."
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-foreground block mb-1">
                                  Price <span className="text-destructive">*</span>
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                                    Rp
                                  </span>
                                  <Input
                                    value={b.price ? formatNumericDisplay(b.price) : ""}
                                    onChange={(e) => {
                                      const n = parseNumericInput(e.target.value);
                                      setBonuses((prev) => prev.map((x) => x.id === b.id ? { ...x, price: n } : x));
                                    }}
                                    placeholder="Price"
                                    inputMode="numeric"
                                    className="h-8 text-sm pl-8"
                                  />
                                </div>
                              </div>
                              <Textarea
                                value={b.description}
                                onChange={(e) => setBonuses((prev) => prev.map((x) => x.id === b.id ? { ...x, description: e.target.value } : x))}
                                placeholder="Bonus description..."
                                rows={2}
                                className="resize-none text-sm"
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                    {bonuses.length === 0 && bonusMode === "none" && (
                      <p className="text-xs text-muted-foreground italic text-center py-1">No bonus yet</p>
                    )}
                  </TabsContent>

                  {/* ── Complimentary ─────────────────────────────────── */}
                  <TabsContent value="complimentary" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                {/* Pilih dari daftar (dropdown inline) — "Tambah" muncul di dalam dropdown saat search tidak exact-match */}
                {complimentaryMode !== "create-new" && (
                  <ComplimentarySelect
                    options={complimentaryOptions
                      .filter((opt) => !complimentaries.some((c) => c.complimentaryId === opt.id))
                      .map((opt) => ({ id: opt.id, name: opt.name, badge: formatRupiah(opt.price), description: opt.description ?? undefined }))}
                    value=""
                    onChange={(selectedId) => {
                      const found = complimentaryOptions.find((x) => x.id === selectedId);
                      if (found) {
                        setComplimentaries((prev) => [{
                          id: crypto.randomUUID(),
                          complimentaryId: found.id,
                          name: found.name,
                          price: found.price,
                          isShowPrice: found.isShowPrice,
                          description: found.description ?? "",
                          qty: 1,
                        }, ...prev]);
                      }
                    }}
                    onAddTrigger={canCreateComplimentary ? (text) => {
                      setComplimentaryMode("create-new");
                      setCreateNewComp({ name: text, price: 0, description: "", isShowPrice: false });
                    } : undefined}
                    placeholder="Select from complimentary list..."
                    searchPlaceholder="Search complimentary..."
                    emptyText="No complimentary"
                  />
                )}

                {/* Mode: buat baru */}
                {complimentaryMode === "create-new" && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Add a new complimentary to the master list</p>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setComplimentaryMode("none")}
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Nama */}
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={createNewComp.name}
                        onChange={(e) => setCreateNewComp((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Complimentary name..."
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Harga + Tampil harga */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                          Rp
                        </span>
                        <Input
                          value={createNewComp.price ? formatNumericDisplay(createNewComp.price) : ""}
                          onChange={(e) => {
                            const n = parseNumericInput(e.target.value);
                            setCreateNewComp((p) => ({ ...p, price: n }));
                          }}
                          placeholder="Price (optional)"
                          inputMode="numeric"
                          className="h-8 text-sm pl-8"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                        <Switch
                          checked={createNewComp.isShowPrice}
                          onCheckedChange={(v) => setCreateNewComp((p) => ({ ...p, isShowPrice: v }))}
                        />
                        <span className="text-xs text-muted-foreground">Show price</span>
                      </label>
                    </div>

                    {/* Deskripsi */}
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">Description</label>
                      <Textarea
                        value={createNewComp.description}
                        onChange={(e) => setCreateNewComp((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Complimentary description (optional)..."
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>

                    {/* Tombol simpan */}
                    <Button
                      type="button"
                      className="w-full rounded-xl"
                      disabled={!createNewComp.name.trim() || isCreatingComp}
                      onClick={async () => {
                        if (!createNewComp.name.trim() || isCreatingComp) return;
                        setIsCreatingComp(true);
                        try {
                          const result = await createComplimentary({
                            name: createNewComp.name.trim(),
                            price: createNewComp.price,
                            description: createNewComp.description.trim() || null,
                            isShowPrice: createNewComp.isShowPrice,
                            isActive: true,
                          });
                          if (result.success && result.item) {
                            setComplimentaries((prev) => [{
                              id: crypto.randomUUID(),
                              complimentaryId: result.item!.id,
                              name: result.item!.name,
                              price: result.item!.price,
                              isShowPrice: result.item!.isShowPrice,
                              description: result.item!.description ?? "",
                              qty: 1,
                            }, ...prev]);
                            setComplimentaryMode("none");
                            toast.success(`"${result.item.name}" added successfully`);
                          } else {
                            toast.error(result.error ?? "Failed to add complimentary");
                          }
                        } finally {
                          setIsCreatingComp(false);
                        }
                      }}
                    >
                      {isCreatingComp ? "Saving..." : "Save & Add"}
                    </Button>
                  </div>
                )}

                {/* List complimentary yang sudah ditambahkan — collapsible rows */}
                {complimentaries.map((c) => {
                  const isOpen = !collapsedComplimentaries.has(c.id);
                  return (
                    <Collapsible
                      key={c.id}
                      open={isOpen}
                      onOpenChange={() => toggleComplimentaryCollapse(c.id)}
                      className="rounded-xl border border-border bg-muted/30 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="flex items-center gap-1 px-3 py-2.5">
                        <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
                          <AltArrowDown
                            weight="BoldDuotone"
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                              isOpen && "rotate-180",
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                            {!isOpen && (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {c.isShowPrice && c.price ? formatRupiah(c.price) : "Price not shown"}
                              </p>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setComplimentaries((prev) => prev.filter((x) => x.id !== c.id));
                            setCollapsedComplimentaries((prev) => {
                              const next = new Set(prev);
                              next.delete(c.id);
                              return next;
                            });
                          }}
                          aria-label="Delete complimentary"
                          className="shrink-0 h-7 w-7 text-destructive hover:bg-destructive/10"
                        >
                          <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Body */}
                      <CollapsibleContent>
                        <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                          <div>
                            <label className="text-xs font-medium text-foreground block mb-1">
                              Name <span className="text-destructive">*</span>
                            </label>
                            <Input
                              value={c.name}
                              onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))}
                              placeholder="Complimentary name..."
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                                Rp
                              </span>
                              <Input
                                value={c.price ? formatNumericDisplay(c.price) : ""}
                                onChange={(e) => {
                                  const n = parseNumericInput(e.target.value);
                                  setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, price: n } : x));
                                }}
                                placeholder="Price"
                                inputMode="numeric"
                                className="h-8 text-sm pl-8"
                              />
                            </div>
                            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                              <Switch
                                checked={c.isShowPrice}
                                onCheckedChange={(v) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, isShowPrice: v } : x))}
                              />
                              <span className="text-xs text-muted-foreground">Show price</span>
                            </label>
                          </div>
                          <Textarea
                            value={c.description}
                            onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, description: e.target.value } : x))}
                            placeholder="Complimentary description..."
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
                {complimentaries.length === 0 && complimentaryMode === "none" && (
                  <p className="text-xs text-muted-foreground italic text-center py-1">No complimentary yet</p>
                )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* ════════════════ STEP 4 — KETENTUAN PENAWARAN ════════════════ */}
              <div className={cn(step !== 4 && "hidden", "space-y-4")}>
                <div className="pb-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">Quotation Terms</p>
                </div>

                <FormField
                  control={form.control}
                  name="paymentMethodId"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Payment Method</FormLabel>
                      <BankAccountSelect
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        venueId={watchedVenueId || undefined}
                        placeholder="Select payment method..."
                        disableAdd
                      />
                      <FormMessage />
                      {selectedPaymentMethod && (
                        <div className="rounded-xl bg-muted p-4 space-y-1.5 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Bank</span>
                            <span className="font-medium text-foreground text-right">
                              {selectedPaymentMethod.bankName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Account Number</span>
                            <span className="font-medium text-foreground text-right tabular-nums">
                              {selectedPaymentMethod.bankAccountNumber}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Account Name</span>
                            <span className="font-medium text-foreground text-right">
                              {selectedPaymentMethod.bankRecipient}
                            </span>
                          </div>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bookingFee"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>
                        Booking Fee{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative w-full">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                            Rp
                          </span>
                          <Input
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(formatNumericDisplay(e.target.value))
                            }
                            placeholder="0"
                            inputMode="numeric"
                            className="w-full pl-8"
                          />
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Shown in the document: &quot;Booking Fee of Rp X is required to confirm the
                        reservation&quot;. Leave empty if not applicable.
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentNote"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>
                        Payment Note{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="The remaining payment shall be completed according to the agreed schedule."
                          className="w-full"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Sub-note under Terms &amp; Payment. Leave empty to use the default text above.
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>
                        Valid Until{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              <CalendarSolarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                              {field.value
                                ? format(parseDateOnly(field.value), "dd MMM yyyy")
                                : "Select valid-until date..."}
                            </Button>
                          }
                        />
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const y = date.getFullYear();
                                const m = String(date.getMonth() + 1).padStart(2, "0");
                                const d = String(date.getDate()).padStart(2, "0");
                                field.onChange(`${y}-${m}-${d}`);
                              } else {
                                field.onChange("");
                              }
                            }}
                            fromYear={new Date().getFullYear()}
                            toYear={new Date().getFullYear() + 5}
                            defaultMonth={field.value ? new Date(field.value + "T00:00:00") : new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>
                        Notes{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="Additional notes for the client..."
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cancellationPolicy"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>
                        Cancellation &amp; Refund Policy{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="All confirmed transactions are non-cancellable and non-refundable."
                          className="w-full"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Leave empty to use the default text above.
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="closingNote"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>
                        Closing{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="We look forward to welcoming you and your team at Kediaman Event Venue — {venue}. Should you require any further assistance, please do not hesitate to contact us."
                          className="w-full"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Leave empty to use the default text above (venue name is filled in automatically).
                      </p>
                    </FormItem>
                  )}
                />
              </div>

              {/* ════════════════ STEP 5 — SUMMARY ════════════════ */}
              <div className={cn(step !== 5 && "hidden", "space-y-3")}>
                {/* ── Ringkasan Biaya ───────────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calculator weight="BoldDuotone" className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Cost Summary</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Discount</FormLabel>
                        <FormControl>
                          <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={field.value}
                              onChange={(e) =>
                                field.onChange(formatNumericDisplay(e.target.value))
                              }
                              placeholder="0"
                              inputMode="numeric"
                              className="w-full pl-8"
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="rounded-xl bg-muted p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatRupiah(subtotal)}</span>
                    </div>
                    {discountNum > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Discount</span>
                        <span className="tabular-nums">
                          - {formatRupiah(discountNum)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                      <span>Total</span>
                      <span
                        role="status"
                        aria-live="polite"
                        className="tabular-nums"
                      >
                        {formatRupiah(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ════════════════ STEP 6 — TTD ════════════════ */}
              <div className={cn(step !== 6 && "hidden", "space-y-3")}>
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-semibold text-foreground mb-1">Signature & Location</p>
                  <div>
                    <FormLabel className={cn("text-sm", "font-medium", "text-foreground", "mb-2", "block")}>
                      Signing Location <span className="text-destructive">*</span>
                    </FormLabel>
                    <Input
                      placeholder="e.g. Jakarta, Bandung, Surabaya..."
                      value={signingLocation}
                      onChange={(e) => setSigningLocation(e.target.value)}
                    />
                  </div>
                  <div className="border-t border-border/60 pt-4">
                    <FormLabel className={cn("text-sm", "font-medium", "text-foreground", "mb-2", "block")}>
                      Sales Signature <span className="text-destructive">*</span>
                    </FormLabel>
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-xl overflow-hidden bg-muted",
                        !signatureSales ? "border-destructive/40" : "border-border",
                      )}
                    >
                      {/* Mount only when step 6 is active — a SignatureCanvas mounted
                          inside a display:none container has 0 dimensions and never
                          captures strokes. */}
                      {step === 6 && (
                        <SignatureCanvas
                          ref={sigSalesRef}
                          penColor="black"
                          canvasProps={{
                            className: "w-full",
                            style: { width: "100%", height: 200, touchAction: "none" },
                          }}
                          onEnd={() => {
                            if (sigSalesRef.current) {
                              setSignatureSales(sigSalesRef.current.toDataURL("image/png"));
                            }
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className={cn("text-xs", "text-destructive", signatureSales && "invisible")}>
                        Sales signature is required
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          sigSalesRef.current?.clear();
                          setSignatureSales("");
                        }}
                        className="text-xs text-destructive hover:text-destructive underline ml-auto"
                      >
                        Clear signature
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background z-10">
          <div className="flex py-4 gap-2">
            {step === 1 ? (
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-[40%] cursor-pointer text-destructive border-destructive hover:bg-destructive/10"
              >
                Cancel
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex-[40%] cursor-pointer"
              >
                Back
              </Button>
            )}
            {step < 6 ? (
              <Button
                onClick={handleNext}
                disabled={step === 1 ? isStep1Incomplete : false}
                className="flex-[60%] cursor-pointer"
              >
                Next
                <ArrowRight weight="BoldDuotone" className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={!isSignatureComplete || isPending}
                className="flex-[60%] cursor-pointer"
              >
                {isPending ? "Saving..." : isEdit ? "Save" : "Add"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
