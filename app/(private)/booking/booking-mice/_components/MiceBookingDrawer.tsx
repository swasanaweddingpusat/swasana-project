"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
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
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { SignaturePad } from "@/components/shared/signature-pad";
import {
  Calendar as CalendarIcon,
  TrashBinTrash,
  AddCircle,
  AltArrowDown,
  ArrowRight,
} from "@solar-icons/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useSalesMice,
  useUpdateMiceBooking,
} from "@/hooks/use-mice-bookings";
import {
  useCreateDraftMiceBooking,
  useUpdateMiceDraftStep2,
  useUpdateMiceDraftStep3,
  useFinalizeDraftMiceBooking,
} from "@/hooks/use-mice-booking-draft";
import { createMiceBookingSchema } from "@/lib/validations/booking-mice";
import { createMiceDraftStep1Schema } from "@/lib/validations/booking-mice-draft";
import type { MiceBookingItem } from "./types";
import type { BookingPrefillLead } from "@/types/daily-activity";
import { cn, toDateOnly, parseDateOnly } from "@/lib/utils";
import { safeRandomUUID } from "@/lib/uuid";
import { PhoneInput } from "@/components/shared/PhoneInput";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MiceBookingDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: MiceBookingItem | null;
  /** When provided (create mode), the drawer opens pre-filled from this lead. */
  prefillLead?: BookingPrefillLead | null;
  /**
   * When provided (Deal flow), the drawer resumes this existing draft instead of
   * creating a new one on Step 1 "Lanjut". Skips draft creation on continue.
   */
  initialDraftId?: string | null;
  /** Called after a successful create/update. */
  onSuccess?: () => void;
}

interface MiceFormValues {
  clientName: string;
  companyName: string;
  clientPhone: string;
  venueId: string;
  eventTypeId: string;
  eventDate: string;
  miceSession: "morning" | "evening" | "fullday" | "";
  time: string;
  estimatedPax: string;
  salesId: string;
  notes: string;
}

