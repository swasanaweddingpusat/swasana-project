"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
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
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import {
  AddCircle,
  TrashBinTrash,
  Refresh,
  ArrowRight,
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
  WEDDING_SESSION_LABELS,
  WEDDING_EVENT_TYPE_LABELS,
  getWeddingTimeRange,
  type WeddingSession,
  type WeddingEventType,
} from "@/lib/constants/wedding-session-times";
import { cn } from "@/lib/utils";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useSalesUsers } from "@/hooks/use-sales-users";
import type { QuotationItem } from "./quotations-table";

// ── Types ────────────────────────────────────────────────────────────────────

interface QuotationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuotation: QuotationItem | null;
}

interface QuotationItemForm {
  description: string;
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
  weddingEventType: WeddingEventType | "";
  venueId: string;
  venue: string;
  eventDate: string;
  // Step 2 — fasilitas / item
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

const LABEL_CLASS = cn("text-sm", "font-medium", "text-foreground");

// ── Constants ────────────────────────────────────────────────────────────────

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
  weddingEventType: "",
  venueId: "",
  venue: "",
  eventDate: "",
  items: [{ description: "", qty: "", price: "", total: "", manualTotal: false }],
  discount: "",
  validUntil: "",
  notes: "",
};

const EMPTY_ITEM: QuotationItemForm = {
  description: "",
  qty: "",
  price: "",
  total: "",
  manualTotal: false,
};

// ── Component ────────────────────────────────────────────────────────────────

