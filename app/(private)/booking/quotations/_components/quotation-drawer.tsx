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
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { ComplimentarySelect } from "@/components/shared/ComplimentarySelect";
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
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useComplimentaries } from "@/hooks/use-complimentaries";
import { usePermissions } from "@/hooks/use-permissions";
import { createComplimentary } from "@/actions/complimentary";
import { parseContactNumbers } from "@/types/daily-activity";
import type { QuotationItem, QuotationComplimentaryItem } from "./quotations-table";

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
) {
  if (typeof window === "undefined") return;
  const { ...rest } = values;
  const hasContent = Object.values(rest).some((v) => {
    if (Array.isArray(v)) return v.some((item: QuotationItemForm) => item.title?.trim());
    return typeof v === "string" && v.trim() !== "";
  });
  if (hasContent || signingLocation?.trim() || signatureSales || (complimentaries && complimentaries.length > 0)) {
    const draft: QuotationDraft = { values: rest };
    if (signingLocation !== undefined) draft.signingLocation = signingLocation;
    if (signatureSales !== undefined) draft.signatureSales = signatureSales;
    if (complimentaries !== undefined) draft.complimentaries = complimentaries;
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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
      itemType: "PAX" | "NOMINAL";
      itemPrice: number;
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
   * items). PAX items multiply by the package's default pax; NOMINAL items
   * are flat.
   */
  function handleApplyPackage(packageId: string) {
    const pkg = micePackages.find((p) => p.id === packageId);
    if (!pkg) return;
    if (pkg.miceItems.length === 0) {
      toast.error("Paket ini belum punya item.");
      return;
    }
    const newItems = pkg.miceItems.map((item) => {
      let qty: string;
      let total: number;
      if (item.itemType === "PAX") {
        qty = String(pkg.pax);
        total = pkg.pax * item.itemPrice;
      } else {
        qty = "1";
        total = item.itemPrice;
      }
      return {
        title: item.itemName,
        description: miceDescriptionToHtml(item.itemDescription),
        qty,
        price: item.itemPrice > 0 ? formatNumericDisplay(item.itemPrice) : "",
        total: total > 0 ? formatNumericDisplay(total) : "",
        manualTotal: false,
      };
    });
    replaceItems(newItems);
    toast.success(
      `${pkg.miceItems.length} item dari paket "${pkg.packageName}" diterapkan (menggantikan item sebelumnya).`,
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

  // Step 4 (signature) requires a signature + signing location.
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
      persistQuotationDraft(values as Partial<QuotationFormValues>, signingLocation, signatureSales, complimentaries);
    });
    return () => sub.unsubscribe();
  }, [open, isEdit, signingLocation, signatureSales, complimentaries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist signingLocation/signatureSales/complimentaries changes to draft (not triggered by form.watch).
  useEffect(() => {
    if (!open || isEdit) return;
    persistQuotationDraft(form.getValues(), signingLocation, signatureSales, complimentaries);
  }, [signingLocation, signatureSales, complimentaries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repaint the restored signature once the canvas mounts (step 4 only — see the
  // "Mount only when step 4 is active" note on SignatureCanvas below).
  useEffect(() => {
    if (step !== 4 || !pendingSignatureRestoreRef.current) return;
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
    }
  }

  function handlePrevious() {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      // Clear signature saat kembali dari step TTD
      sigSalesRef.current?.clear();
      setSignatureSales("");
      setStep(3);
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
      eventDate: values.eventDate || null,
      eventEndDate: values.eventEndDate || null,
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
    // Reset complimentary state setelah submit sukses
    setComplimentaries([]);
    setComplimentaryMode("none");
    setCollapsedComplimentaries(new Set());
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
      totalSteps={4}
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
                  <p className="text-sm font-semibold text-foreground mb-1">Klien</p>

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
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground mb-1">Sales</p>

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
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">Detail Event</p>
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

                  {/* Tanggal Event — bisa single atau rentang (klik 1 tanggal = single, klik ke-2 = rentang) */}
                  <FormField
                    control={form.control}
                    name="eventDate"
                    rules={{ required: "Tanggal event wajib diisi" }}
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
                        triggerLabel = "Pilih tanggal event";
                      } else if (!watchedEnd || watchedEnd === field.value) {
                        triggerLabel = format(new Date(field.value + "T00:00:00"), "PPP");
                      } else {
                        triggerLabel = `${format(new Date(field.value + "T00:00:00"), "PPP")} – ${format(new Date(watchedEnd + "T00:00:00"), "PPP")}`;
                      }

                      return (
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
                            <p className="text-xs text-muted-foreground mt-1">Mengecek ketersediaan...</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Klik 1 tanggal untuk single, klik tanggal ke-2 untuk rentang.
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
              <div className={cn(step !== 2 && "hidden", "space-y-4")}>
                {/* ── Pilih Package MICE ────────────────────────────── */}
                {watchedVenueId && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Box weight="BoldDuotone" className="h-4 w-4 text-primary" />
                      <p className={LABEL_CLASS}>Pilih Package MICE</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {micePackages.length === 0
                        ? "Belum ada paket MICE approved untuk venue ini."
                        : "Pilih paket — item paket akan MENGGANTIKAN daftar item di bawah (bisa diedit setelahnya)."}
                    </p>
                    <SearchableSelect
                      options={micePackages.map((p) => ({ id: p.id, name: p.packageName }))}
                      value={selectedPackageId}
                      onChange={(id) => {
                        setSelectedPackageId(id);
                        handleApplyPackage(id);
                      }}
                      placeholder="Cari & pilih paket MICE untuk venue ini..."
                      searchPlaceholder="Cari paket..."
                      emptyText="Tidak ada paket MICE"
                    />
                  </div>
                )}

                {/* ── Items ─────────────────────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BillList weight="BoldDuotone" className="h-4 w-4 text-primary" />
                      <p className={LABEL_CLASS}>Items</p>
                    </div>
                    {itemsSubtotal > 0 && (
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {formatRupiah(itemsSubtotal)}
                      </span>
                    )}
                  </div>

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

                {/* ── Additional ────────────────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AddCircle weight="BoldDuotone" className="h-4 w-4 text-primary" />
                      <p className={LABEL_CLASS}>Additional</p>
                    </div>
                    {additionalsSubtotal > 0 && (
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {formatRupiah(additionalsSubtotal)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Item tambahan berbayar — ikut menambah subtotal &amp; total.
                  </p>

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
                </div>

                {/* ── Complimentary ─────────────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Gift weight="BoldDuotone" className="h-4 w-4 text-primary" />
                      <p className={LABEL_CLASS}>Complimentary</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Gratis
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Bonus/fasilitas gratis untuk client — tidak masuk ke total biaya.
                  </p>

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
                          setComplimentaries((prev) => [...prev, {
                            id: crypto.randomUUID(),
                            complimentaryId: found.id,
                            name: found.name,
                            price: found.price,
                            isShowPrice: found.isShowPrice,
                            description: found.description ?? "",
                            qty: 1,
                          }]);
                        }
                      }}
                      onAddTrigger={canCreateComplimentary ? (text) => {
                        setComplimentaryMode("create-new");
                        setCreateNewComp({ name: text, price: 0, description: "", isShowPrice: false });
                      } : undefined}
                      placeholder="Pilih dari daftar complimentary..."
                      searchPlaceholder="Cari complimentary..."
                      emptyText="Tidak ada complimentary"
                    />
                  )}

                  {/* Mode: buat baru */}
                  {complimentaryMode === "create-new" && (
                    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Tambah complimentary baru ke master</p>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setComplimentaryMode("none")}
                        >
                          Batal
                        </button>
                      </div>

                      {/* Nama */}
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">
                          Nama <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={createNewComp.name}
                          onChange={(e) => setCreateNewComp((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Nama complimentary..."
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
                            placeholder="Harga (opsional)"
                            inputMode="numeric"
                            className="h-8 text-sm pl-8"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                          <Switch
                            checked={createNewComp.isShowPrice}
                            onCheckedChange={(v) => setCreateNewComp((p) => ({ ...p, isShowPrice: v }))}
                          />
                          <span className="text-xs text-muted-foreground">Tampil harga</span>
                        </label>
                      </div>

                      {/* Deskripsi */}
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">Deskripsi</label>
                        <Textarea
                          value={createNewComp.description}
                          onChange={(e) => setCreateNewComp((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Keterangan complimentary (opsional)..."
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
                              setComplimentaries((prev) => [...prev, {
                                id: crypto.randomUUID(),
                                complimentaryId: result.item!.id,
                                name: result.item!.name,
                                price: result.item!.price,
                                isShowPrice: result.item!.isShowPrice,
                                description: result.item!.description ?? "",
                                qty: 1,
                              }]);
                              setComplimentaryMode("none");
                              toast.success(`"${result.item.name}" berhasil ditambahkan`);
                            } else {
                              toast.error(result.error ?? "Gagal menambahkan complimentary");
                            }
                          } finally {
                            setIsCreatingComp(false);
                          }
                        }}
                      >
                        {isCreatingComp ? "Menyimpan..." : "Simpan & Tambahkan"}
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
                                  {c.isShowPrice && c.price ? formatRupiah(c.price) : "Harga tidak ditampilkan"}
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
                            aria-label="Hapus complimentary"
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
                                Nama <span className="text-destructive">*</span>
                              </label>
                              <Input
                                value={c.name}
                                onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))}
                                placeholder="Nama complimentary..."
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
                                  placeholder="Harga"
                                  inputMode="numeric"
                                  className="h-8 text-sm pl-8"
                                />
                              </div>
                              <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                                <Switch
                                  checked={c.isShowPrice}
                                  onCheckedChange={(v) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, isShowPrice: v } : x))}
                                />
                                <span className="text-xs text-muted-foreground">Tampil harga</span>
                              </label>
                            </div>
                            <Textarea
                              value={c.description}
                              onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, description: e.target.value } : x))}
                              placeholder="Keterangan complimentary..."
                              rows={2}
                              className="resize-none text-sm"
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                  {complimentaries.length === 0 && complimentaryMode === "none" && (
                    <p className="text-xs text-muted-foreground italic text-center py-1">Belum ada complimentary</p>
                  )}
                </div>

                {/* ── Ringkasan ─────────────────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground mb-1">Ringkasan Biaya</p>
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
              </div>

              {/* ════════════════ STEP 3 — KETENTUAN PENAWARAN ════════════════ */}
              <div className={cn(step !== 3 && "hidden", "space-y-3")}>
                {/* ── Ketentuan Penawaran ───────────────────────────── */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground mb-1">Ketentuan Penawaran</p>

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

              {/* ════════════════ STEP 4 — TTD ════════════════ */}
              <div className={cn(step !== 4 && "hidden", "space-y-3")}>
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-semibold text-foreground mb-1">Tanda Tangan & Lokasi</p>
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
                  <div className="border-t border-border/60 pt-4">
                    <FormLabel className={cn("text-sm", "font-medium", "text-foreground", "mb-2", "block")}>
                      Tanda Tangan Sales <span className="text-destructive">*</span>
                    </FormLabel>
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-xl overflow-hidden bg-muted",
                        !signatureSales ? "border-destructive/40" : "border-border",
                      )}
                    >
                      {/* Mount only when step 4 is active — a SignatureCanvas mounted
                          inside a display:none container has 0 dimensions and never
                          captures strokes. */}
                      {step === 4 && (
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
            {step < 4 ? (
              <Button
                onClick={handleNext}
                disabled={step === 1 ? isStep1Incomplete : false}
                className="flex-[60%] cursor-pointer"
              >
                Lanjut
                <ArrowRight weight="BoldDuotone" className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={!isSignatureComplete || isPending}
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
