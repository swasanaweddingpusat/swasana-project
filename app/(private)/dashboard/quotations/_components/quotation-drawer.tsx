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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SearchableSelect,
} from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import {
  AddCircle,
  TrashBinTrash,
  Refresh,
  ArrowRight,
  AltArrowDown,
  Calendar as CalendarSolarIcon,
  AlignVerticalSpacing,
  Box,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
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
  status: QuotationStatusValue;
  // Step 2 — items + ringkasan
  items: QuotationItemForm[];
  discount: string;
  bookingFee: string;
  validUntil: string;
  notes: string;
  paymentMethodId: string;
}

// ── API response types ───────────────────────────────────────────────────────

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

/** Escape HTML-sensitive chars so raw package text is safe inside TipTap. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert a PackageMiceItem.itemDescription (newline-separated bullets) into the
 * rich HTML shape SimpleEditor/TipTap expects. Multi-line → <ul>; single line →
 * <p>; empty → "".
 */
function miceDescriptionToHtml(raw: string): string {
  const lines = (raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => escapeHtml(l));
  if (lines.length === 0) return "";
  if (lines.length === 1) return `<p>${lines[0]}</p>`;
  return `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;
}

const LABEL_CLASS = cn("text-sm", "font-medium", "text-foreground");

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

const STATUS_OPTIONS: { value: QuotationStatusValue; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "revised", label: "Revised" },
  { value: "accepted", label: "Dealing" },
  { value: "rejected", label: "Rejected" },
];

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
  status: "draft",
  items: DEFAULT_ITEMS.map((it) => ({ ...it })),
  discount: "",
  bookingFee: "",
  validUntil: "",
  notes: "",
  paymentMethodId: "",
};

// ── Draft persistence (create mode only) ─────────────────────────────────────

const QUOTATION_DRAFT_KEY = "quotation-draft-v1";

type QuotationDraft = { values: Partial<QuotationFormValues>; signingLocation?: string };

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
) {
  if (typeof window === "undefined") return;
  const { ...rest } = values;
  const hasContent = Object.values(rest).some((v) => {
    if (Array.isArray(v)) return v.some((item: QuotationItemForm) => item.title?.trim());
    return typeof v === "string" && v.trim() !== "";
  });
  if (hasContent) {
    const draft: QuotationDraft = { values: rest };
    if (signingLocation !== undefined) draft.signingLocation = signingLocation;
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
  arrayName: "items";
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
  arrayName: "items";
  fields: Array<{ id: string }>;
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
  fields,
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
                {titleVal || "Item tanpa judul"}
              </p>
              {!isOpen && (totalVal || qtyVal) && (
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
            disabled={fields.length === 1}
            aria-label="Hapus item"
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
                    Judul / Nama Item
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value as string}
                      placeholder="mis. Ballroom Facilities : atau Nasi Box"
                      className="w-full"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-2">
              <FormField
                control={form.control}
                name={`${arrayName}.${index}.qty` as FieldPath<QuotationFormValues>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      Qty
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
                      Harga
                    </FormLabel>
                    <FormControl>
                      <Input
                        value={field.value as string}
                        onChange={(e) => {
                          field.onChange(formatNumericDisplay(e.target.value));
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
                          aria-label="Kembalikan ke otomatis"
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

            {/* Description — rich text (TipTap) */}
            <FormField
              control={form.control}
              name={`${arrayName}.${index}.description` as FieldPath<QuotationFormValues>}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">
                    Description{" "}
                    <span className="font-normal">(opsional)</span>
                  </FormLabel>
                  <FormControl>
                    <SimpleEditor
                      value={field.value as string}
                      onChange={field.onChange}
                      placeholder="Deskripsi detail item..."
                    />
                  </FormControl>
                </FormItem>
              )}
            />
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
              fields={fields}
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
        Tambah Item
      </Button>
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  // TTD state (step 3)
  const sigSalesRef = useRef<SignatureCanvas>(null);
  const [signatureSales, setSignatureSales] = useState("");
  const [signingLocation, setSigningLocation] = useState("");

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

  // ── MICE package picker (Step 2 — explode into line items) ───────────────
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [paxInput, setPaxInput] = useState("");

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm<QuotationFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const { fields: itemFields, append: appendItem, remove: removeItem, move: moveItem, replace: replaceItems } = useFieldArray({
    control: form.control,
    name: "items",
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
        items?: Array<{ title: string; description: string | null; qty: number; price: number; total: number; manualTotal: boolean }>;
        paymentMethodId?: string | null;
        bookingFee?: number | null;
      };
      const tplItems: QuotationItemForm[] = (data.items ?? []).map((it) => ({
        title: it.title,
        description: it.description ?? "",
        qty: it.qty > 0 ? formatNumericDisplay(it.qty) : "",
        price: it.price > 0 ? formatNumericDisplay(it.price) : "",
        total: it.total > 0 ? formatNumericDisplay(it.total) : "",
        manualTotal: it.manualTotal,
      }));
      replaceItems(tplItems);
      setExpandedItems(new Set());
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

  const watchedClientName = form.watch("clientName");
  const watchedSalesId = form.watch("salesId");
  const watchedSalesPhone = form.watch("salesPhone");
  const watchedVenueId = form.watch("venueId");
  const watchedItems = form.watch("items");
  const watchedDiscount = form.watch("discount");
  const watchedEventTypeId = form.watch("eventTypeId");
  const watchedEventDate = form.watch("eventDate");

  // ── MICE packages available for this quotation ───────────────────────────
  interface MicePackageQuotationOption {
    id: string;
    packageName: string;
    pax: number;
    venue: { id: string; name: string } | null;
    miceItems: Array<{
      id: string;
      itemName: string;
      itemDescription: string;
      itemType: "PAX" | "NOMINAL";
      itemPrice: number;
      sortOrder: number;
    }>;
  }
  const { data: micePackagesData } = useQuery({
    queryKey: ["mice-packages-quotation", watchedVenueId],
    queryFn: async () => {
      const qs = `/api/packages?forQuotation=true&category=MICE${
        watchedVenueId ? `&venueId=${encodeURIComponent(watchedVenueId)}` : ""
      }`;
      const res = await fetch(qs);
      if (!res.ok) return [] as MicePackageQuotationOption[];
      return (await res.json()) as MicePackageQuotationOption[];
    },
    enabled: open,
    staleTime: 30_000,
  });
  const micePackages: MicePackageQuotationOption[] = micePackagesData ?? [];
  const selectedPackage = micePackages.find((p) => p.id === selectedPackageId) ?? null;

  /**
   * Explode the selected package's items into editable quotation line items and
   * append them (does not overwrite existing template/manual items). PAX items
   * multiply by pax; NOMINAL items are flat.
   */
  function handleAddPackageItems() {
    const pkg = micePackages.find((p) => p.id === selectedPackageId);
    if (!pkg) return;
    if (pkg.miceItems.length === 0) {
      toast.error("Paket ini belum punya item.");
      return;
    }
    const pax = parseNumericInput(paxInput);
    for (const item of pkg.miceItems) {
      let qty: string;
      let total: number;
      if (item.itemType === "PAX") {
        qty = String(pax);
        total = pax * item.itemPrice;
      } else {
        qty = "1";
        total = item.itemPrice;
      }
      appendItem({
        title: item.itemName,
        description: miceDescriptionToHtml(item.itemDescription),
        qty,
        price: item.itemPrice > 0 ? formatNumericDisplay(item.itemPrice) : "",
        total: total > 0 ? formatNumericDisplay(total) : "",
        manualTotal: false,
      });
    }
    toast.success(
      `${pkg.miceItems.length} item dari paket "${pkg.packageName}" ditambahkan.`,
    );
    setSelectedPackageId("");
    setPaxInput("");
  }

  const isStep1Incomplete =
    !watchedClientName?.trim() ||
    !watchedSalesId ||
    !watchedEventTypeId ||
    !watchedEventDate;

  // Step 2 (items + discount) has no hard-required field — items default to one row.
  const isStep2Incomplete = false;
  // Step 3 (signature) requires a signature + signing location.
  const isStep3Complete = !!signatureSales && !!signingLocation.trim();

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
        toast.error(err.error ?? "Gagal membuat event type");
        return;
      }
      const created = (await res.json()) as { id: string; name: string; category: string; sortOrder: number; isActive: boolean; code: string; createdAt: string };
      // Invalidate cache so the hook reflects the new entry
      await queryClient.invalidateQueries({ queryKey: ["event-types"] });
      // Immediately select the new event type
      form.setValue("eventTypeId", created.id);
      form.setValue("eventTypeName", created.name);
      toast.success(`Event type "${created.name}" ditambahkan`);
    } catch {
      toast.error("Gagal membuat event type");
    }
  }

  // ── Item totals ──────────────────────────────────────────────────────────
  const subtotal = (watchedItems ?? []).reduce(
    (sum, it) => sum + parseNumericInput(it?.total ?? ""),
    0,
  );
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
    // Reset instansi lookup state
    setInstansiSearch("");
    setDebouncedInstansi("");
    setInstansiDropdownOpen(false);
    // Reset MICE package picker state
    setSelectedPackageId("");
    setPaxInput("");

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
        status: (editQuotation.status as QuotationStatusValue) ?? "draft",
        items,
        discount:
          editQuotation.discount > 0
            ? formatNumericDisplay(editQuotation.discount)
            : "",
        bookingFee:
          editQuotation.bookingFee && editQuotation.bookingFee > 0
            ? formatNumericDisplay(editQuotation.bookingFee)
            : "",
        validUntil: editQuotation.validUntil,
        notes: editQuotation.notes,
        paymentMethodId: editQuotation.paymentMethodId ?? "",
      });
      // Sync instansi search input with existing value
      setInstansiSearch(editQuotation.instansi ?? "");
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
        // Restore signingLocation dari draft
        if (draft.signingLocation) {
          setSigningLocation(draft.signingLocation);
        }
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
    // eslint-disable-next-line react-hooks/incompatible-library
    const sub = form.watch((values) => {
      persistQuotationDraft(values as Partial<QuotationFormValues>, signingLocation);
    });
    return () => sub.unsubscribe();
  }, [open, isEdit, signingLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist signingLocation changes to draft (not triggered by form.watch).
  useEffect(() => {
    if (!open || isEdit) return;
    persistQuotationDraft(form.getValues(), signingLocation);
  }, [signingLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ───────────────────────────────────────────────────────────
  async function handleNext() {
    if (step === 1) {
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
    }
  }

  function handlePrevious() {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      // Clear signature saat kembali dari step 3
      sigSalesRef.current?.clear();
      setSignatureSales("");
      setStep(2);
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
      eventDate: values.eventDate || null,
      time: values.time || null,
      place: values.place || null,
      details: values.details || null,
      items,
      discount: discountNum,
      bookingFee: bookingFeeNum > 0 ? bookingFeeNum : null,
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
      toast.error(result.error ?? "Gagal menyimpan quotation.");
      return;
    }

    if (!isEdit) clearQuotationDraft();
    toast.success(
      isEdit ? "Quotation berhasil diperbarui." : "Quotation berhasil disimpan.",
    );
    // Reset signature setelah submit
    sigSalesRef.current?.clear();
    setSignatureSales("");
    setSigningLocation("");
    if (!isEdit) onSuccess?.();
    onOpenChange(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Quotation" : "Tambah Quotation"}
      maxWidth="sm:max-w-2xl"
      steps={step}
      totalSteps={3}
      stepperType="short"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-2">
          <Form {...form}>
            <form className="space-y-3 pb-2">

              {/* ════════════════ STEP 1 — INFORMASI ════════════════ */}
              <div className={cn(step !== 1 && "hidden", "space-y-4")}>

                {/* ── Status banner (edit mode only) ──────────────── */}
                {isEdit && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Status Quotation</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Pilih status..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* ── Klien ───────────────────────────────────────── */}
                <div className={cn("space-y-3", isEdit && "border-t pt-4")}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Klien
                  </p>

                  {/* Perusahaan / Instansi */}
                  <div ref={instansiDropdownRef} className="w-full">
                    <FormField
                      control={form.control}
                      name="instansi"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>
                            Perusahaan / Instansi{" "}
                            <span className="font-normal text-muted-foreground">(opsional)</span>
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
                                placeholder="Ketik nama perusahaan / instansi..."
                                className="w-full"
                                autoComplete="off"
                              />
                              {instansiDropdownOpen && debouncedInstansi.trim().length >= 1 && leadInstansiOptions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 max-h-64 overflow-auto rounded-xl border bg-background shadow-md">
                                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Dari Daily Activity
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
                    rules={{ required: "Nama PIC wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Nama PIC <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nama kontak / PIC klien..." className="w-full" />
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
                          No. HP / WA{" "}
                          <span className="font-normal text-muted-foreground">(opsional)</span>
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
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Sales
                  </p>

                  {currentUserIsSales ? (
                    <div className="w-full">
                      <FormLabel className={LABEL_CLASS}>
                        Nama Sales <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="mt-1.5 flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
                        {lockedSalesName}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Tercatat atas nama Anda.
                      </p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="salesId"
                      rules={{ required: "Sales wajib dipilih" }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>
                            Nama Sales <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? "" }))}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Pilih sales..."
                              searchPlaceholder="Cari sales..."
                              emptyText="Sales tidak ditemukan"
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
                        <FormLabel className={LABEL_CLASS}>No. HP Sales</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Isi nomor HP sales..."
                          />
                        </FormControl>
                        {!watchedSalesPhone?.trim() && (
                          <p className="text-xs text-muted-foreground">
                            Profil sales belum punya nomor — isi manual.
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                </div>

                {/* ── Event ───────────────────────────────────────── */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Detail Event
                    </p>
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
                              void loadVenueTemplate(id);
                            }}
                            placeholder="Pilih / cari venue..."
                            searchPlaceholder="Cari venue..."
                            emptyText="Venue tidak ditemukan"
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
                    rules={{ required: "Jenis event wajib dipilih" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Jenis Event <span className="text-destructive">*</span>
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
                            placeholder="Pilih jenis event..."
                            searchPlaceholder="Cari / ketik nama baru..."
                            emptyText="Belum ada jenis event MICE"
                            onAdd={handleAddEventType}
                            addingLabel="Menambahkan jenis event..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tanggal Event */}
                  <FormField
                    control={form.control}
                    name="eventDate"
                    rules={{ required: "Tanggal event wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Tanggal Event <span className="text-destructive">*</span>
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
                                  ? format(new Date(field.value + "T00:00:00"), "PPP")
                                  : "Pilih tanggal event"}
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
                          <p className="text-xs text-muted-foreground mt-1">Mengecek ketersediaan...</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Waktu */}
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Waktu{" "}
                          <span className="font-normal text-muted-foreground">(opsional)</span>
                        </FormLabel>
                        <FormControl>
                          <TimeRangePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Pilih waktu (bisa rentang)..."
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
                          Tempat{" "}
                          <span className="font-normal text-muted-foreground">(opsional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="mis. Ballroom, Outdoor..." className="w-full" />
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
                          Keterangan{" "}
                          <span className="font-normal text-muted-foreground">(opsional)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder="mis. Venue Only, Full Service, catatan khusus..."
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* ════════════════ STEP 2 — ITEMS + RINGKASAN ════════════════ */}
              <div className={cn(step !== 2 && "hidden", "space-y-3")}>
                {/* ── Ambil dari Paket MICE ─────────────────────────── */}
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Box weight="BoldDuotone" className="h-4 w-4 text-primary" />
                    <p className={LABEL_CLASS}>Ambil dari Paket MICE</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {!watchedVenueId
                      ? "Menampilkan semua paket MICE. Pilih venue di step 1 untuk memfilter."
                      : micePackages.length === 0
                        ? "Belum ada paket MICE approved untuk venue ini."
                        : "Pilih paket lalu isi jumlah pax — item paket akan ditambahkan ke daftar di bawah (bisa diedit)."}
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <FormLabel className="text-xs text-muted-foreground">
                        Paket
                      </FormLabel>
                      <SearchableSelect
                        options={micePackages.map((p) => ({
                          id: p.id,
                          name: p.venue?.name
                            ? `${p.packageName} — ${p.venue.name}`
                            : p.packageName,
                        }))}
                        value={selectedPackageId}
                        onChange={(id) => {
                          setSelectedPackageId(id);
                          const pkg = micePackages.find((p) => p.id === id);
                          if (pkg && pkg.pax > 0) setPaxInput(String(pkg.pax));
                        }}
                        placeholder="Pilih paket MICE..."
                        searchPlaceholder="Cari paket..."
                        emptyText="Tidak ada paket MICE"
                      />
                    </div>
                    <div className="w-full sm:w-28">
                      <FormLabel className="text-xs text-muted-foreground">
                        Jumlah Pax
                      </FormLabel>
                      <Input
                        value={paxInput}
                        onChange={(e) => setPaxInput(e.target.value.replace(/\D/g, ""))}
                        placeholder="0"
                        inputMode="numeric"
                        className="w-full"
                      />
                    </div>
                  </div>

                  {selectedPackage && (
                    <p className="text-xs text-muted-foreground">
                      {selectedPackage.miceItems.length} item akan ditambahkan.
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddPackageItems}
                    disabled={!selectedPackageId}
                    className="w-full rounded-xl"
                  >
                    <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1" />
                    Tambah item dari paket
                  </Button>
                </div>

                {/* ── Items ─────────────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className={LABEL_CLASS}>Items</p>
                    <span className="text-xs text-muted-foreground">
                      Total = Qty × Harga (bisa manual)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Awali judul dengan &quot;A. / B. / C.&quot; atau akhiri dengan
                    &quot;:&quot; untuk jadi judul section (mis. &quot;A. Ballroom
                    Facilities&quot;). Harga boleh dikosongkan untuk item tanpa biaya.
                  </p>

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
                </div>

                {/* ── Ringkasan ─────────────────────────────────────── */}
                <div className="border-t pt-4 space-y-3">
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Diskon</FormLabel>
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
                        <span>Diskon</span>
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

                {/* ── Ketentuan Penawaran ───────────────────────────── */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Ketentuan Penawaran
                  </p>

                  <FormField
                    control={form.control}
                    name="paymentMethodId"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Metode Pembayaran</FormLabel>
                        <BankAccountSelect
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          venueId={watchedVenueId || undefined}
                          placeholder="Pilih metode pembayaran..."
                          disableAdd
                        />
                        <FormMessage />
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
                          <span className="font-normal text-muted-foreground">(opsional)</span>
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
                          Tampil di dokumen: &quot;Booking Fee of Rp X is required to confirm the
                          reservation&quot;. Kosongkan bila tidak ada.
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
                          Berlaku Sampai{" "}
                          <span className="font-normal text-muted-foreground">(opsional)</span>
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
                                  ? format(new Date(field.value + "T00:00:00"), "PPP")
                                  : "Pilih tanggal berlaku..."}
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
                          Catatan{" "}
                          <span className="font-normal text-muted-foreground">(opsional)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            placeholder="Catatan tambahan untuk client..."
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* ════════════════ STEP 3 — TTD ════════════════ */}
              <div className={cn(step !== 3 && "hidden", "space-y-6")}>
                <div>
                  <FormLabel className={cn("text-sm", "font-medium", "text-foreground", "mb-2", "block")}>
                    Lokasi Tanda Tangan <span className="text-destructive">*</span>
                  </FormLabel>
                  <Input
                    placeholder="Contoh: Jakarta, Bandung, Surabaya..."
                    value={signingLocation}
                    onChange={(e) => setSigningLocation(e.target.value)}
                  />
                </div>
                <div className="border-t border-border pt-6">
                  <FormLabel className={cn("text-sm", "font-medium", "text-foreground", "mb-2", "block")}>
                    Tanda Tangan Sales <span className="text-destructive">*</span>
                  </FormLabel>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-xl overflow-hidden bg-muted",
                      !signatureSales ? "border-destructive/40" : "border-border",
                    )}
                  >
                    {/* Mount only when step 3 is active — a SignatureCanvas mounted
                        inside a display:none container has 0 dimensions and never
                        captures strokes. */}
                    {step === 3 && (
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
                      Tanda tangan sales wajib diisi
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        sigSalesRef.current?.clear();
                        setSignatureSales("");
                      }}
                      className="text-xs text-destructive hover:text-destructive underline ml-auto"
                    >
                      Hapus tanda tangan
                    </button>
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
                Batal
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex-[40%] cursor-pointer"
              >
                Kembali
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={handleNext}
                disabled={step === 1 ? isStep1Incomplete : isStep2Incomplete}
                className="flex-[60%] cursor-pointer"
              >
                Lanjut
                <ArrowRight weight="BoldDuotone" className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={!isStep3Complete || isPending}
                className="flex-[60%] cursor-pointer"
              >
                {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
