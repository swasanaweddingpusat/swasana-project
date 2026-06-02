"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray, type UseFormReturn, type FieldPath } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
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
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import {
  AddCircle,
  TrashBinTrash,
  Refresh,
  ArrowRight,
  AltArrowDown,
  Calendar as CalendarSolarIcon,
} from "@solar-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getWeddingTimeRange,
  type WeddingSession,
  type WeddingEventType,
} from "@/lib/constants/wedding-session-times";
import { cn } from "@/lib/utils";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { QuotationItem } from "./quotations-table";

// ── Types ────────────────────────────────────────────────────────────────────

interface TermRow {
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
  paymentStatus: "unpaid" | "paid" | "partial";
}

const PAYMENT_STATUS = ["unpaid", "paid", "partial"] as const;

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

interface QuotationFormValues {
  // Step 1 — informasi
  clientName: string;
  clientPhone: string;
  instansi: string;
  salesId: string;
  salesName: string;
  salesPhone: string;
  category: "WEDDINGS" | "MICE" | "";
  eventTypeId: string;
  eventTypeName: string; // nama event type untuk display/preview
  details: string;
  time: string;
  weddingSession: WeddingSession | "";
  venueId: string;
  venue: string;
  eventDate: string;
  // Step 2 — items + ringkasan
  items: QuotationItemForm[];
  discount: string;
  validUntil: string;
  notes: string;
}

// ── API response types ───────────────────────────────────────────────────────

interface LeadOption {
  id: string;
  name: string;
  email: string | null;
  contactNumbers: Array<{ label?: string; name?: string; number: string }>;
  category: string | null;
  venueId: string | null;
  eventType: { id: string; name: string } | null;
  eventDate: string | null;
  assignedTo: { id: string; fullName: string | null } | null;
}

interface CustomerOption {
  id: string;
  name: string;
  mobileNumber: string;
  email: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
}

function parseNumericInput(raw: string): number {
  return parseInt(raw.replace(/\D/g, ""), 10) || 0;
}