interface CustomerOption {
  id: string;
  name: string;
  mobileNumber: unknown;
  emailCpp: string | null;
  emailCpw: string | null;
}
interface QuotationOption {
  id: string;
  quotationNo: string | null;
  clientName: string;
  clientPhone: string;
  instansi: string | null;
  venue: { id: string; name: string } | null;
  eventType: { id: string; name: string } | null;
  eventDate: string | null;
  time: string | null;
  notes: string | null;
  sales: { id: string; fullName: string | null } | null;
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

// Fase 5: TOP = jadwal murni (nama/nominal/tanggal). Status pembayaran dilacak
// di Cashbook (Ledger), bukan lagi per termin.
interface TermRow {
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
}

const DEFAULT_VALUES: MiceFormValues = {
  clientName: "",
  companyName: "",
  clientPhone: "",
  venueId: "",
  eventTypeId: "",
  eventDate: "",
  miceSession: "",
  time: "",
  estimatedPax: "",
  salesId: "",
  notes: "",
};

const TOTAL_STEPS = 3;

// ─── TEMP: design-review mode ────────────────────────────────────────────────
// Melewati validasi required & pembuatan draft di tombol "Lanjut" supaya Step 2/3
// bisa dipreview tanpa isi form dulu. Set ke false untuk balikin alur normal.
const SKIP_STEP_VALIDATION_FOR_DESIGN = true;

// ─── localStorage helpers for MICE draft pointer ─────────────────────────────

const MICE_DRAFT_LS_KEY = "swasana_mice_draft_id";

function readMiceDraftFromStorage(): string | null {
  try { return localStorage.getItem(MICE_DRAFT_LS_KEY); } catch { return null; }
}
function saveMiceDraftToStorage(id: string) {
  try { localStorage.setItem(MICE_DRAFT_LS_KEY, id); } catch { /* noop */ }
}
function clearMiceDraftFromStorage() {
  try { localStorage.removeItem(MICE_DRAFT_LS_KEY); } catch { /* noop */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRpToNumber(formatted: string): number {
  return parseInt(formatted.replace(/\D/g, "") || "0", 10);
}

function fmtAmount(n: number): string {
  return n > 0 ? n.toLocaleString("id-ID") : "";
}

function makeDefaultTerms(): TermRow[] {
  return [
    { name: "Booking Fee / DP", amount: 0, dueDate: "", sortOrder: 0 },
    { name: "Final Payment", amount: 0, dueDate: "", sortOrder: 1 },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MiceBookingDrawer({
  open,
  onOpenChange,
  booking,
  prefillLead,
  initialDraftId,
  onSuccess,
}: MiceBookingDrawerProps) {
  const isEdit = !!booking;
  const form = useForm<MiceFormValues>({ defaultValues: DEFAULT_VALUES });
  const signatureRef = useRef<string | null>(null);

  // Draft state (create mode only)
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);

  // ── Optimistic save state ──
  const [hasPendingWriteError, setHasPendingWriteError] = useState(false);
  const [pendingWriteErrorMsg, setPendingWriteErrorMsg] = useState<string | null>(null);
  const retryWriteRef = useRef<(() => Promise<void>) | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [terms, setTerms] = useState<TermRow[]>(makeDefaultTerms);
  // Track COLLAPSED terms — default empty = semua kebuka
  const [collapsedTerms, setCollapsedTerms] = useState<Set<number>>(new Set());
  const [signingLocation, setSigningLocation] = useState("");

  function toggleTerm(idx: number) {
    setCollapsedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  }

  // Venue availability (mirrors Wedding drawer pattern)
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [availLoading, setAvailLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [eventDatePopoverOpen, setEventDatePopoverOpen] = useState(false);
  // UI-only for now — belum ada kolom `eventDateEnd` di DB/schema. Dipakai buat
  // preview date-range picker; wiring ke payload menyusul setelah migration.
  const [eventDateEnd, setEventDateEnd] = useState("");

  // Customer / Lead picker (mirror wedding drawer)
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  function clearClientSelection() {
    setSelectedLeadId("");
    setSelectedCustomerId("");
    setSelectedQuotationId("");
    form.setValue("clientName", "");
    form.setValue("clientPhone", "");
    form.setValue("companyName", "");
    setClientSearch("");
    setClientDropdownOpen(false);
  }

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

  const { data: quotationsResult } = useQuery({
    queryKey: ["quotations-search", debouncedSearch],
    queryFn: () => fetchJson<{ data: QuotationOption[] }>(`/api/quotations?search=${encodeURIComponent(debouncedSearch)}&category=MICE&pageSize=5`),
    enabled: open && debouncedSearch.trim().length > 0,
  });
  const quotationOptions = quotationsResult?.data ?? [];

  // Real data hooks
  const { data: venues = [] } = useVenues();
  const { data: eventTypes = [] } = useEventTypes("MICE");
  const { user } = useCurrentUser();
  const { data: salesMice = [] } = useSalesMice(open);

  const { mutateAsync: createMiceDraft, isPending: isCreatingDraft } = useCreateDraftMiceBooking();
  const { mutateAsync: updateMiceStep2, isPending: isUpdatingStep2 } = useUpdateMiceDraftStep2();
  const { mutateAsync: updateMiceStep3, isPending: isUpdatingStep3 } = useUpdateMiceDraftStep3();
  const { mutateAsync: finalizeMiceDraft, isPending: isFinalizing } = useFinalizeDraftMiceBooking();
  const { mutateAsync: updateMiceBooking, isPending: isUpdating } = useUpdateMiceBooking();
  const isPending = isCreatingDraft || isUpdatingStep2 || isUpdatingStep3 || isFinalizing || isUpdating;

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

  // Watch venueId and eventDate from form to drive availability + session filtering
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedVenueId = form.watch("venueId");
  const watchedEventDate = form.watch("eventDate");
  const watchedClientName = form.watch("clientName");

  // In edit mode, pass the current booking id as `exclude` so the booking being
  // edited does not block its own slot in the availability response.
  const excludeBookingId = isEdit && booking ? booking.id : null;

  // Fetch venue availability whenever venue, visible month, or excludeId changes
  useEffect(() => {
    if (!watchedVenueId) { setAvailability({}); return; }
    setAvailLoading(true);
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    const params = new URLSearchParams({ month });
    if (excludeBookingId) params.set("exclude", excludeBookingId);
    fetch(`/api/venues/${watchedVenueId}/availability?${params}`)
      .then((r) => r.json())
      .then((data: Record<string, DayAvail>) => setAvailability(data))
      .catch(() => setAvailability({}))
      .finally(() => setAvailLoading(false));
  }, [watchedVenueId, visibleMonth, excludeBookingId]);

  function getDateStatus(d: Date): "available" | "partial" | "unavailable" | null {
    const key = format(d, "yyyy-MM-dd");
    const a = availability[key];
    if (!a) return null;
    const count = [a.morning, a.evening, a.fullday].filter(Boolean).length;
    if (count === 0) return "unavailable";
    if (count === 3) return "available";
    return "partial";
  }

  /**
   * Returns only session keys that are still available for the given date.
   * Mirrors the wedding drawer's getAvailableSessions() pattern.
   * fullday is available only when BOTH morning and evening are free.
   */
  function getAvailableSessions(dateStr: string): Array<"morning" | "evening" | "fullday"> {
    const a = availability[dateStr];
    if (!a) return ["morning", "evening", "fullday"];
    const result: Array<"morning" | "evening" | "fullday"> = [];
    if (a.morning) result.push("morning");
    if (a.evening) result.push("evening");
    if (a.fullday && a.morning && a.evening) result.push("fullday");
    return result;
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
      },
      ...otherTerms.map((t, i) => ({
        name: t.name,
        amount: Number(t.amount),
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
        sortOrder: i + 1,
      })),
      {
        name: finalPaymentTerm?.name ?? "Final Payment",
        amount: finalPaymentTerm ? Number(finalPaymentTerm.amount) : 0,
        dueDate: finalPaymentTerm?.dueDate ? new Date(finalPaymentTerm.dueDate).toISOString().split("T")[0] : "",
        sortOrder: booking.terms.length - 1,
      },
    ];
  }, [booking]);

  // ── Background save helper with 1 automatic retry ────────────────────────
  async function backgroundSave(
    saveFn: () => Promise<{ success: boolean; error?: string }>,
    errorLabel: string,
  ): Promise<void> {
    const attempt = async () => {
      const result = await saveFn();
      if (!result.success) throw new Error(result.error ?? errorLabel);
    };

    try {
      await attempt();
      setHasPendingWriteError(false);
      setPendingWriteErrorMsg(null);
      retryWriteRef.current = null;
    } catch {
      try {
        await attempt();
        setHasPendingWriteError(false);
        setPendingWriteErrorMsg(null);
        retryWriteRef.current = null;
      } catch (err2) {
        const msg = err2 instanceof Error ? err2.message : errorLabel;
        setHasPendingWriteError(true);
        setPendingWriteErrorMsg(msg);
        retryWriteRef.current = async () => {
          try {
            await attempt();
            setHasPendingWriteError(false);
            setPendingWriteErrorMsg(null);
            retryWriteRef.current = null;
          } catch (err3) {
            const retryMsg = err3 instanceof Error ? err3.message : errorLabel;
            setPendingWriteErrorMsg(retryMsg);
          }
        };
        toast.error(`Gagal menyimpan: ${msg}. Perbaiki koneksi dan coba Lanjut lagi.`);
      }
    }
  }

  // Reset on open/close. Calling setState inside an effect is intentional here —
  // this is the standard drawer/modal initialization pattern (hydrate form when
  // it opens). The rule fires because computed values are derived from the
  // `booking` prop; the pattern itself is correct and won't cause cascades.
  useEffect(() => {
    if (open) {
      if (booking) {
        // ── Edit mode: hydrate form from the existing booking ──
        // Note: MiceBookingItem does NOT have `time` or `companyName` fields yet
        // (backend columns pending). Both default to "" until schema is extended.
        form.reset({
          clientName: booking.customer.name,
          companyName: "",
          clientPhone: booking.customer.phone,
          venueId: booking.venue.id,
          eventTypeId: "",
          // eventDate is stored as UTC midnight — use UTC getters to recover the date string.
          eventDate: booking.eventDate ? (() => { const d = new Date(booking.eventDate!); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; })() : "",
          time: "",
          estimatedPax: "",
          salesId: booking.sales?.id ?? "",
          notes: "",
        });
        setTerms(bookingTerms ?? makeDefaultTerms());
        setSigningLocation("");
        setSelectedCustomerId(booking.customer.id);
      } else if (prefillLead) {
        // ── Create mode, pre-filled from a lead ──
        // BookingPrefillLead HAS `time` field; no `companyName` field available.
        const autoSalesId = currentUserIsSalesMice && user?.profileId
          ? user.profileId
          : (prefillLead.assignedTo?.id ?? "");
        const phone = prefillLead.contactNumbers?.[0]?.number ?? "";
        // phone is already stored as "62xxx" in lead contactNumbers
        const clientPhonePrefill = phone.replace(/\D/g, "");
        form.reset({
          ...DEFAULT_VALUES,
          clientName: prefillLead.name,
          companyName: "",
          clientPhone: clientPhonePrefill,
          venueId: prefillLead.venue?.id ?? "",
          eventTypeId: prefillLead.eventType?.id ?? "",
          // Use toDateOnly with local getters: lead eventDate may not be UTC midnight.
          eventDate: prefillLead.eventDate ? toDateOnly(new Date(prefillLead.eventDate)) : "",
          time: prefillLead.time ?? "",
          estimatedPax: prefillLead.estimatedPax != null ? String(prefillLead.estimatedPax) : "",
          salesId: autoSalesId,
          notes: prefillLead.notes ?? "",
        });
        // Prefill booking fee into terms[0] when the lead has a received booking fee
        const defaultTerms = makeDefaultTerms();
        if (prefillLead.bookingFeeAmount != null && prefillLead.bookingFeeAmount > 0) {
          const bookingFeeDueDateStr = prefillLead.bookingFeeDate
            ? (() => {
                const d = new Date(prefillLead.bookingFeeDate);
                const y = d.getUTCFullYear();
                const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
                const dy = String(d.getUTCDate()).padStart(2, "0");
                return `${y}-${mo}-${dy}`;
              })()
            : defaultTerms[0]?.dueDate ?? "";
          if (defaultTerms[0]) {
            defaultTerms[0] = {
              ...defaultTerms[0],
              amount: prefillLead.bookingFeeAmount,
              dueDate: bookingFeeDueDateStr,
            };
          }
        }
        setTerms(defaultTerms);
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
      // Restore draft pointer: prefer injected initialDraftId (Deal flow), then
      // localStorage (page-refresh recovery), then null (fresh start).
      const restoredDraftId = initialDraftId ?? (!booking && !prefillLead ? readMiceDraftFromStorage() : null);
      setDraftId(restoredDraftId);
      if (initialDraftId) saveMiceDraftToStorage(initialDraftId);
      setClientSearch("");
      setSelectedLeadId(!booking && prefillLead ? prefillLead.leadId : "");
      setSelectedQuotationId("");
      setClientDropdownOpen(false);
      setAvailability({});
      setVisibleMonth(new Date());
      setEventDatePopoverOpen(false);
      setEventDateEnd("");
      setHasPendingWriteError(false);
      setPendingWriteErrorMsg(null);
      retryWriteRef.current = null;
    } else {
      signatureRef.current = null;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !booking && currentUserIsSalesMice && user?.profileId) {
      form.setValue("salesId", user.profileId);
    }
  }, [open, booking, currentUserIsSalesMice, user?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Navigation ───────────────────────────────────────────────────────────

  async function handleNext() {
    // If a prior background save failed, clicking Lanjut fires the retry
    if (hasPendingWriteError && retryWriteRef.current) {
      await retryWriteRef.current();
      return;
    }

    if (SKIP_STEP_VALIDATION_FOR_DESIGN) {
      setCurrentStep((s) => Math.min(s + 1, 3));
      return;
    }

    if (currentStep === 1) {
      const ok = await form.trigger([
        "clientName", "clientPhone", "venueId", "eventTypeId", "eventDate",
      ]);
      if (!ok) return;

      // Create draft on Step 1 continue (await — draftId doesn't exist yet)
      if (!isEdit) {
        // Generate client-side draftId for idempotency; reuse if already set
        const pendingDraftId = draftId ?? safeRandomUUID();
        const values = form.getValues();
        const resolvedSalesId = currentUserIsSalesMice
          ? (user?.profileId ?? values.salesId)
          : values.salesId;

        const draftData = {
          id: pendingDraftId,
          venueId: values.venueId,
          eventTypeId: values.eventTypeId,
          salesId: resolvedSalesId || null,
          miceSession: (values.miceSession || null) as "morning" | "evening" | "fullday" | null,
          eventTime: values.time || null,
          estimatedPax: values.estimatedPax ? Number(values.estimatedPax) : null,
          notes: values.notes || null,
          customerId: selectedLeadId ? null : (selectedCustomerId || null),
          leadId: selectedLeadId || null,
          clientName: values.clientName,
          clientPhone: values.clientPhone,
          companyName: values.companyName || null,
        };

        const parsed = createMiceDraftStep1Schema.safeParse(draftData);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }

        const result = await createMiceDraft(draftData);
        if (!result.success || !result.draftId) {
          toast.error(result.error ?? "Gagal membuat draft booking MICE.");
          return;
        }
        const confirmedDraftId = result.draftId;
        setDraftId(confirmedDraftId);
        saveMiceDraftToStorage(confirmedDraftId);
      }
    }

    if (currentStep === 2 && !isEdit && draftId) {
      // Advance immediately (optimistic), save terms in background
      setCurrentStep(3);

      const capturedDraftId = draftId;
      void backgroundSave(
        () => updateMiceStep2({
          draftId: capturedDraftId,
          data: {
            termOfPayments: terms.filter((t) => t.dueDate).map((t, i) => ({
              name: t.name,
              amount: t.amount,
              dueDate: t.dueDate,
              sortOrder: i,
            })),
          },
        }),
        "Gagal menyimpan term of payment",
      );
      return;
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
      { name: "Term Baru", amount: 0, dueDate: "", sortOrder: prev.length - 1 },
      { ...prev[prev.length - 1], sortOrder: prev.length },
    ]);
    // term baru otomatis kebuka (default open)
  }

  function removeTerm(idx: number) {
    setTerms((prev) => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, sortOrder: i })));
    setCollapsedTerms((prev) => {
      const next = new Set<number>();
      prev.forEach((n) => { if (n < idx) { next.add(n); } else if (n > idx) { next.add(n - 1); } });
      return next;
    });
  }