export function QuotationDrawer({
  open,
  onOpenChange,
  editQuotation,
}: QuotationDrawerProps) {
  const isEdit = !!editQuotation;
  const [step, setStep] = useState<1 | 2>(1);

  // ── Real data hooks ──────────────────────────────────────────────────────
  const { data: venues = [] } = useVenues();
  const { data: eventTypes = [] } = useEventTypes();
  const { users: salesUsers } = useSalesUsers();

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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedSalesId = form.watch("salesId");
  const watchedVenueId = form.watch("venueId");
  const watchedItems = form.watch("items");
  const watchedDiscount = form.watch("discount");
  const watchedCategory = form.watch("category");
  const watchedWeddingSession = form.watch("weddingSession");
  const watchedWeddingEventType = form.watch("weddingEventType");
  const watchedEventDate = form.watch("eventDate");
  const isWeddings = watchedCategory === "WEDDINGS";

  // ── Auto-fill sales name when salesId changes ────────────────────────────
  useEffect(() => {
    const matched = salesUsers.find((u) => u.id === watchedSalesId);
    if (matched) {
      form.setValue("salesName", matched.fullName ?? "");
      // salesPhone tidak tersedia di AssignableSalesUser — biarkan user isi manual
    }
  }, [watchedSalesId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill time for weddings based on session + event type ────────────
  useEffect(() => {
    if (!isWeddings) return;
    const autoTime = getWeddingTimeRange(watchedWeddingSession, watchedWeddingEventType);
    if (autoTime) {
      form.setValue("time", autoTime);
    }
  }, [watchedWeddingSession, watchedWeddingEventType, isWeddings]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Reset session when venue changes
    form.setValue("weddingSession", "");
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

  function recomputeRowTotal(index: number) {
    const item = form.getValues(`items.${index}`);
    if (item?.manualTotal) return;
    const qty = parseNumericInput(item?.qty ?? "");
    const price = parseNumericInput(item?.price ?? "");
    const total = qty * price;
    form.setValue(
      `items.${index}.total`,
      total > 0 ? total.toLocaleString("id-ID") : "",
      { shouldDirty: true },
    );
  }

  function revertRowTotal(index: number) {
    form.setValue(`items.${index}.manualTotal`, false, { shouldDirty: true });
    recomputeRowTotal(index);
  }

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelectedLeadId("");
    setCustomerId("");
    setClientSearch("");
    setDebouncedSearch("");
    setClientDropdownOpen(false);

    if (editQuotation) {
      const matchedVenue = venues.find((v) => v.name === editQuotation.venue);
      const matchedSales = salesUsers.find((u) => u.fullName === editQuotation.salesName);
      const items: QuotationItemForm[] =
        editQuotation.items && editQuotation.items.length > 0
          ? editQuotation.items.map((it) => ({
              description: it.description,
              qty: it.qty > 0 ? String(it.qty) : "",
              price: it.price > 0 ? formatNumericDisplay(it.price) : "",
              total: it.total > 0 ? formatNumericDisplay(it.total) : "",
              manualTotal: !!it.manualTotal,
            }))
          : [{ ...EMPTY_ITEM }];
      form.reset({
        clientName: editQuotation.leadName,
        clientPhone: normalizePhone(editQuotation.leadPhone),
        instansi: editQuotation.instansi ?? "",
        salesId: matchedSales?.id ?? "",
        salesName: editQuotation.salesName,
        salesPhone: editQuotation.salesPhone
          ? normalizePhone(editQuotation.salesPhone)
          : "",
        category: normalizeCategoryUp(editQuotation.category),
        eventTypeId: "",
        eventTypeName: editQuotation.eventType,
        details: editQuotation.details ?? "",
        time: editQuotation.time ?? "",
        weddingSession: "",
        weddingEventType: "",
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
      form.reset(DEFAULT_VALUES);
    }
  }, [open, editQuotation]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Navigation ───────────────────────────────────────────────────────────
  async function handleNext() {
    const ok = await form.trigger(["clientName", "salesId"]);
    if (ok) setStep(2);
  }

  function onSubmit(_values: QuotationFormValues) {
    toast.success(
      isEdit ? "Quotation berhasil diperbarui." : "Quotation berhasil disimpan.",
    );
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
      totalSteps={2}
      stepperType="short"
      onBack={step === 2 ? () => setStep(1) : undefined}
      backButtonLabel="Kembali ke Informasi"
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

                    {/* Tipe Booking */}
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Tipe Booking</FormLabel>
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

                    {/* Event Type — dropdown real, difilter by category */}
                    <FormField
                      control={form.control}
                      name="eventTypeId"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Event Type</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(v) => {
                              field.onChange(v);
                              const matched = filteredEventTypes.find((et) => et.id === v);
                              form.setValue("eventTypeName", matched?.name ?? "");
                            }}
                            disabled={filteredEventTypes.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger
                                className={cn(
                                  "w-full",
                                  filteredEventTypes.length === 0 && "opacity-60",
                                )}
                              >
                                <SelectValue
                                  placeholder={
                                    !watchedCategory
                                      ? "Pilih tipe booking dulu"
                                      : filteredEventTypes.length === 0
                                        ? "Tidak ada event type"
                                        : "Pilih event type..."
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredEventTypes.map((et) => (
                                <SelectItem key={et.id} value={et.id}>
                                  {et.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Venue */}
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
                                // Reset date & session when venue changes
                                form.setValue("eventDate", "");
                                form.setValue("weddingSession", "");
                              }}
                              placeholder="Pilih / cari venue..."
                              searchPlaceholder="Cari venue..."
                              emptyText="Venue tidak ditemukan"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    {/* Tanggal Event + Availability */}
                    <FormField
                      control={form.control}
                      name="eventDate"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Tanggal Event</FormLabel>
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
                      render={({ field }) => {
                        const sessions = watchedEventDate
                          ? getAvailableSessions(watchedEventDate)
                          : ["morning", "evening", "fullday"];
                        return (
                          <FormItem className="w-full">
                            <FormLabel className={LABEL_CLASS}>Session</FormLabel>
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

                    {/* Wedding Event Type — weddings only */}
                    {isWeddings && (
                      <FormField
                        control={form.control}
                        name="weddingEventType"
                        render={({ field }) => (
                          <FormItem className="w-full">
                            <FormLabel className={LABEL_CLASS}>Type Acara</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(v) =>
                                field.onChange(v as WeddingEventType)
                              }
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Pilih type acara" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(
                                  Object.entries(
                                    WEDDING_EVENT_TYPE_LABELS,
                                  ) as [WeddingEventType, string][]
                                ).map(([val, label]) => (
                                  <SelectItem key={val} value={val}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Time — auto-fill dari session+type untuk weddings */}
                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem className="flex w-full flex-col">
                          <FormLabel className={LABEL_CLASS}>
                            Time
                            {isWeddings &&
                              watchedWeddingSession &&
                              watchedWeddingEventType && (
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

              {/* ════════════════ STEP 2 — FASILITAS / ITEM ════════════════ */}
              <div className={cn(step !== 2 && "hidden", "space-y-3")}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className={LABEL_CLASS}>Fasilitas / Item</p>
                    <span className="text-xs text-muted-foreground">
                      Total = Qty × Harga (bisa manual)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Akhiri deskripsi dengan &quot;:&quot; untuk jadi judul section
                    (mis. &quot;A. Ballroom Facilities :&quot;). Harga boleh
                    dikosongkan untuk item tanpa biaya.
                  </p>

                  <div className="space-y-2">
                    {fields.map((fieldItem, index) => {
                      const isManual = form.getValues(`items.${index}.manualTotal`);
                      return (
                        <div
                          key={fieldItem.id}
                          className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.description`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Deskripsi fasilitas / judul section"
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                              aria-label="Hapus item"
                              className="shrink-0 text-destructive hover:bg-destructive/10"
                            >
                              <TrashBinTrash
                                weight="BoldDuotone"
                                className="h-4 w-4"
                              />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.qty`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-muted-foreground">
                                    Qty
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      value={field.value}
                                      onChange={(e) => {
                                        field.onChange(
                                          e.target.value.replace(/\D/g, ""),
                                        );
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
                              name={`items.${index}.price`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-muted-foreground">
                                    Harga
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      value={field.value}
                                      onChange={(e) => {
                                        field.onChange(
                                          formatNumericDisplay(e.target.value),
                                        );
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
                              name={`items.${index}.total`}
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
                                        <Refresh
                                          weight="BoldDuotone"
                                          className="h-3 w-3"
                                        />
                                        auto
                                      </button>
                                    )}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      value={field.value}
                                      onChange={(e) => {
                                        form.setValue(
                                          `items.${index}.manualTotal`,
                                          true,
                                        );
                                        field.onChange(
                                          formatNumericDisplay(e.target.value),
                                        );
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
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ ...EMPTY_ITEM })}
                    className="w-full rounded-xl border-dashed"
                  >
                    <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1" />
                    Tambah Item
                  </Button>
                </div>

                {/* Ringkasan */}
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

                {/* Berlaku Sampai */}
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

                {/* Catatan */}
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
                onClick={() => setStep(1)}
                className="flex-[40%] cursor-pointer"
              >
                Kembali
              </Button>
            )}
            {step === 1 ? (
              <Button onClick={handleNext} className="flex-[60%] cursor-pointer">
                Lanjut
                <ArrowRight weight="BoldDuotone" className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={form.handleSubmit(onSubmit)}
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
