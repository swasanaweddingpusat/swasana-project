"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { SignaturePad } from "@/components/shared/signature-pad";
import {
  Calendar as CalendarIcon,
  TrashBinTrash,
  AddCircle,
} from "@solar-icons/react";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useSalesMice,
  useCreateMiceBooking,
  useUpdateMiceBooking,
} from "@/hooks/use-mice-bookings";
import { createMiceBookingSchema } from "@/lib/validations/booking-mice";
import type { MiceBookingItem } from "./types";
import type { BookingPrefillLead } from "@/types/lead";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MiceBookingDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: MiceBookingItem | null;
  /** When provided (create mode), the drawer opens pre-filled from this lead. */
  prefillLead?: BookingPrefillLead | null;
  /** Called after a successful create/update. */
  onSuccess?: () => void;
}

interface MiceFormValues {
  clientName: string;
  clientPhone: string;
  venueId: string;
  eventTypeId: string;
  eventDate: string;
  estimatedPax: string;
  salesId: string;
  notes: string;
}

interface CustomerOption {
  id: string;
  name: string;
  mobileNumber: unknown;
  email: string;
}
interface LeadOption {
  id: string;
  name: string;
  email: string | null;
  contactNumbers: Array<{ label?: string; name?: string; number: string }>;
  assignedTo: { id: string; fullName: string | null } | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

/** Extract first phone number from a customer's mobileNumber field (JSON or string). */
function firstPhone(mobileNumber: unknown): string {
  if (Array.isArray(mobileNumber)) {
    const first = mobileNumber[0] as { number?: string } | undefined;
    return first?.number ?? "";
  }
  if (typeof mobileNumber === "string") {
    return mobileNumber.split(",")[0]?.trim() ?? "";
  }
  return "";
}

interface TermRow {
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
  paymentStatus: "unpaid" | "paid" | "partial";
}

const PAYMENT_STATUS = ["unpaid", "paid", "partial"] as const;

const DEFAULT_VALUES: MiceFormValues = {
  clientName: "",
  clientPhone: "",
  venueId: "",
  eventTypeId: "",
  eventDate: "",
  estimatedPax: "",
  salesId: "",
  notes: "",
};

const TOTAL_STEPS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRpToNumber(formatted: string): number {
  return parseInt(formatted.replace(/\D/g, "") || "0", 10);
}

function fmtAmount(n: number): string {
  return n > 0 ? n.toLocaleString("id-ID") : "";
}

function makeDefaultTerms(): TermRow[] {
  return [
    { name: "Booking Fee / DP", amount: 0, dueDate: "", sortOrder: 0, paymentStatus: "unpaid" },
    { name: "Final Payment", amount: 0, dueDate: "", sortOrder: 1, paymentStatus: "unpaid" },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MiceBookingDrawer({
  open,
  onOpenChange,
  booking,
  prefillLead,
  onSuccess,
}: MiceBookingDrawerProps) {
  const isEdit = !!booking;
  const form = useForm<MiceFormValues>({ defaultValues: DEFAULT_VALUES });
  const signatureRef = useRef<string | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [terms, setTerms] = useState<TermRow[]>(makeDefaultTerms);
  const [signingLocation, setSigningLocation] = useState("");

  // Venue availability (mirrors Wedding drawer pattern)
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [availLoading, setAvailLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [eventDatePopoverOpen, setEventDatePopoverOpen] = useState(false);

  // Customer / Lead picker (mirror wedding drawer)
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const { data: customersResult } = useQuery({
    queryKey: ["customers", debouncedSearch],
    queryFn: () => fetchJson<{ data: CustomerOption[] }>(`/api/customers?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: open && debouncedSearch.trim().length > 0,
  });
  const customers = customersResult?.data ?? [];

  const { data: leadsResult } = useQuery({
    queryKey: ["leads-search", debouncedSearch],
    queryFn: () => fetchJson<{ items: LeadOption[] }>(`/api/leads?search=${encodeURIComponent(debouncedSearch)}&pageSize=5`),
    enabled: open && debouncedSearch.trim().length > 0,
  });
  const leadOptions = leadsResult?.items ?? [];

  // Real data hooks
  const { data: venues = [] } = useVenues();
  const { data: eventTypes = [] } = useEventTypes("MICE");
  const { user } = useCurrentUser();
  const { data: salesMice = [] } = useSalesMice(open);

  const { mutateAsync: createMiceBooking, isPending: isCreating } = useCreateMiceBooking();
  const { mutateAsync: updateMiceBooking, isPending: isUpdating } = useUpdateMiceBooking();
  const isPending = isCreating || isUpdating;

  const venueOptions = useMemo<SearchableSelectOption[]>(
    () => venues.map((v) => ({ id: v.id, name: v.name })),
    [venues]
  );
  const eventTypeOptions = useMemo<SearchableSelectOption[]>(
    () => eventTypes.map((et) => ({ id: et.id, name: et.name })),
    [eventTypes]
  );
  const currentUserIsSalesMice = useMemo(() => {
    if (!user) return false;
    return salesMice.some((s) => s.id === user.profileId);
  }, [salesMice, user]);
  const salesOptions = useMemo<SearchableSelectOption[]>(
    () => salesMice.map((s) => ({ id: s.id, name: s.fullName ?? s.id })),
    [salesMice]
  );
  const currentSalesName = useMemo(() => {
    if (!currentUserIsSalesMice || !user) return null;
    return salesMice.find((s) => s.id === user.profileId)?.fullName ?? user.name ?? null;
  }, [currentUserIsSalesMice, salesMice, user]);

  // Watch venueId from form to trigger availability fetch
  const watchedVenueId = form.watch("venueId");

  // Fetch venue availability whenever venue or visible month changes
  useEffect(() => {
    if (!watchedVenueId) { setAvailability({}); return; }
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

  // Pre-compute terms from booking OUTSIDE the effect so the effect body
  // doesn't perform complex reactive-value derivation (which triggers the
  // react-hooks/set-state-in-effect lint rule).
  const bookingTerms = useMemo((): TermRow[] | null => {
    if (!booking) return null;
    const bookingFeeterm = booking.terms.find((t) => t.name === "Booking Fee" || t.name === "Booking Fee / DP");
    const finalPaymentTerm = booking.terms.find((t) => t.name === "Final Payment");
    const otherTerms = booking.terms.filter(
      (t) => t.name !== "Booking Fee" && t.name !== "Booking Fee / DP" && t.name !== "Final Payment"
    );
    return [
      {
        name: bookingFeeterm?.name ?? "Booking Fee / DP",
        amount: bookingFeeterm ? Number(bookingFeeterm.amount) : 0,
        dueDate: bookingFeeterm?.dueDate ? new Date(bookingFeeterm.dueDate).toISOString().split("T")[0] : "",
        sortOrder: 0,
        paymentStatus: (bookingFeeterm?.paymentStatus as TermRow["paymentStatus"]) ?? "unpaid",
      },
      ...otherTerms.map((t, i) => ({
        name: t.name,
        amount: Number(t.amount),
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
        sortOrder: i + 1,
        paymentStatus: (t.paymentStatus as TermRow["paymentStatus"]) ?? "unpaid",
      })),
      {
        name: finalPaymentTerm?.name ?? "Final Payment",
        amount: finalPaymentTerm ? Number(finalPaymentTerm.amount) : 0,
        dueDate: finalPaymentTerm?.dueDate ? new Date(finalPaymentTerm.dueDate).toISOString().split("T")[0] : "",
        sortOrder: booking.terms.length - 1,
        paymentStatus: (finalPaymentTerm?.paymentStatus as TermRow["paymentStatus"]) ?? "unpaid",
      },
    ];
  }, [booking]);

  // Reset on open/close. Calling setState inside an effect is intentional here —
  // this is the standard drawer/modal initialization pattern (hydrate form when
  // it opens). The rule fires because computed values are derived from the
  // `booking` prop; the pattern itself is correct and won't cause cascades.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      if (booking) {
        // ── Edit mode: hydrate form from the existing booking ──
        form.reset({
          clientName: booking.customer.name,
          clientPhone: booking.customer.phone,
          venueId: booking.venue.id,
          eventTypeId: "",
          eventDate: booking.eventDate ? new Date(booking.eventDate).toISOString().split("T")[0] : "",
          estimatedPax: "",
          salesId: booking.sales?.id ?? "",
          notes: "",
        });
        setTerms(bookingTerms ?? makeDefaultTerms());
        setSigningLocation("");
        setSelectedCustomerId(booking.customer.id);
      } else if (prefillLead) {
        // ── Create mode, pre-filled from a lead ──
        const autoSalesId = currentUserIsSalesMice && user?.profileId
          ? user.profileId
          : (prefillLead.assignedTo?.id ?? "");
        const phone = prefillLead.contactNumbers?.[0]?.number ?? "";
        form.reset({
          ...DEFAULT_VALUES,
          clientName: prefillLead.name,
          clientPhone: phone.replace(/\D/g, ""),
          venueId: prefillLead.venue?.id ?? "",
          eventTypeId: prefillLead.eventType?.id ?? "",
          eventDate: prefillLead.eventDate ? new Date(prefillLead.eventDate).toISOString().split("T")[0] : "",
          estimatedPax: prefillLead.estimatedPax != null ? String(prefillLead.estimatedPax) : "",
          salesId: autoSalesId,
          notes: prefillLead.notes ?? "",
        });
        setTerms(makeDefaultTerms());
        setSigningLocation("");
        setSelectedCustomerId("");
      } else {
        const autoSalesId = currentUserIsSalesMice && user?.profileId ? user.profileId : "";
        form.reset({ ...DEFAULT_VALUES, salesId: autoSalesId });
        setTerms(makeDefaultTerms());
        setSigningLocation("");
        setSelectedCustomerId("");
      }
      setCurrentStep(1);
      setClientSearch("");
      setSelectedLeadId(!booking && prefillLead ? prefillLead.leadId : "");
      setClientDropdownOpen(false);
      setAvailability({});
      setVisibleMonth(new Date());
      setEventDatePopoverOpen(false);
    } else {
      signatureRef.current = null;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (open && !booking && currentUserIsSalesMice && user?.profileId) {
      form.setValue("salesId", user.profileId);
    }
  }, [open, booking, currentUserIsSalesMice, user?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Navigation ───────────────────────────────────────────────────────────

  async function handleNext() {
    if (currentStep === 1) {
      const ok = await form.trigger([
        "clientName", "clientPhone", "venueId", "eventTypeId", "eventDate",
      ]);
      if (!ok) return;
    }
    setCurrentStep((s) => Math.min(s + 1, 3));
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  // ─── Term helpers ─────────────────────────────────────────────────────────

  function addTerm() {
    setTerms((prev) => [
      ...prev.slice(0, -1),
      { name: "Term Baru", amount: 0, dueDate: "", sortOrder: prev.length - 1, paymentStatus: "unpaid" },
      { ...prev[prev.length - 1], sortOrder: prev.length },
    ]);
  }

  function removeTerm(idx: number) {
    setTerms((prev) => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, sortOrder: i })));
  }

  function updateTerm<K extends keyof TermRow>(idx: number, key: K, val: TermRow[K]) {
    setTerms((prev) => prev.map((t, i) => i === idx ? { ...t, [key]: val } : t));
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function onSubmit(values: MiceFormValues): Promise<void> {
    const resolvedSalesId = currentUserIsSalesMice
      ? ((user?.profileId ?? values.salesId) || undefined)
      : values.salesId || undefined;

    const payload = {
      customerId: selectedLeadId ? null : (selectedCustomerId || null),
      leadId: selectedLeadId || null,
      clientName: values.clientName,
      clientPhone: values.clientPhone,
      venueId: values.venueId,
      eventTypeId: values.eventTypeId,
      eventDate: values.eventDate,
      // bookingDate is auto-set to today — never collected from user input
      bookingDate: new Date().toISOString().split("T")[0],
      estimatedPax: values.estimatedPax ? Number(values.estimatedPax) : null,
      salesId: resolvedSalesId ?? null,
      salesSignature: signatureRef.current ?? null,
      signingLocation: signingLocation.trim() || null,
      terms: terms.filter((t) => t.dueDate).map((t, i) => ({
        name: t.name,
        amount: t.amount,
        dueDate: t.dueDate,
        sortOrder: i,
        paymentStatus: t.paymentStatus,
      })),
      notes: values.notes || undefined,
      quotationId: null,
      sourceOfInformationId: null,
    };

    const parsed = createMiceBookingSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    if (isEdit && booking) {
      const result = await updateMiceBooking({ ...parsed.data, id: booking.id });
      if (!result.success) { toast.error(result.error ?? "Gagal menyimpan booking."); return; }
      toast.success("Booking MICE berhasil diperbarui.");
    } else {
      const result = await createMiceBooking(parsed.data);
      if (!result.success) { toast.error(result.error ?? "Gagal menyimpan booking."); return; }
      toast.success("Booking MICE berhasil disimpan.");
    }
    onSuccess?.();
    onOpenChange(false);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Booking MICE" : "Tambah Booking MICE"}
      maxWidth="sm:max-w-2xl"
      steps={currentStep}
      totalSteps={TOTAL_STEPS}
      isCloseButton={false}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form className="space-y-5 pb-2">

              {/* ─── Step 1: Info Event ─── */}
              {currentStep === 1 && (
                <>
                  {/* Informasi Client */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi Client</p>
                    {/* Nama Client — search lead atau customer terdaftar */}
                    <FormField control={form.control} name="clientName" rules={{ required: "Nama client wajib diisi" }} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Client / Perusahaan *</FormLabel>
                        {selectedLeadId && (
                          <p className="text-xs text-[var(--brand-gold)]">Dari Lead — konversi otomatis saat booking dibuat</p>
                        )}
                        <div ref={clientDropdownRef} className="relative">
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Cari lead / customer, atau ketik baru..."
                              autoComplete="off"
                              onChange={(e) => {
                                field.onChange(e);
                                setClientSearch(e.target.value);
                                setSelectedCustomerId("");
                                setSelectedLeadId("");
                                setClientDropdownOpen(true);
                              }}
                              onFocus={() => { if (field.value.trim()) setClientDropdownOpen(true); }}
                            />
                          </FormControl>
                          {clientDropdownOpen && clientSearch.trim() && (leadOptions.length > 0 || customers.length > 0) && (
                            <div className="absolute z-50 w-full mt-1 max-h-72 overflow-auto rounded-xl border bg-background shadow-md">
                              {leadOptions.length > 0 && (
                                <div>
                                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dari Leads</p>
                                  {leadOptions.map((lead) => (
                                    <div
                                      key={lead.id}
                                      className="cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors"
                                      onClick={() => {
                                        form.setValue("clientName", lead.name);
                                        const phone = lead.contactNumbers?.[0]?.number ?? "";
                                        if (phone) form.setValue("clientPhone", phone.replace(/\D/g, ""));
                                        if (!currentUserIsSalesMice && lead.assignedTo?.id) form.setValue("salesId", lead.assignedTo.id);
                                        setSelectedLeadId(lead.id);
                                        setSelectedCustomerId("");
                                        setClientDropdownOpen(false);
                                      }}
                                    >
                                      <p className="font-medium">{lead.name}</p>
                                      {lead.email && <p className="text-xs text-muted-foreground">{lead.email}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {customers.length > 0 && (
                                <div>
                                  {leadOptions.length > 0 && <div className="border-t my-1" />}
                                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Terdaftar</p>
                                  {customers.map((c) => (
                                    <div
                                      key={c.id}
                                      className="cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors"
                                      onClick={() => {
                                        form.setValue("clientName", c.name);
                                        const phone = firstPhone(c.mobileNumber);
                                        if (phone) form.setValue("clientPhone", phone.replace(/\D/g, ""));
                                        setSelectedCustomerId(c.id);
                                        setSelectedLeadId("");
                                        setClientDropdownOpen(false);
                                      }}
                                    >
                                      <p className="font-medium">{c.name}</p>
                                      {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="clientPhone" rules={{ required: "No. telepon wajib diisi" }} render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. Telepon *</FormLabel>
                        <FormControl><Input {...field} type="tel" inputMode="numeric" placeholder="0812345678" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Quotation */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quotation</p>
                    <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground cursor-not-allowed select-none">
                      Modul Quotation menyusul
                    </div>
                    <p className="text-xs text-muted-foreground">Integrasi quotation akan tersedia di versi berikutnya.</p>
                  </div>

                  {/* Detail Event */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detail Event</p>
                    <FormField control={form.control} name="venueId" rules={{ required: "Venue wajib dipilih" }} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venue *</FormLabel>
                        <FormControl>
                          <SearchableSelect options={venueOptions} value={field.value} onChange={field.onChange} placeholder="Pilih venue..." searchPlaceholder="Cari venue..." emptyText="Tidak ada venue" className="w-full" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="eventTypeId" rules={{ required: "Tipe event wajib dipilih" }} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipe &amp; Durasi Event *{isEdit && <span className="ml-1 text-xs font-normal text-muted-foreground">(edit: pilih ulang jika perlu)</span>}</FormLabel>
                        <FormControl>
                          <SearchableSelect options={eventTypeOptions} value={field.value} onChange={field.onChange} placeholder="Pilih tipe event..." searchPlaceholder="Cari tipe event..." emptyText="Tidak ada tipe event MICE" className="w-full" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="eventDate" rules={{ required: "Tanggal event wajib diisi" }} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal Event *</FormLabel>
                        <Popover open={eventDatePopoverOpen} onOpenChange={setEventDatePopoverOpen}>
                          <PopoverTrigger render={
                            <Button
                              variant="outline"
                              disabled={!watchedVenueId}
                              className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              <CalendarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                              {watchedVenueId
                                ? (field.value ? format(new Date(field.value), "dd MMM yyyy") : "Pilih tanggal event")
                                : "Pilih venue terlebih dahulu"}
                            </Button>
                          } />
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              captionLayout="dropdown"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => {
                                field.onChange(date ? date.toISOString().split("T")[0] : "");
                                setEventDatePopoverOpen(false);
                              }}
                              disabled={(d) => getDateStatus(d) === "unavailable"}
                              fromYear={new Date().getFullYear() - 2}
                              toYear={new Date().getFullYear() + 5}
                              defaultMonth={field.value ? new Date(field.value) : new Date()}
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
                        {availLoading && <p className="text-xs text-muted-foreground mt-1">Mengecek ketersediaan...</p>}
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="estimatedPax" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jumlah Pax (Estimasi)</FormLabel>
                        <FormControl><Input {...field} placeholder="100" type="number" min="1" inputMode="numeric" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Informasi Sales */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi Sales</p>
                    {currentUserIsSalesMice ? (
                      <div>
                        <p className="text-sm font-medium mb-1.5">Sales *</p>
                        <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">{currentSalesName ?? "—"}</div>
                        <p className="text-xs text-muted-foreground mt-1.5">Booking ini akan tercatat atas nama Anda.</p>
                      </div>
                    ) : (
                      <FormField control={form.control} name="salesId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sales</FormLabel>
                          <FormControl>
                            <SearchableSelect options={salesOptions} value={field.value} onChange={field.onChange} placeholder="Pilih sales (opsional)..." searchPlaceholder="Cari sales..." emptyText="Tidak ada sales MICE" className="w-full" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>

                  {/* Catatan */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catatan</p>
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catatan Tambahan</FormLabel>
                        <FormControl><Textarea {...field} rows={3} placeholder="Catatan tambahan (opsional)..." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </>
              )}

              {/* ─── Step 2: Term of Payments ─── */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi Pembayaran</p>

                  {terms.map((t, idx) => {
                    const isLast = idx === terms.length - 1;
                    return (
                      <div key={idx} className="space-y-2">
                        {/* Term name + status + delete */}
                        <div className={cn("flex", "items-center", "gap-2")}>
                          <div className="flex items-center gap-0.5 flex-1">
                            <Input
                              value={t.name}
                              onChange={(e) => updateTerm(idx, "name", e.target.value)}
                              placeholder="Nama term"
                              className="border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto"
                            />
                            {idx === 0 && <span className="text-destructive text-xs font-medium shrink-0">*</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Select
                              value={t.paymentStatus}
                              onValueChange={(v) => updateTerm(idx, "paymentStatus", v as TermRow["paymentStatus"])}
                            >
                              <SelectTrigger className="w-24 h-7">
                                <span className={cn("text-xs font-semibold", t.paymentStatus === "paid" ? "text-foreground" : "text-muted-foreground")}>
                                  {t.paymentStatus.charAt(0).toUpperCase() + t.paymentStatus.slice(1)}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_STATUS.map((s) => (
                                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {terms.length > 1 && !(idx === 0 || isLast) && (
                              <button type="button" onClick={() => removeTerm(idx)} className="text-destructive hover:text-destructive shrink-0">
                                <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Amount + Due Date */}
                        <div className={cn("flex", "flex-col", "sm:flex-row", "gap-3", "sm:items-center")}>
                          <div className="sm:flex-[2]">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">Rp</span>
                              <Input
                                className="pl-9"
                                value={fmtAmount(t.amount)}
                                onChange={(e) => updateTerm(idx, "amount", parseRpToNumber(e.target.value))}
                                placeholder="15.000.000"
                                inputMode="numeric"
                              />
                            </div>
                          </div>
                          <div className="sm:flex-1">
                            <Popover>
                              <PopoverTrigger render={
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !t.dueDate && "text-muted-foreground")}>
                                  <CalendarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                                  {t.dueDate ? format(new Date(t.dueDate), "dd MMM yyyy") : "Pilih tanggal"}
                                </Button>
                              } />
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  captionLayout="dropdown"
                                  selected={t.dueDate ? new Date(t.dueDate) : undefined}
                                  onSelect={(date) => updateTerm(idx, "dueDate", date ? date.toISOString().split("T")[0] : "")}
                                  fromDate={new Date(new Date().setHours(0, 0, 0, 0))}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* Separator between terms */}
                        {idx < terms.length - 1 && <div className="border-b border-dashed border-border" />}
                      </div>
                    );
                  })}

                  {/* Add Term button — inserts between first and last */}
                  <Button type="button" variant="outline" onClick={addTerm} className="w-full border-dashed gap-1.5 text-muted-foreground">
                    <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                    Tambah Term
                  </Button>
                </div>
              )}

              {/* ─── Step 3: Tanda Tangan & Lokasi ─── */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tanda Tangan &amp; Lokasi</p>

                  <SignaturePad
                    onSignature={(url) => { signatureRef.current = url; }}
                    label="Tanda Tangan Sales"
                  />

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Lokasi Penandatanganan</label>
                    <Input
                      value={signingLocation}
                      onChange={(e) => setSigningLocation(e.target.value)}
                      placeholder="e.g. Kantor Swasana, Jakarta"
                    />
                    <p className="text-xs text-muted-foreground">Lokasi ini akan ditampilkan di dokumen PO.</p>
                  </div>
                </div>
              )}

            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background pt-4">
          <div className="flex gap-2">
            {currentStep > 1 ? (
              <Button type="button" variant="outline" onClick={handleBack} className="flex-1" disabled={isPending}>
                Kembali
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isPending}>
                Batal
              </Button>
            )}

            {currentStep < 3 ? (
              <Button type="button" onClick={handleNext} className="flex-1">
                Lanjut
              </Button>
            ) : (
              <Button type="button" onClick={() => { void form.handleSubmit(onSubmit)(); }} className="flex-1" disabled={isPending}>
                {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