  function updateTerm<K extends keyof TermRow>(idx: number, key: K, val: TermRow[K]) {
    setTerms((prev) => prev.map((t, i) => i === idx ? { ...t, [key]: val } : t));
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function onSubmit(values: MiceFormValues): Promise<void> {
    if (isEdit && booking) {
      // ── Edit mode: direct update (existing behavior) ──
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
        estimatedPax: values.estimatedPax ? Number(values.estimatedPax) : null,
        salesId: resolvedSalesId ?? null,
        salesSignature: signatureRef.current ?? null,
        signingLocation: signingLocation.trim() || null,
        terms: terms.filter((t) => t.dueDate).map((t, i) => ({
          name: t.name,
          amount: t.amount,
          dueDate: t.dueDate,
          sortOrder: i,
        })),
        notes: values.notes || undefined,
        quotationId: null,
        sourceOfInformationId: null,
      };

      const parsed = createMiceBookingSchema.safeParse(payload);
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

      const result = await updateMiceBooking({ ...parsed.data, id: booking.id });
      if (!result.success) { toast.error(result.error ?? "Gagal menyimpan booking."); return; }
      toast.success("Booking MICE berhasil diperbarui.");
      onSuccess?.();
      onOpenChange(false);
      return;
    }

    // ── Create mode: finalize draft ──
    if (!draftId) {
      toast.error("Draft tidak ditemukan. Coba mulai dari awal.");
      return;
    }

    // Step 3: save signature/location then finalize
    const step3Result = await updateMiceStep3({
      draftId,
      data: {
        signingLocation: signingLocation.trim() || null,
        signatureSales: signatureRef.current ?? null,
      },
    });
    if (!step3Result.success) {
      toast.error(step3Result.error ?? "Gagal menyimpan tanda tangan.");
      return;
    }

    const finalizeResult = await finalizeMiceDraft({
      draftId,
      signingLocation: signingLocation.trim() || null,
      signatureSales: signatureRef.current ?? null,
      leadId: selectedLeadId || null,
    });

    if (!finalizeResult.success) {
      toast.error(finalizeResult.error ?? "Gagal menyimpan booking MICE.");
      return;
    }

    clearMiceDraftFromStorage();
    toast.success("Booking MICE berhasil disimpan.");
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
        <div className="flex-1 overflow-y-auto px-2">
          <Form {...form}>
            <form className="space-y-3 pb-2">

              {/* ─── Step 1: Info Event ─── */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  {/* Informasi Client */}
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Informasi Client</p>
                    {/* Client — search dari Quotation / Customer terdaftar, fallback ketik manual buat client baru */}
                    <FormField control={form.control} name="clientName" rules={{ required: "Nama Client wajib diisi" }} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client / Instansi / Perusahaan *</FormLabel>
                        <div ref={clientDropdownRef} className="relative">
                          <FormControl>
                            <Input
                              {...field}
                              disabled={!!(selectedLeadId || selectedCustomerId || selectedQuotationId)}
                              placeholder="Cari client / instansi terdaftar, atau ketik nama baru..."
                              autoComplete="off"
                              onChange={(e) => {
                                field.onChange(e);
                                setClientSearch(e.target.value);
                                setSelectedCustomerId("");
                                setSelectedLeadId("");
                                setSelectedQuotationId("");
                                setClientDropdownOpen(true);
                              }}
                              onFocus={() => { if (field.value.trim()) setClientDropdownOpen(true); }}
                            />
                          </FormControl>
                          {clientDropdownOpen && clientSearch.trim() && (quotationOptions.length > 0 || customers.length > 0) && (
                            <div className="absolute z-50 w-full mt-1 max-h-72 overflow-auto rounded-xl border bg-background shadow-md">
                              {quotationOptions.length > 0 && (
                                <div>
                                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dari Quotation</p>
                                  {quotationOptions.map((q) => (
                                    <div
                                      key={q.id}
                                      className="cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors"
                                      onClick={() => {
                                        form.setValue("clientName", q.clientName);
                                        form.setValue("companyName", q.instansi ?? "");
                                        if (q.clientPhone) form.setValue("clientPhone", q.clientPhone.replace(/\D/g, ""));
                                        if (!currentUserIsSalesMice && q.sales?.id) form.setValue("salesId", q.sales.id);
                                        // Auto-display field-field setelahnya dari data quotation
                                        form.setValue("venueId", q.venue?.id ?? "");
                                        form.setValue("eventTypeId", q.eventType?.id ?? "");
                                        form.setValue("eventDate", q.eventDate ? toDateOnly(new Date(q.eventDate)) : "");
                                        form.setValue("time", q.time ?? "");
                                        form.setValue("notes", q.notes ?? "");
                                        setSelectedQuotationId(q.id);
                                        setSelectedLeadId("");
                                        setSelectedCustomerId("");
                                        setClientSearch("");
                                        setClientDropdownOpen(false);
                                      }}
                                    >
                                      <p className="font-medium">{q.clientName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {q.quotationNo ?? "Belum ada nomor"}{q.instansi ? ` · ${q.instansi}` : ""}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {customers.length > 0 && (
                                <div>
                                  {quotationOptions.length > 0 && <div className="border-t my-1" />}
                                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Terdaftar</p>
                                  {customers.map((c) => (
                                    <div
                                      key={c.id}
                                      className="cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors"
                                      onClick={() => {
                                        form.setValue("clientName", c.name);
                                        // CustomerOption does not carry a company field — left empty
                                        form.setValue("companyName", "");
                                        const phone = firstPhone(c.mobileNumber);
                                        if (phone) form.setValue("clientPhone", phone.replace(/\D/g, ""));
                                        setSelectedCustomerId(c.id);
                                        setSelectedLeadId("");
                                        setSelectedQuotationId("");
                                        setClientSearch("");
                                        setClientDropdownOpen(false);
                                      }}
                                    >
                                      <p className="font-medium">{c.name}</p>
                                      {(c.emailCpp ?? c.emailCpw) && <p className="text-xs text-muted-foreground">{c.emailCpp ?? c.emailCpw}</p>}
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

                    {(selectedLeadId || selectedCustomerId || selectedQuotationId) ? (
                      /* Client terpilih dari quotation/lead/customer — tampilkan ringkasan, sembunyikan field manual */
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                        <div className="min-w-0">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {selectedQuotationId ? "Dari Quotation" : selectedLeadId ? "Dari Daily Activity" : "Customer Terdaftar"}
                          </span>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {form.watch("clientPhone") ? `+${form.watch("clientPhone")}` : "No. telepon tidak tersedia"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={clearClientSelection}
                          className="shrink-0 cursor-pointer text-xs font-medium text-primary hover:underline"
                        >
                          Ganti
                        </button>
                      </div>
                    ) : (
                      watchedClientName.trim().length > 0 && (
                        /* Tidak ada match — client baru, minta lengkapi kontak */
                        <div className="space-y-3 rounded-xl border border-dashed border-border/70 p-3">
                          <p className="text-xs text-muted-foreground">Client baru — lengkapi data kontak:</p>
                          <FormField control={form.control} name="companyName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nama Perusahaan / Instansi</FormLabel>
                              <FormControl><Input {...field} placeholder="PT. Contoh Jaya (opsional)" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="clientPhone" rules={{ required: "No. telepon wajib diisi" }} render={({ field }) => (
                            <FormItem>
                              <FormLabel>No. Telepon *</FormLabel>
                              <FormControl>
                                <PhoneInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      )
                    )}
                  </div>

                  {/* Detail Event */}
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Detail Event</p>
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
                  </div>

                  {/* Jadwal Event */}
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Jadwal Event</p>
                    <FormField control={form.control} name="eventDate" rules={{ required: "Tanggal event wajib diisi" }} render={({ field }) => {
                      const rangeLabel = (() => {
                        if (!field.value) return "Pilih tanggal event";
                        const from = parseDateOnly(field.value);
                        if (!eventDateEnd || eventDateEnd === field.value) return format(from, "dd MMM yyyy");
                        const to = parseDateOnly(eventDateEnd);
                        const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
                        return sameMonth
                          ? `${format(from, "dd")} - ${format(to, "dd MMM yyyy")}`
                          : `${format(from, "dd MMM yyyy")} - ${format(to, "dd MMM yyyy")}`;
                      })();
                      return (
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
                                {watchedVenueId ? rangeLabel : "Pilih venue terlebih dahulu"}
                              </Button>
                            } />
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="range"
                                captionLayout="dropdown"
                                selected={{
                                  from: field.value ? parseDateOnly(field.value) : undefined,
                                  to: eventDateEnd ? parseDateOnly(eventDateEnd) : undefined,
                                }}
                                onSelect={(range) => {
                                  field.onChange(range?.from ? toDateOnly(range.from) : "");
                                  setEventDateEnd(range?.to ? toDateOnly(range.to) : "");
                                }}
                                disabled={(d) => getDateStatus(d) === "unavailable"}
                                fromYear={new Date().getFullYear() - 2}
                                toYear={new Date().getFullYear() + 5}
                                defaultMonth={field.value ? parseDateOnly(field.value) : new Date()}
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
                              <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2.5">
                                <p className="text-xs text-muted-foreground">
                                  {field.value ? rangeLabel : "Klik 1 tanggal untuk single day, atau klik 2 tanggal untuk rentang"}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer"
                                  disabled={!field.value}
                                  onClick={() => setEventDatePopoverOpen(false)}
                                >
                                  Selesai
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                          {availLoading && <p className="text-xs text-muted-foreground mt-1">Mengecek ketersediaan...</p>}
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                    <FormField control={form.control} name="miceSession" render={({ field }) => {
                      const SESSION_LABELS: Record<string, string> = {
                        morning: "Pagi (Morning)",
                        evening: "Malam (Evening)",
                        fullday: "Fullday",
                      };
                      const ALL_SESSIONS = ["morning", "evening", "fullday"] as const;
                      const availableSessions = watchedEventDate
                        ? getAvailableSessions(watchedEventDate)
                        : ALL_SESSIONS;
                      const sessionOptions = availableSessions.map((s) => ({
                        id: s,
                        name: SESSION_LABELS[s],
                      }));
                      // Warn if the currently selected session became unavailable
                      // (e.g., user picked date first, then session slot got taken)
                      const selectedSessionUnavailable =
                        !!watchedEventDate &&
                        !!field.value &&
                        !availableSessions.includes(field.value as "morning" | "evening" | "fullday");
                      return (
                        <FormItem>
                          <FormLabel>Sesi Event</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={sessionOptions}
                              value={field.value}
                              onChange={(v) => field.onChange(v as "morning" | "evening" | "fullday" | "")}
                              placeholder={!watchedEventDate ? "Pilih tanggal dulu" : "Pilih sesi event..."}
                              searchPlaceholder="Cari sesi..."
                              emptyText="Semua sesi penuh untuk tanggal ini"
                              disabled={!watchedEventDate}
                            />
                          </FormControl>
                          {selectedSessionUnavailable && (
                            <p className="text-xs text-destructive mt-1">
                              Sesi ini sudah penuh untuk tanggal yang dipilih. Silakan pilih sesi lain.
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Sesi menentukan slot venue — pagi dan malam bisa diisi event berbeda, fullday mengunci seluruh hari.
                          </p>
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                    <FormField control={form.control} name="time" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Waktu Acara</FormLabel>
                        <FormControl>
                          <TimeRangePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Pilih rentang waktu acara..."
                          />
                        </FormControl>
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
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Informasi Sales</p>
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
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Catatan</p>
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catatan Tambahan</FormLabel>
                        <FormControl><Textarea {...field} rows={3} placeholder="Catatan tambahan (opsional)..." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              )}

              {/* ─── Step 2: Term of Payments ─── */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground mb-1">Informasi Pembayaran</p>

                  <div className="space-y-2">
                    {terms.map((t, idx) => {
                      const isLast = idx === terms.length - 1;
                      const isOpen = !collapsedTerms.has(idx);
                      // Middle terms (not first, not last) are removable
                      const canRemove = terms.length > 1 && !(idx === 0 || isLast);
                      return (
                        <Collapsible
                          key={idx}
                          open={isOpen}
                          onOpenChange={() => toggleTerm(idx)}
                          className="rounded-xl border border-border bg-muted/30 overflow-hidden"
                        >
                          {/* ── Collapsible header — trigger area + hapus sebagai sibling ── */}
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
                                <p className={cn(
                                  "text-sm font-medium truncate",
                                  t.name ? "text-foreground" : "text-muted-foreground italic",
                                )}>
                                  {t.name || "Term tanpa nama"}
                                  {idx === 0 && <span className="text-destructive ml-1">*</span>}
                                </p>
                                {!isOpen && (
                                  <p className="text-xs text-muted-foreground tabular-nums">
                                    {t.amount ? `Rp${fmtAmount(t.amount)}` : "Rp0"}
                                    {t.dueDate ? ` · ${format(new Date(t.dueDate), "dd MMM yyyy")}` : ""}
                                  </p>
                                )}
                              </div>
                            </CollapsibleTrigger>
                            {/* Tombol hapus — SIBLING dari trigger, bukan child-nya */}
                            {canRemove && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTerm(idx);
                                }}
                                aria-label="Hapus term"
                                className="shrink-0 p-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {/* ── Collapsible body ── */}
                          <CollapsibleContent>
                            <div className="px-3 pb-3 space-y-3 border-t border-border/60">
                              {/* Term name editable */}
                              <div className="pt-2 flex items-center gap-1">
                                <Input
                                  value={t.name}
                                  onChange={(e) => updateTerm(idx, "name", e.target.value)}
                                  placeholder="Nama term (mis. Booking Fee / DP)"
                                  className="border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto"
                                />
                                {idx === 0 && <span className="text-destructive text-xs font-medium shrink-0">*</span>}
                              </div>

                              {/* Amount + Due Date */}
                              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
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
                                        onSelect={(date) => updateTerm(idx, "dueDate", date ? toDateOnly(date) : "")}
                                        fromDate={new Date(new Date().setHours(0, 0, 0, 0))}
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

                  {/* Add Term button — inserts between first and last */}
                  <Button type="button" variant="outline" onClick={addTerm} className="w-full border-dashed gap-1.5 text-muted-foreground">
                    <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                    Tambah Term
                  </Button>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Tanda Tangan & Lokasi ─── */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-semibold text-foreground mb-1">Tanda Tangan &amp; Lokasi</p>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Lokasi Penandatanganan</label>
                    <Input
                      value={signingLocation}
                      onChange={(e) => setSigningLocation(e.target.value)}
                      placeholder="e.g. Kantor Swasana, Jakarta"
                    />
                    <p className="text-xs text-muted-foreground">Lokasi ini akan ditampilkan di dokumen PO.</p>
                  </div>

                  {/* Sales signature — only when the logged-in user IS the assigned
                      sales. Manager/admin-assigned bookings are signed later by the
                      assigned sales via the approval page. */}
                  <div className="border-t border-border/60 pt-4">
                  {currentUserIsSalesMice ? (
                    <SignaturePad
                      onSignature={(url) => { signatureRef.current = url; }}
                      label="Tanda Tangan Sales"
                    />
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Tanda tangan sales akan diisi oleh sales yang ditugaskan melalui halaman approval setelah booking dibuat.
                      </p>
                    </div>
                  )}
                  </div>
                  </div>
                </div>
              )}

            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background pt-4">
          {/* Background-save error banner */}
          {hasPendingWriteError && pendingWriteErrorMsg && (
            <div className="mb-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              <span className="font-semibold">Simpan gagal:</span> {pendingWriteErrorMsg}
              {" "}Perbaiki koneksi lalu klik <span className="font-semibold">Coba Lagi</span>.
            </div>
          )}
          <div className="flex gap-2">
            {currentStep > 1 ? (
              <Button type="button" variant="outline" onClick={handleBack} className="flex-[40%] cursor-pointer" disabled={isPending}>
                Kembali
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-[40%] cursor-pointer text-destructive border-destructive hover:bg-destructive/10" disabled={isPending}>
                Batal
              </Button>
            )}

            {currentStep < 3 ? (
              <Button type="button" onClick={handleNext} className="flex-[60%] cursor-pointer" disabled={isPending && !hasPendingWriteError}>
                {hasPendingWriteError ? "Coba Lagi" : "Lanjut"}
                {!hasPendingWriteError && <ArrowRight weight="BoldDuotone" className="h-4 w-4 ml-1" />}
              </Button>
            ) : (
              <Button type="button" onClick={() => { void form.handleSubmit(onSubmit)(); }} className="flex-[60%] cursor-pointer" disabled={isPending}>
                {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