function normalizePhone(phone: string): string {
  const stripped = phone.replace(/\s/g, "");
  return stripped.startsWith("0") ? stripped.slice(1) : stripped;
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

/** Map QuotationItem.category (lowercase dari table) ke UPPERCASE form value */
function normalizeCategoryUp(cat: string): "WEDDINGS" | "MICE" | "" {
  if (cat === "weddings" || cat === "WEDDINGS") return "WEDDINGS";
  if (cat === "mice" || cat === "MICE") return "MICE";
  return "";
}

const SESSION_LABELS: Record<string, string> = {
  morning: "Pagi",
  evening: "Malam",
  fullday: "Full Day",
};

/**
 * Map nama Event Type (mis. "Akad & Resepsi", "Resepsi") ke kategori waktu
 * akad/resepsi yang dipakai untuk auto-fill jam wedding. Gantikan field
 * "Type Acara" terpisah karena infonya sudah ada di Event Type.
 */
function deriveWeddingEventType(eventTypeName: string): WeddingEventType | "" {
  const n = eventTypeName.toLowerCase();
  const hasAkad = n.includes("akad");
  const hasResepsi = n.includes("resepsi");
  if (hasAkad && hasResepsi) return "akad-dan-resepsi";
  if (hasAkad) return "akad";
  if (hasResepsi) return "resepsi";
  return "";
}

const LABEL_CLASS = cn("text-sm", "font-medium", "text-foreground");

// ── Term of Payment helpers ───────────────────────────────────────────────────

const BOOKING_FEE_DEFAULT = 5_000_000;
const DP_DEFAULT = 10_000_000;

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

function makeDefaultTerms(category: "WEDDINGS" | "MICE" | ""): TermRow[] {
  if (category === "WEDDINGS") {
    return [
      { name: "Booking Fee", amount: BOOKING_FEE_DEFAULT, dueDate: toLocalISO(new Date()), sortOrder: 0, paymentStatus: "paid" },
      { name: "DP", amount: DP_DEFAULT, dueDate: "", sortOrder: 1, paymentStatus: "unpaid" },
      { name: "Angsuran 1", amount: 0, dueDate: "", sortOrder: 2, paymentStatus: "unpaid" },
      { name: "Angsuran 2", amount: 0, dueDate: "", sortOrder: 3, paymentStatus: "unpaid" },
      { name: "Pelunasan 1", amount: 0, dueDate: "", sortOrder: 4, paymentStatus: "unpaid" },
      { name: "Pelunasan 2", amount: 0, dueDate: "", sortOrder: 5, paymentStatus: "unpaid" },
      { name: "Final", amount: 0, dueDate: "", sortOrder: 6, paymentStatus: "unpaid" },
    ];
  }
  // MICE or unset → 2 terms
  return [
    { name: "Booking Fee", amount: BOOKING_FEE_DEFAULT, dueDate: toLocalISO(new Date()), sortOrder: 0, paymentStatus: "paid" },
    { name: "Final", amount: 0, dueDate: "", sortOrder: 1, paymentStatus: "unpaid" },
  ];
}

function recalcTermDates(terms: TermRow[], eventDate: string): TermRow[] {
  if (!eventDate || terms.length === 0) return terms;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const totalMs = event.getTime() - now.getTime();
  if (totalMs <= 0) return terms;
  const n = terms.length;
  return terms.map((t, i) => ({
    ...t,
    dueDate: toLocalISO(new Date(now.getTime() + Math.round((totalMs * i) / (n - 1 || 1)))),
  }));
}

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Default facility breakdown untuk quotation baru (dummy template, bisa diedit).
 * Section bundling (A/B/C) = 1 card: title = judul section, description = daftar
 * fasilitas (bullet list HTML untuk TipTap). Section ber-harga per-item (D/E)
 * tetap 1 card per item. Baris berharga di-set manualTotal karena total final
 * tidak selalu sama dengan qty × harga.
 */
function listHtml(lines: string[]): string {
  return `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;
}

function makeItem(
  title: string,
  qty = "",
  price = "",
  total = "",
  description = "",
): QuotationItemForm {
  return { title, description, qty, price, total, manualTotal: total !== "" };
}

const DEFAULT_ITEMS: QuotationItemForm[] = [
  // Ballroom Facilities — 1 card, daftar fasilitas di description
  makeItem(
    "Ballroom Facilities :",
    "",
    "",
    "",
    listHtml([
      "Samisara Grand Ballroom for Full Day",
      "Full Carpet Ballroom",
      "Full Air Conditioned",
      "Voyager Area",
      "6-meter High Ceiling",
      "1 Changing Rooms",
      "Exclusive Restroom",
      "Parking area lot up to 800",
      "Cleaning Service",
      "Electricity 10.000 watt",
      "Security",
    ]),
  ),
  // Equipments — 1 card
  makeItem(
    "Equipments :",
    "",
    "",
    "",
    listHtml([
      "Main Stage",
      "100 Banquet Chairs",
      "LED Videotron 4x3",
      "Soundsystem Standart 1000 Watt (2 MIC)",
      "5 Roundtables (d120)",
      "10 Squaretables (d120)",
      "4 Registration Table",
    ]),
  ),
  // Food & Beverage Inclusions — 1 card
  makeItem(
    "Food & Beverage Inclusions :",
    "",
    "",
    "",
    listHtml(["1x Coffe Break", "1x Buffet Meals", "Air Mineral"]),
  ),
];

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
  category: "",
  eventTypeId: "",
  eventTypeName: "",
  details: "",
  time: "",
  weddingSession: "",
  venueId: "",
  venue: "",
  eventDate: "",
  items: DEFAULT_ITEMS.map((it) => ({ ...it })),
  discount: "",
  validUntil: "",
  notes: "",
};

// ── Draft persistence (create mode only) ─────────────────────────────────────

const QUOTATION_DRAFT_KEY = "quotation-draft-v1";

type QuotationDraft = { values: Partial<QuotationFormValues>; terms?: TermRow[]; signingLocation?: string };

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
  terms?: TermRow[],
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
    if (terms) draft.terms = terms;
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
  form: UseFormReturn<QuotationFormValues>;
  expandedSet: Set<string>;
  toggleExpanded: (id: string) => void;
  pendingExpandRef: React.MutableRefObject<boolean>;
  watchedArray: QuotationItemForm[];
}

function ItemListEditor({
  arrayName,
  fields,
  append,
  remove,
  form,
  expandedSet,
  toggleExpanded,
  pendingExpandRef,
  watchedArray,
}: ItemListEditorProps) {
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

  return (
    <div className="space-y-2">
      {fields.map((fieldItem, index) => {
        const isManual = form.getValues(
          `${arrayName}.${index}.manualTotal` as FieldPath<QuotationFormValues>,
        ) as boolean;
        const isOpen = expandedSet.has(fieldItem.id);
        const titleVal = watchedArray?.[index]?.title ?? "";
        const totalVal = watchedArray?.[index]?.total ?? "";
        const qtyVal = watchedArray?.[index]?.qty ?? "";
        const isSectionHeader = titleVal.trimEnd().endsWith(":");
        return (
          <Collapsible
            key={fieldItem.id}
            open={isOpen}
            onOpenChange={() => toggleExpanded(fieldItem.id)}
            className="rounded-xl border border-border bg-muted/30 overflow-hidden"
          >
            {/* Accordion header */}
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
        );
      })}

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

  // Expanded state untuk accordion items (step 2)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  // Ref to signal that the next fields update should auto-expand the last item.
  const pendingExpandItemsRef = useRef(false);
  // Ref to signal that the first card should auto-expand on open.
  const pendingExpandFirstItemsRef = useRef(false);

  // TTD state (step 4)
  const sigSalesRef = useRef<SignatureCanvas>(null);
  const [signatureSales, setSignatureSales] = useState("");
  const [signingLocation, setSigningLocation] = useState("");

  // Term of Payment state (step 3)
  const [terms, setTerms] = useState<TermRow[]>(() => makeDefaultTerms(""));
  // Track COLLAPSED terms — default empty = semua kebuka
  const [collapsedTerms, setCollapsedTerms] = useState<Set<number>>(new Set());

  function toggleTerm(idx: number) {
    setCollapsedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

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

  // ── Client picker state ──────────────────────────────────────────────────
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Search queries ───────────────────────────────────────────────────────
  const { data: leadsResult } = useQuery({
    queryKey: ["leads-search", debouncedSearch],
    queryFn: () =>
      fetchJson<{ items: LeadOption[] }>(
        `/api/leads?search=${encodeURIComponent(debouncedSearch)}&pageSize=5`,
      ),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30_000,
  });
  const leadOptions = leadsResult?.items ?? [];

  const { data: customersResult } = useQuery({
    queryKey: ["customers-search", debouncedSearch],
    queryFn: () =>
      fetchJson<{ data: CustomerOption[] }>(
        `/api/customers?search=${encodeURIComponent(debouncedSearch)}`,
      ),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30_000,
  });
  const customerOptions = customersResult?.data ?? [];

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm<QuotationFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: "items",
  });

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
  const watchedVenueId = form.watch("venueId");
  const watchedItems = form.watch("items");
  const watchedDiscount = form.watch("discount");
  const watchedCategory = form.watch("category");
  const watchedEventTypeId = form.watch("eventTypeId");
  const watchedEventTypeName = form.watch("eventTypeName");
  const watchedWeddingSession = form.watch("weddingSession");
  const watchedEventDate = form.watch("eventDate");
  const watchedTime = form.watch("time");
  const isWeddings = watchedCategory === "WEDDINGS";

  const isStep1Incomplete =
    !watchedClientName?.trim() ||
    !watchedSalesId ||
    !watchedVenueId ||
    !watchedCategory ||
    !watchedEventTypeId ||
    !watchedEventDate ||
    !watchedWeddingSession ||
    !watchedTime?.trim();

  const isStep4Complete = !!signatureSales && !!signingLocation.trim();

  // Name shown in the locked sales field — resolves from the current salesId so
  // edit mode displays the record's actual sales (not the logged-in user).
  const lockedSalesName =
    salesUsers.find((s) => s.id === watchedSalesId)?.fullName ??
    (currentUserIsSales ? (user?.name ?? "—") : "—");

  // ── Auto-fill sales name when salesId changes ────────────────────────────
  useEffect(() => {
    const matched = salesUsers.find((u) => u.id === watchedSalesId);
    if (matched) {
      form.setValue("salesName", matched.fullName ?? "");
      // salesPhone tidak tersedia di AssignableSalesUser — biarkan user isi manual
    }
  }, [watchedSalesId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill time for weddings based on session + derived event type ────
  // Tipe acara (akad/resepsi) diturunkan dari nama Event Type, bukan field terpisah.
  const derivedWeddingEventType = deriveWeddingEventType(watchedEventTypeName);
  useEffect(() => {
    if (!isWeddings) return;
    const autoTime = getWeddingTimeRange(watchedWeddingSession, derivedWeddingEventType);
    if (autoTime) {
      form.setValue("time", autoTime);
    }
  }, [watchedWeddingSession, derivedWeddingEventType, isWeddings]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [watchedVenueId, visibleMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  function getDateStatus(d: Date): "available" | "partial" | "unavailable" | null {
    const key = format(d, "yyyy-MM-dd");
    const a = availability[key];
    if (!a) return null;
    const count = [a.morning, a.evening, a.fullday].filter(Boolean).length;
    if (count === 0) return "unavailable";
    if (count === 3) return "available";
    return "partial";
  }

  function getAvailableSessions(dateStr: string): string[] {
    const a = availability[dateStr];
    if (!a) return ["morning", "evening", "fullday"];
    const sessions: string[] = [];
    if (a.morning) sessions.push("morning");
    if (a.evening) sessions.push("evening");
    if (a.fullday && a.morning && a.evening) sessions.push("fullday");
    return sessions;
  }

  // ── Filtered event types by category ────────────────────────────────────
  const filteredEventTypes = eventTypes.filter(
    (et) => !watchedCategory || et.category === watchedCategory,
  );

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
    setSelectedLeadId("");
    setCustomerId("");
    setClientSearch("");
    setDebouncedSearch("");
    setClientDropdownOpen(false);
    // Reset accordion state; auto-expand the FIRST card so at least one card is
    // open when the user reaches step 2.
    setExpandedItems(new Set());
    pendingExpandFirstItemsRef.current = true;
    // Reset signature state
    sigSalesRef.current?.clear();
    setSignatureSales("");
    setSigningLocation("");
    // Reset terms & collapsed state
    setCollapsedTerms(new Set());

    if (editQuotation) {
      const matchedVenue = venues.find((v) => v.name === editQuotation.venue);
      const matchedSales = salesUsers.find((u) => u.fullName === editQuotation.salesName);
      const editCategory = normalizeCategoryUp(editQuotation.category);
      const items: QuotationItemForm[] =
        editQuotation.items && editQuotation.items.length > 0
          ? editQuotation.items.map((it) => ({
              title: it.description,
              description: "",
              qty: it.qty > 0 ? String(it.qty) : "",
              price: it.price > 0 ? formatNumericDisplay(it.price) : "",
              total: it.total > 0 ? formatNumericDisplay(it.total) : "",
              manualTotal: !!it.manualTotal,
            }))
          : [{ ...EMPTY_ITEM }];
      setTerms(makeDefaultTerms(editCategory));
      form.reset({
        clientName: editQuotation.leadName,
        clientPhone: normalizePhone(editQuotation.leadPhone),
        instansi: editQuotation.instansi ?? "",
        salesId: matchedSales?.id ?? "",
        salesName: editQuotation.salesName,
        salesPhone: editQuotation.salesPhone
          ? normalizePhone(editQuotation.salesPhone)
          : "",
        category: editCategory,
        eventTypeId: "",
        eventTypeName: editQuotation.eventType,
        details: editQuotation.details ?? "",
        time: editQuotation.time ?? "",
        weddingSession: "",
        venueId: matchedVenue?.id ?? "",
        venue: editQuotation.venue,
        eventDate: editQuotation.eventDate,
        items,
        discount:
          editQuotation.discount > 0
            ? formatNumericDisplay(editQuotation.discount)
            : "",
        validUntil: editQuotation.validUntil,
        notes: editQuotation.notes,
      });
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
        // Restore terms dari draft
        if (Array.isArray(draft.terms) && draft.terms.length > 0) {
          setTerms(draft.terms);
        } else {
          const draftCat = draft.values.category ?? "";
          setTerms(makeDefaultTerms(draftCat));
        }
        // Restore signingLocation dari draft
        if (draft.signingLocation) {
          setSigningLocation(draft.signingLocation);
        }
      } else {
        form.reset({
          ...DEFAULT_VALUES,
          items: DEFAULT_ITEMS.map((it) => ({ ...it })),
        });
        setTerms(makeDefaultTerms(""));
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
      persistQuotationDraft(values as Partial<QuotationFormValues>, terms, signingLocation);
    });
    return () => sub.unsubscribe();
  }, [open, isEdit, terms, signingLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist terms & signingLocation changes to draft (not triggered by form.watch).
  useEffect(() => {
    if (!open || isEdit) return;
    persistQuotationDraft(form.getValues(), terms, signingLocation);
  }, [terms, signingLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill from lead ──────────────────────────────────────────────────
  function applyLeadAutofill(lead: LeadOption) {
    setSelectedLeadId(lead.id);
    setCustomerId("");
    form.setValue("clientName", lead.name);
    // Phone: ambil nomor pertama dari contactNumbers
    const firstContact = lead.contactNumbers?.[0];
    if (firstContact?.number) {
      // Sudah dalam format "62xxx" — strip "62" prefix untuk display dengan +62 prefix
      const num = firstContact.number.startsWith("62")
        ? firstContact.number.slice(2)
        : normalizePhone(firstContact.number);
      form.setValue("clientPhone", num);
    }
    // Category UPPERCASE
    if (lead.category) {
      const cat = normalizeCategoryUp(lead.category);
      form.setValue("category", cat);
      // Reset event type saat category berubah
      form.setValue("eventTypeId", "");
      form.setValue("eventTypeName", "");
    }
    // Venue
    if (lead.venueId) {
      form.setValue("venueId", lead.venueId);
      const matchedVenue = venues.find((v) => v.id === lead.venueId);
      form.setValue("venue", matchedVenue?.name ?? "");
      form.setValue("eventDate", "");
    }
    // Event type
    if (lead.eventType) {
      form.setValue("eventTypeId", lead.eventType.id);
      form.setValue("eventTypeName", lead.eventType.name);
    }
    // Event date
    if (lead.eventDate) {
      const dateStr = new Date(lead.eventDate).toISOString().split("T")[0];
      form.setValue("eventDate", dateStr);
    }
    // Sales — autofill dari sales yang di-assign ke lead. Skip kalau user yang
    // login adalah sales (field-nya terkunci ke dirinya sendiri).
    if (!currentUserIsSales && lead.assignedTo?.id) {
      form.setValue("salesId", lead.assignedTo.id);
      form.setValue("salesName", lead.assignedTo.fullName ?? "");
    }
    setClientSearch(lead.name);
    setClientDropdownOpen(false);
  }

  // ── Auto-fill from customer ──────────────────────────────────────────────
  function applyCustomerAutofill(customer: CustomerOption) {
    setCustomerId(customer.id);
    setSelectedLeadId("");
    form.setValue("clientName", customer.name);
    // mobileNumber bisa string JSON array atau plain number string
    if (customer.mobileNumber) {
      let phone = "";
      try {
        const parsed = JSON.parse(customer.mobileNumber);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          const raw: string = typeof first === "object" ? (first.number ?? "") : String(first);
          phone = raw.startsWith("62") ? raw.slice(2) : normalizePhone(raw);
        }
      } catch {
        // Plain string
        const raw = customer.mobileNumber.split(",")[0].trim();
        phone = raw.startsWith("62") ? raw.slice(2) : normalizePhone(raw);
      }
      if (phone) form.setValue("clientPhone", phone);
    }
    setClientSearch(customer.name);
    setClientDropdownOpen(false);
  }

  // ── Regenerate default terms saat category berubah ──────────────────────
  // Hanya untuk create mode supaya tidak overwrite edit-mode terms.
  useEffect(() => {
    if (!open || isEdit) return;
    setTerms(makeDefaultTerms(watchedCategory));
    setCollapsedTerms(new Set());
  }, [watchedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recalc term dates saat event date berubah ────────────────────────────
  useEffect(() => {
    if (!watchedEventDate) return;
    setTerms((prev) => recalcTermDates(prev, watchedEventDate + "T00:00:00.000Z"));
  }, [watchedEventDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ───────────────────────────────────────────────────────────
  async function handleNext() {
    if (step === 1) {
      const ok = await form.trigger([
        "clientName",
        "salesId",
        "venueId",
        "category",
        "eventTypeId",
        "eventDate",
        "weddingSession",
        "time",
      ]);
      if (ok) setStep(2);
    } else if (step === 2) {
      // Validasi validUntil sebelum lanjut ke step 3 (TOP)
      const ok = await form.trigger(["validUntil"]);
      if (ok) setStep(3);
    } else if (step === 3) {
      // Validasi minimal: ada minimal 1 term
      if (terms.length === 0) {
        toast.error("Minimal satu term of payment wajib diisi.");
        return;
      }
      setStep(4);
    }
  }

  function handlePrevious() {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      // Clear signature saat kembali dari step 4
      sigSalesRef.current?.clear();
      setSignatureSales("");
      setStep(3);
    }
  }

  function onSubmit(_values: QuotationFormValues) {
    // Susun payload (termasuk items, terms, signature) — siap dipakai saat backend tersedia
    const _payload = {
      ..._values,
      signingLocation,
      signatureSales,
      termOfPayments: terms
        .filter((t) => t.dueDate)
        .map((t) => ({
          name: t.name,
          amount: t.amount,
          dueDate: t.dueDate,
          sortOrder: t.sortOrder,
          paymentStatus: t.paymentStatus,
        })),
    };
    void _payload; // mark as used, backend call belum diimplementasikan
    if (!isEdit) clearQuotationDraft();
    toast.success(
      isEdit ? "Quotation berhasil diperbarui." : "Quotation berhasil disimpan.",
    );
    // Reset terms & signature setelah submit
    setTerms(makeDefaultTerms(""));
    setCollapsedTerms(new Set());
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
      totalSteps={4}
      stepperType="short"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-2">
          <Form {...form}>
            <form className="space-y-3 pb-2">

              {/* ════════════════ STEP 1 — INFORMASI ════════════════ */}
              <div className={cn(step !== 1 && "hidden", "space-y-3")}>

                {/* ── Info Client ─────────────────────────────────── */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Info Client
                  </p>

                  {/* Client / Lead — unified search picker */}
                  <div ref={clientDropdownRef}>
                    <FormField
                      control={form.control}
                      name="clientName"
                      rules={{ required: "Client / Lead wajib diisi" }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Client / Lead *</FormLabel>
                          {selectedLeadId && (
                            <p className="text-xs text-[var(--brand-gold)] mt-0.5">
                              Dari Lead — data di-autofill, semua field bisa diedit
                            </p>
                          )}
                          {customerId && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Customer terdaftar — data di-autofill, semua field bisa diedit
                            </p>
                          )}
                          <div className="relative mt-1">
                            <FormControl>
                              <Input
                                value={clientSearch || field.value}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  field.onChange(val);
                                  setClientSearch(val);
                                  setSelectedLeadId("");
                                  setCustomerId("");
                                  setClientDropdownOpen(true);
                                }}
                                onFocus={() => {
                                  if ((clientSearch || field.value).trim()) {
                                    setClientDropdownOpen(true);
                                  }
                                }}
                                placeholder="Cari lead atau customer terdaftar..."
                                className="w-full"
                              />
                            </FormControl>
                            {clientDropdownOpen &&
                              (clientSearch || field.value).trim() &&
                              (leadOptions.length > 0 || customerOptions.length > 0) && (
                                <div className="absolute z-50 w-full mt-1 max-h-80 overflow-auto rounded-xl border bg-background shadow-md">
                                  {leadOptions.length > 0 && (
                                    <div>
                                      <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        Dari Leads
                                      </p>
                                      {leadOptions.map((lead) => (
                                        <div
                                          key={lead.id}
                                          className="cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors"
                                          onClick={() => applyLeadAutofill(lead)}
                                        >
                                          <p className="font-medium">{lead.name}</p>
                                          {lead.email && (
                                            <p className="text-xs text-muted-foreground">
                                              {lead.email}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {customerOptions.length > 0 && (
                                    <div>
                                      {leadOptions.length > 0 && (
                                        <div className="border-t my-1" />
                                      )}
                                      <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        Customer Terdaftar
                                      </p>
                                      {customerOptions.map((c) => (
                                        <div
                                          key={c.id}
                                          className="cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors"
                                          onClick={() => applyCustomerAutofill(c)}
                                        >
                                          <p className="font-medium">{c.name}</p>
                                          {c.email && (
                                            <p className="text-xs text-muted-foreground">
                                              {c.email}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="clientPhone"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>No. Hp Client</FormLabel>
                          <FormControl>
                            <div className="relative w-full">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none pointer-events-none">
                                +62
                              </span>
                              <Input
                                value={field.value}
                                onChange={(e) =>
                                  field.onChange(e.target.value.replace(/\D/g, ""))
                                }
                                placeholder="8xx xxxx xxxx"
                                inputMode="tel"
                                className="w-full pl-10"
                              />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="instansi"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>
                            Instansi{" "}
                            <span className="font-normal text-muted-foreground">
                              (opsional)
                            </span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="mis. Al Azhar"
                              className="w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* ── Sales ───────────────────────────────────────── */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Sales
                  </p>
                  {currentUserIsSales ? (
                    /* Logged-in user is a sales → locked to themselves */
                    <div className="w-full">
                      <FormLabel className={LABEL_CLASS}>Sales *</FormLabel>
                      <div className="mt-1 flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
                        {lockedSalesName}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Quotation ini akan tercatat atas nama Anda.
                      </p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="salesId"
                      rules={{ required: "Sales wajib dipilih" }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Sales *</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={salesUsers.map((u) => ({
                                id: u.id,
                                name: u.fullName ?? "",
                              }))}
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
                  <FormField
                    control={form.control}
                    name="salesPhone"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>No. Hp Sales</FormLabel>
                        <FormControl>
                          <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none pointer-events-none">
                              +62
                            </span>
                            <Input
                              value={field.value}
                              onChange={(e) =>
                                field.onChange(e.target.value.replace(/\D/g, ""))
                              }
                              placeholder="8xx xxxx xxxx"
                              inputMode="tel"
                              className="w-full pl-10"
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* ── Detail Event ─────────────────────────────────── */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Detail Event
                  </p>
                  <div className="flex flex-col gap-3">

                    {/* Venue */}
                    <FormField
                      control={form.control}
                      name="venueId"
                      rules={{ required: "Venue wajib dipilih" }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Venue *</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={venues.map((v) => ({ id: v.id, name: v.name }))}
                              value={field.value}
                              onChange={(id) => {
                                field.onChange(id);
                                const matched = venues.find((v) => v.id === id);
                                form.setValue("venue", matched?.name ?? "");
                                // Reset date & session when venue changes
                                form.setValue("eventDate", "");
                                form.setValue("weddingSession", "");
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

                    {/* Tipe Booking */}
                    <FormField
                      control={form.control}
                      name="category"
                      rules={{ required: "Tipe booking wajib dipilih" }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Tipe Booking *</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(v) => {
                              field.onChange(v);
                              // Reset event type saat category berubah
                              form.setValue("eventTypeId", "");
                              form.setValue("eventTypeName", "");
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pilih tipe booking..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="WEDDINGS">Wedding</SelectItem>
                              <SelectItem value="MICE">MICE</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Event Type — searchable, difilter by category */}
                    <FormField
                      control={form.control}
                      name="eventTypeId"
                      rules={{ required: "Event type wajib dipilih" }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Event Type *</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={filteredEventTypes.map((et) => ({ id: et.id, name: et.name }))}
                              value={field.value}
                              onChange={(v) => {
                                field.onChange(v);
                                const matched = filteredEventTypes.find((et) => et.id === v);
                                form.setValue("eventTypeName", matched?.name ?? "");
                              }}
                              placeholder={
                                !watchedCategory
                                  ? "Pilih tipe booking dulu"
                                  : "Pilih event type..."
                              }
                              searchPlaceholder="Cari event type..."
                              emptyText="Tidak ada event type"
                              disabled={!watchedCategory || filteredEventTypes.length === 0}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    {/* Tanggal Event + Availability */}
                    <FormField
                      control={form.control}
                      name="eventDate"
                      rules={{ required: "Tanggal event wajib diisi" }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Tanggal Event *</FormLabel>
                          <Popover>
                            <PopoverTrigger
                              render={
                                <Button
                                  variant="outline"
                                  disabled={!watchedVenueId}
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  <CalendarSolarIcon
                                    weight="BoldDuotone"
                                    className="mr-2 h-4 w-4"
                                  />
                                  {watchedVenueId
                                    ? field.value
                                      ? format(
                                          new Date(field.value + "T00:00:00"),
                                          "PPP",
                                        )
                                      : "Pilih tanggal event"
                                    : "Pilih venue terlebih dahulu"}
                                </Button>
                              }
                            />
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                captionLayout="dropdown"
                                selected={
                                  field.value
                                    ? new Date(field.value + "T00:00:00")
                                    : undefined
                                }
                                onSelect={(date) => {
                                  if (date) {
                                    const y = date.getFullYear();
                                    const m = String(date.getMonth() + 1).padStart(
                                      2,
                                      "0",
                                    );
                                    const d = String(date.getDate()).padStart(2, "0");
                                    field.onChange(`${y}-${m}-${d}`);
                                    // Reset session when date changes
                                    form.setValue("weddingSession", "");
                                  } else {
                                    field.onChange("");
                                    form.setValue("weddingSession", "");
                                  }
                                }}
                                disabled={(d) => getDateStatus(d) === "unavailable"}
                                fromYear={new Date().getFullYear() - 10}
                                toYear={new Date().getFullYear() + 5}
                                defaultMonth={
                                  field.value
                                    ? new Date(field.value + "T00:00:00")
                                    : new Date()
                                }
                                onMonthChange={setVisibleMonth}
                                modifiers={{
                                  available: (d) =>
                                    !!watchedVenueId && getDateStatus(d) === "available",
                                  partial: (d) =>
                                    !!watchedVenueId && getDateStatus(d) === "partial",
                                  unavailable: (d) =>
                                    !!watchedVenueId &&
                                    getDateStatus(d) === "unavailable",
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
                            <p className="text-xs text-muted-foreground mt-1">
                              Mengecek ketersediaan...
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Session — selalu muncul, difilter dari availability */}
                    <FormField
                      control={form.control}
                      name="weddingSession"
                      rules={{ required: "Session wajib dipilih" }}
                      render={({ field }) => {
                        const sessions = watchedEventDate
                          ? getAvailableSessions(watchedEventDate)
                          : ["morning", "evening", "fullday"];
                        return (
                          <FormItem className="w-full">
                            <FormLabel className={LABEL_CLASS}>Session *</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(v) =>
                                field.onChange(v as WeddingSession)
                              }
                              disabled={!watchedVenueId || !watchedEventDate}
                            >
                              <FormControl>
                                <SelectTrigger
                                  className={cn(
                                    "w-full",
                                    (!watchedVenueId || !watchedEventDate) &&
                                      "opacity-60",
                                  )}
                                >
                                  <SelectValue
                                    placeholder={
                                      !watchedVenueId
                                        ? "Pilih venue dulu"
                                        : !watchedEventDate
                                          ? "Pilih tanggal dulu"
                                          : "Pilih session..."
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sessions.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {SESSION_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    {/* Time — auto-fill dari session + event type untuk weddings */}
                    <FormField
                      control={form.control}
                      name="time"
                      rules={{ required: "Time wajib diisi" }}
                      render={({ field }) => (
                        <FormItem className="flex w-full flex-col">
                          <FormLabel className={LABEL_CLASS}>
                            Time *
                            {isWeddings &&
                              watchedWeddingSession &&
                              derivedWeddingEventType && (
                                <span className="ml-2 font-normal text-muted-foreground text-xs">
                                  (auto-filled, bisa diubah manual)
                                </span>
                              )}
                          </FormLabel>
                          <FormControl>
                            <TimeRangePicker
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Pilih waktu (bisa rentang)..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Details</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            placeholder="mis. Venue Only"
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
                {/* ── Items ─────────────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className={LABEL_CLASS}>Items</p>
                    <span className="text-xs text-muted-foreground">
                      Total = Qty × Harga (bisa manual)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Akhiri judul dengan &quot;:&quot; untuk jadi judul section
                    (mis. &quot;Ballroom Facilities :&quot;). Harga boleh
                    dikosongkan untuk item tanpa biaya.
                  </p>

                  <ItemListEditor
                    arrayName="items"
                    fields={itemFields}
                    append={appendItem}
                    remove={removeItem}
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

                {/* ── Berlaku Sampai ────────────────────────────────── */}
                <FormField
                  control={form.control}
                  name="validUntil"
                  rules={{ required: "Tanggal berlaku wajib diisi" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Berlaku Sampai *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* ── Catatan ───────────────────────────────────────── */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Catatan</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="Catatan tambahan (opsional)..."
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ════════════════ STEP 3 — TERM OF PAYMENT ════════════════ */}
              <div className={cn(step !== 3 && "hidden", "space-y-3")}>
                <div>
                  <p className={LABEL_CLASS}>Term of Payment</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {watchedCategory === "WEDDINGS"
                      ? "7 termin default (Wedding). Tanggal jatuh tempo dikalkulasi otomatis dari tanggal event."
                      : "2 termin default (MICE / lainnya). Sesuaikan nama, nominal, dan tanggal jatuh tempo."}
                  </p>
                </div>

                <div className="space-y-2">
                  {terms.map((t, idx) => {
                    const isOpen = !collapsedTerms.has(idx);
                    const payStatus = t.paymentStatus ?? "unpaid";
                    const statusLabel = payStatus.charAt(0).toUpperCase() + payStatus.slice(1);
                    return (
                      <Collapsible
                        key={idx}
                        open={isOpen}
                        onOpenChange={() => toggleTerm(idx)}
                        className="rounded-xl border border-border bg-muted/30 overflow-hidden"
                      >
                        {/* ── Header — trigger + hapus sebagai sibling (bukan nested button) ── */}
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
                              <p
                                className={cn(
                                  "text-sm font-medium truncate",
                                  t.name ? "text-foreground" : "text-muted-foreground italic",
                                )}
                              >
                                {t.name || "Term tanpa nama"}
                              </p>
                              {!isOpen && (
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  <span
                                    className={cn(
                                      payStatus === "paid" ? "text-foreground" : "text-muted-foreground",
                                    )}
                                  >
                                    {statusLabel}
                                  </span>
                                  {t.amount ? ` · Rp${t.amount.toLocaleString("id-ID")}` : ""}
                                  {t.dueDate ? ` · ${format(new Date(t.dueDate), "dd MMM yyyy")}` : ""}
                                </p>
                              )}
                            </div>
                          </CollapsibleTrigger>
                          {/* Tombol hapus — sibling dari CollapsibleTrigger, bukan child-nya */}
                          {terms.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const eventDateStr = watchedEventDate
                                  ? watchedEventDate + "T00:00:00.000Z"
                                  : "";
                                setTerms((prev) =>
                                  recalcTermDates(
                                    prev.filter((_, i) => i !== idx),
                                    eventDateStr,
                                  ),
                                );
                                setCollapsedTerms((prev) => {
                                  const next = new Set<number>();
                                  prev.forEach((n) => {
                                    if (n < idx) {
                                      next.add(n);
                                    } else if (n > idx) {
                                      next.add(n - 1);
                                    }
                                  });
                                  return next;
                                });
                              }}
                              aria-label="Hapus term"
                              className="shrink-0 p-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* ── Body ── */}
                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-3 border-t border-border/60">
                            {/* Term name + Status — satu row */}
                            <div className="pt-2 flex items-center gap-2">
                              <Input
                                value={t.name}
                                onChange={(e) =>
                                  setTerms((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, name: e.target.value } : x,
                                    ),
                                  )
                                }
                                placeholder="Nama term (mis. Booking Fee)"
                                className="flex-1 border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto"
                              />
                              <Select
                                value={payStatus}
                                onValueChange={(v) =>
                                  setTerms((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? { ...x, paymentStatus: v as TermRow["paymentStatus"] }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="w-32 h-8 bg-background shrink-0">
                                  <span
                                    className={cn(
                                      "text-xs font-semibold",
                                      payStatus === "paid"
                                        ? "text-foreground"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {statusLabel}
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_STATUS.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Amount + Due Date row */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                              <div className="sm:flex-[2]">
                                <Input
                                  value={t.amount ? t.amount.toLocaleString("id-ID") : ""}
                                  onChange={(e) => {
                                    const num =
                                      parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                                    setTerms((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, amount: num } : x,
                                      ),
                                    );
                                  }}
                                  placeholder="Amount"
                                  inputMode="numeric"
                                  className="bg-background"
                                />
                              </div>
                              <div className="sm:flex-1">
                                <Popover>
                                  <PopoverTrigger
                                    render={
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full justify-start text-left font-normal bg-background",
                                          !t.dueDate && "text-muted-foreground",
                                        )}
                                      >
                                        <CalendarSolarIcon
                                          weight="BoldDuotone"
                                          className="mr-2 h-4 w-4"
                                        />
                                        {t.dueDate
                                          ? format(new Date(t.dueDate), "dd MMM yyyy")
                                          : "Pilih Tanggal"}
                                      </Button>
                                    }
                                  />
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      captionLayout="dropdown"
                                      selected={
                                        t.dueDate ? new Date(t.dueDate) : undefined
                                      }
                                      onSelect={(date) =>
                                        setTerms((prev) =>
                                          prev.map((x, i) =>
                                            i === idx
                                              ? { ...x, dueDate: date ? date.toISOString() : "" }
                                              : x,
                                          ),
                                        )
                                      }
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>

                {/* Tambah Payment button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed gap-1.5 text-muted-foreground rounded-xl"
                  onClick={() => {
                    const eventDateStr = watchedEventDate
                      ? watchedEventDate + "T00:00:00.000Z"
                      : "";
                    setTerms((prev) =>
                      recalcTermDates(
                        [
                          ...prev,
                          {
                            name: "",
                            amount: 0,
                            dueDate: "",
                            sortOrder: prev.length,
                            paymentStatus: "unpaid",
                          },
                        ],
                        eventDateStr,
                      ),
                    );
                  }}
                >
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                  Tambah Payment
                </Button>
              </div>

              {/* ════════════════ STEP 4 — TTD ════════════════ */}
              <div className={cn(step !== 4 && "hidden", "space-y-6")}>
                <div>
                  <FormLabel className={cn("text-sm", "font-medium", "text-foreground", "mb-2", "block")}>
                    Lokasi Tanda Tangan *
                  </FormLabel>
                  <Input
                    placeholder="Contoh: Jakarta, Bandung, Surabaya..."
                    value={signingLocation}
                    onChange={(e) => setSigningLocation(e.target.value)}
                  />
                </div>
                <div>
                  <FormLabel className={cn("text-sm", "font-medium", "text-foreground", "mb-2", "block")}>
                    Tanda Tangan Sales *
                  </FormLabel>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-xl overflow-hidden bg-muted",
                      !signatureSales ? "border-destructive/40" : "border-border",
                    )}
                  >
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
                  </div>
                  <div className={cn("flex", "items-center", "justify-between", "mt-1.5")}>
                    {!signatureSales && (
                      <p className={cn("text-xs", "text-destructive")}>
                        Tanda tangan sales wajib diisi
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        sigSalesRef.current?.clear();
                        setSignatureSales("");
                      }}
                      className={cn(
                        "text-xs",
                        "text-destructive",
                        "hover:text-destructive",
                        "underline",
                        "ml-auto",
                      )}
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
                disabled={!isStep4Complete}
                className="flex-[60%] cursor-pointer"
              >
                {isEdit ? "Simpan" : "Tambah"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
