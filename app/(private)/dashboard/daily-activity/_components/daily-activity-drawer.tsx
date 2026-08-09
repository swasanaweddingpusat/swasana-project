"use client";

/**
 * Edit Lead Drawer — layout identik dengan CreateLeadDrawer.
 * Selalu dalam mode edit (editLead WAJIB ada).
 * Shared sub-components: SectionHeader, SessionPillRadio, AvailabilityDatePickerField, CurrencyInput.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { cn } from "@/lib/utils";
import {
  CalendarDate,
  Buildings2,
  MapPoint,
  User,
  Phone,
  TagPrice,
  Notes,
  UsersGroupRounded,
  CloseCircle,
  AddCircle,
  Star,
  Suitcase,
  Heart,
  LockKeyhole,
  ShieldWarning,
  Gallery,
  Banknote,
  FileText,
  Refresh,
  LinkMinimalistic,
  Camera,
  CalendarMark,
  Streets,
  Case,
} from "@solar-icons/react";
import { getWeddingTimeRange } from "@/lib/constants/wedding-session-times";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import { useDailyActivitySegments, useCreateDailyActivitySegment } from "@/hooks/use-daily-activity-segments";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useUpdateDailyActivity } from "@/hooks/use-daily-activities";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  SectionHeader,
  SessionPillRadio,
  AvailabilityDatePickerField,
  CurrencyInput,
  fmtCurrency,
  mapCodeToWeddingEventType,
} from "./daily-activity-form-fields";
import type { DailyActivityListItem, ContactNumber } from "@/types/daily-activity";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingCategory = "WEDDINGS" | "MICE";
type WeddingSession = "morning" | "evening" | "fullday";

interface EditLeadFormState {
  name: string;
  email: string;
  emailCpp: string;
  emailCpw: string;
  nikCpp: string;
  nikCpw: string;
  addressCpp: string;
  addressCpw: string;
  eventDate: string;
  eventDateAlt: string;
  venueId: string;
  venueSecondaryId: string;
  eventTypeId: string;
  time: string;
  estimatedPax: string;
  budgetRange: string;
  sourceOfInformationId: string;
  assignedToId: string;
  statusId: string;
  notes: string;
  bitrixId: string;
  weddingSession: WeddingSession | "";
  weddingSessionAlt: WeddingSession | "";
  miceSession: WeddingSession | "";
  miceSessionAlt: WeddingSession | "";
  segmentId: string;
  picName: string;
  picPhone: string;
  isDateLocked: boolean;
  bookingFeeAmount: number;
  bookingFeeDate: string;
  address: string;
  instagramUrl: string;
  siteVisitDate: string;
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadBookingFeeEvidence(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/booking-fee-evidence", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal upload bukti bayar");
  }
  const { key } = (await res.json()) as { key: string };
  return key;
}

/**
 * Extract the storage key from an already-resolved full URL.
 * The query layer resolves stored keys to full URLs before serving the UI.
 * When re-saving without a file change, we must strip the base URL back to
 * a key so the DB stays consistent (key-only pattern, not full URL).
 */
function extractStorageKey(fullUrl: string): string {
  const base = (process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (base && fullUrl.startsWith(base + "/")) return fullUrl.slice(base.length + 1);
  // Fallback: return as-is (e.g. key was already relative, no base configured)
  return fullUrl;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DailyActivityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLead: DailyActivityListItem | null;
  onSuccess?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateToString(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DailyActivityDrawer({ open, onOpenChange, editLead, onSuccess }: DailyActivityDrawerProps) {
  // ── Category (fixed once set from lead) ──────────────────────────────────────
  const [category, setCategory] = useState<BookingCategory | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<EditLeadFormState>({
    name: "",
    email: "",
    emailCpp: "",
    emailCpw: "",
    nikCpp: "",
    nikCpw: "",
    addressCpp: "",
    addressCpw: "",
    eventDate: "",
    eventDateAlt: "",
    venueId: "",
    venueSecondaryId: "",
    eventTypeId: "",
    time: "",
    estimatedPax: "",
    budgetRange: "",
    sourceOfInformationId: "",
    assignedToId: "",
    statusId: "",
    notes: "",
    bitrixId: "",
    weddingSession: "",
    weddingSessionAlt: "",
    miceSession: "",
    miceSessionAlt: "",
    segmentId: "",
    picName: "",
    picPhone: "",
    isDateLocked: false,
    bookingFeeAmount: 0,
    bookingFeeDate: "",
    address: "",
    instagramUrl: "",
    siteVisitDate: "",
  });

  // ── MICE segment options (normalized master, FK-backed) ──────────────────────
  const { data: masterSegments = [] } = useDailyActivitySegments();
  const createSegment = useCreateDailyActivitySegment();
  const miceSegments = masterSegments
    .filter((s) => s.isActive)
    .map((s) => ({ id: s.id, name: s.name }));

  // ── UI toggles ─────────────────────────────────────────────────────────────
  const [showDateAlt, setShowDateAlt] = useState(false);
  const [showVenueSecondary, setShowVenueSecondary] = useState(false);

  // ── Booking fee evidence ───────────────────────────────────────────────────
  // existingEvidenceUrl = URL dari lead existing (tampilkan link, upload baru opsional)
  const [existingEvidenceUrl, setExistingEvidenceUrl] = useState<string | null>(null);
  const [bookingFeeEvidence, setBookingFeeEvidence] = useState<File | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  // ── Booking fee date popover ───────────────────────────────────────────────
  const [bookingFeeDateOpen, setBookingFeeDateOpen] = useState(false);
  const [siteVisitDateOpen, setSiteVisitDateOpen] = useState(false);

  // ── Submit state ───────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { data: venues = [] } = useVenues();
  const { data: eventTypesData } = useEventTypes(category ?? undefined);
  const { data: leadStatuses = [] } = useLeadStatuses();
  const { users: salesUsers } = useSalesUsers();
  const { user: currentUser } = useCurrentUser();
  const updateLead = useUpdateDailyActivity();

  const isMiceOnly = currentUser?.roleName === "sales-mice";

  // ── Sources of information ─────────────────────────────────────────────────
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/source-of-informations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setSources(data);
      })
      .catch(() => {});
  }, []);

  // Inline-add a new source of information from the drawer (sales users included).
  async function handleAddSource(name: string) {
    const res = await fetch("/api/source-of-informations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? "Gagal menambah sumber informasi");
    }
    const created = (await res.json()) as { id: string; name: string };
    setSources((prev) => (prev.some((s) => s.id === created.id) ? prev : [created, ...prev]));
    setField("sourceOfInformationId", created.id);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const isWedding = category === "WEDDINGS";
  const isMice = category === "MICE";

  const venueOptions = venues.map((v) => ({ id: v.id, name: v.name }));
  const venueSecondaryOptions = venueOptions.filter((v) => v.id !== form.venueId);

  const eventTypeOptions = (eventTypesData ?? []).map((et) => ({
    id: et.id,
    name: et.name,
    code: et.code,
  }));
  const statusOptions = leadStatuses.map((s) => ({ id: s.id, name: s.name }));
  const salesOptions = salesUsers.map((u) => ({
    id: u.id,
    name: u.fullName ?? u.id,
  }));

  const isBitrixSource =
    sources.find((s) => s.id === form.sourceOfInformationId)
      ?.name.toLowerCase()
      .includes("bitrix") ?? false;

  // ── Prefill saat drawer dibuka ─────────────────────────────────────────────
  useEffect(() => {
    if (!open || !editLead) return;

    const cat = (editLead.category ?? "WEDDINGS") as BookingCategory;
    setCategory(cat);

    const isWed = cat === "WEDDINGS";
    const rawSession = (editLead.weddingSession ?? "") as WeddingSession | "";
    const rawSessionAlt = (editLead.weddingSessionAlt ?? "") as WeddingSession | "";

    setForm({
      name: editLead.name ?? "",
      email: editLead.email ?? "",
      emailCpp: editLead.emailCpp ?? "",
      emailCpw: editLead.emailCpw ?? "",
      nikCpp: editLead.nikCpp ?? "",
      nikCpw: editLead.nikCpw ?? "",
      addressCpp: editLead.addressCpp ?? "",
      addressCpw: editLead.addressCpw ?? "",
      eventDate: dateToString(editLead.eventDate),
      eventDateAlt: dateToString(editLead.eventDateAlt),
      venueId: editLead.venue?.id ?? "",
      venueSecondaryId: editLead.venueSecondary?.id ?? "",
      eventTypeId: editLead.eventType?.id ?? "",
      time: editLead.time ?? "",
      estimatedPax: editLead.estimatedPax ? String(editLead.estimatedPax) : "",
      budgetRange: editLead.budgetRange ?? "",
      sourceOfInformationId: editLead.sourceOfInformation?.id ?? "",
      assignedToId: editLead.assignedTo?.id ?? "",
      statusId: editLead.status.id,
      notes: editLead.notes ?? "",
      bitrixId: editLead.bitrixId ?? "",
      // Wedding pakai weddingSession/weddingSessionAlt, MICE pakai miceSession/miceSessionAlt
      weddingSession: isWed ? rawSession : "",
      weddingSessionAlt: isWed ? rawSessionAlt : "",
      miceSession: !isWed ? rawSession : "",
      miceSessionAlt: !isWed ? rawSessionAlt : "",
      segmentId: editLead.segmentId ?? "",
      picName: editLead.contactNumbers?.[0]?.label ?? "",
      picPhone: editLead.contactNumbers?.[0]?.number ?? "",
      isDateLocked: editLead.isDateLocked ?? false,
      bookingFeeAmount: editLead.bookingFeeAmount
        ? Number(editLead.bookingFeeAmount)
        : 0,
      bookingFeeDate: dateToString(editLead.bookingFeeDate),
      address: editLead.address ?? "",
      // NOTE(UI-first): instagramUrl / siteVisitDate belum dikirim — field DB-nya belum ada.
      instagramUrl: "",
      siteVisitDate: "",
    });

    setExistingEvidenceUrl(editLead.bookingFeeEvidenceUrl ?? null);
    setBookingFeeEvidence(null);

    // Tampilkan tombol alt date/secondary venue kalau data ada
    setShowDateAlt(!!editLead.eventDateAlt);
    setShowVenueSecondary(!!editLead.venueSecondary?.id);
    setSubmitError(null);
    setBookingFeeDateOpen(false);
  }, [open, editLead]);

  // ── Auto-fill time dari session + event type (wedding only) ────────────────
  const selectedEventType = eventTypeOptions.find((et) => et.id === form.eventTypeId);
  const weddingEventTypeMapped = selectedEventType
    ? mapCodeToWeddingEventType(selectedEventType.code)
    : "";

  // Ref buat skip autofill pas initial prefill (biar session existing ga keoverride)
  const didPrefillRef = useRef(false);
  useEffect(() => {
    if (!open) {
      didPrefillRef.current = false;
      return;
    }
    if (!didPrefillRef.current) {
      didPrefillRef.current = true;
      return; // skip autofill pas pertama kali drawer dibuka
    }
    if (!isWedding) return;
    if (form.weddingSession === "fullday" || !form.weddingSession) return;
    const autoTime = getWeddingTimeRange(form.weddingSession, weddingEventTypeMapped);
    if (autoTime) {
      setForm((prev) => ({ ...prev, time: autoTime }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.weddingSession, form.eventTypeId, isWedding]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const isLockIncomplete =
    form.isDateLocked &&
    (form.bookingFeeAmount <= 0 ||
      !form.bookingFeeDate ||
      // kalau belum ada existing evidence DAN belum ada file baru → incomplete
      (!existingEvidenceUrl && !bookingFeeEvidence));

  const isIncomplete =
    !category ||
    !form.name.trim() ||
    !form.picName.trim() || !form.picPhone.trim() ||
    (!isMice && !form.eventDate) ||
    (!isMice && !form.eventTypeId) ||
    !form.sourceOfInformationId ||
    !form.assignedToId ||
    !form.statusId ||
    (isWedding && !form.weddingSession) ||
    (isWedding && !!form.eventDateAlt && !form.weddingSessionAlt) ||
    (isBitrixSource && !form.bitrixId.trim()) ||
    (!isMice && !!form.eventDateAlt && form.eventDateAlt === form.eventDate) ||
    (!isMice && isLockIncomplete);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setField = useCallback(<K extends keyof EditLeadFormState>(
    key: K,
    value: EditLeadFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSubmit() {
    if (isIncomplete || isSubmitting || !editLead) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload bukti bayar baru jika ada (replace existing)
      let evidenceUrl: string | null | undefined = undefined;
      if (form.isDateLocked) {
        if (bookingFeeEvidence) {
          // Ada file baru → upload & replace; API returns a storage key
          evidenceUrl = await uploadBookingFeeEvidence(bookingFeeEvidence);
        } else if (existingEvidenceUrl) {
          // Tidak ada file baru → pakai existing, tapi strip full URL ke storage key
          // (query layer resolves key → full URL; we must save key back, not full URL)
          evidenceUrl = extractStorageKey(existingEvidenceUrl);
        } else {
          evidenceUrl = null;
        }
      } else {
        // isDateLocked off → clear evidence
        evidenceUrl = null;
      }

      // 2. Effective session (wedding: weddingSession/weddingSessionAlt, MICE: miceSession/miceSessionAlt)
      const effectiveSession = isWedding
        ? (form.weddingSession || undefined)
        : (form.miceSession || undefined);

      const effectiveSessionAlt = isWedding
        ? (form.weddingSessionAlt || null)
        : (form.miceSessionAlt || null);

      // 3. Panggil updateLead
      const result = await updateLead.mutateAsync({
        id: editLead.id,
        name: form.name.trim(),
        contactNumbers: [{ label: form.picName.trim(), number: form.picPhone.trim().replace(/\D/g, "") }],
        email: isWedding ? undefined : (form.email || undefined),
        emailCpp: isWedding ? (form.emailCpp || undefined) : undefined,
        emailCpw: isWedding ? (form.emailCpw || undefined) : undefined,
        nikCpp: isWedding ? (form.nikCpp || undefined) : undefined,
        nikCpw: isWedding ? (form.nikCpw || undefined) : undefined,
        addressCpp: isWedding ? (form.addressCpp || undefined) : undefined,
        addressCpw: isWedding ? (form.addressCpw || undefined) : undefined,
        address: isMice ? (form.address || undefined) : undefined,
        eventDate: form.eventDate,
        eventDateAlt: form.eventDateAlt || null,
        time: form.time || undefined,
        estimatedPax: form.estimatedPax ? parseInt(form.estimatedPax, 10) : undefined,
        budgetRange: form.budgetRange || undefined,
        notes: form.notes || undefined,
        segmentId: isMice ? (form.segmentId || undefined) : undefined,
        category: category!,
        venueId: form.venueId || undefined,
        venueSecondaryId: form.venueSecondaryId || null,
        eventTypeId: form.eventTypeId,
        sourceOfInformationId: form.sourceOfInformationId,
        assignedToId: form.assignedToId,
        statusId: form.statusId,
        weddingSession: effectiveSession as "morning" | "evening" | "fullday" | undefined,
        weddingSessionAlt: effectiveSessionAlt as "morning" | "evening" | "fullday" | null,
        bitrixId: isBitrixSource ? (form.bitrixId || null) : null,
        isDateLocked: form.isDateLocked,
        bookingFeeAmount: form.isDateLocked ? form.bookingFeeAmount : null,
        bookingFeeDate: form.isDateLocked ? (form.bookingFeeDate || null) : null,
        bookingFeeEvidenceUrl: evidenceUrl ?? null,
      });

      if (!result.success) {
        setSubmitError(result.error ?? "Gagal menyimpan lead.");
        return;
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!editLead) return null;

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      title="Edit Activity"
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 pb-4">

            {/* ════════════════════════════════════════════════════════
                Tipe Booking (readonly di edit — hidden for sales-mice)
            ════════════════════════════════════════════════════════ */}
            {!isMiceOnly && <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground">Tipe Booking</p>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={cn(
                    "relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5",
                    category === "WEDDINGS"
                      ? "border-foreground bg-accent shadow-md"
                      : "border-border bg-muted/40 opacity-50",
                  )}
                >
                  {category === "WEDDINGS" && (
                    <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                      <Star weight="BoldDuotone" className="h-3 w-3 text-background" />
                    </span>
                  )}
                  <Heart
                    weight="BoldDuotone"
                    className={cn(
                      "h-8 w-8",
                      category === "WEDDINGS" ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={cn(
                      "text-sm font-bold tracking-wide",
                      category === "WEDDINGS" ? "text-foreground" : "text-muted-foreground",
                    )}>
                      WEDDINGS
                    </span>
                    <span className="text-xs text-muted-foreground">Pernikahan</span>
                  </div>
                </div>

                <div
                  className={cn(
                    "relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5",
                    category === "MICE"
                      ? "border-foreground bg-accent shadow-md"
                      : "border-border bg-muted/40 opacity-50",
                  )}
                >
                  {category === "MICE" && (
                    <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                      <Star weight="BoldDuotone" className="h-3 w-3 text-background" />
                    </span>
                  )}
                  <Suitcase
                    weight="BoldDuotone"
                    className={cn(
                      "h-8 w-8",
                      category === "MICE" ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={cn(
                      "text-sm font-bold tracking-wide",
                      category === "MICE" ? "text-foreground" : "text-muted-foreground",
                    )}>
                      MICE
                    </span>
                    <span className="text-xs text-muted-foreground">Corporate Event</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Tipe booking tidak dapat diubah setelah lead dibuat.
              </p>
            </div>}

            {/* ════════════════════════════════════════════════════════
                SECTION: Informasi Client
            ════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={User} title="Informasi Client" />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  {isMice ? "Perusahaan / Instansi" : "Nama Pasangan"}
                  <span className="text-destructive ml-0.5">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={isMice ? "e.g. PT Maju Bersama" : "e.g. Budi & Siti"}
                  className="rounded-xl"
                />
              </div>

              {isMice && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Segment / Kategori
                    <span className="ml-1.5 font-normal text-muted-foreground text-xs">(opsional)</span>
                  </label>
                  <SearchableSelect
                    options={miceSegments}
                    value={form.segmentId}
                    onChange={(id) => setField("segmentId", id)}
                    onAdd={async (name) => {
                      const created = await createSegment.mutateAsync({
                        name: name.trim(),
                        isActive: true,
                        sortOrder: 0,
                      });
                      setField("segmentId", created.id);
                    }}
                    placeholder="Pilih atau tambah segment..."
                    searchPlaceholder="Cari segment..."
                    emptyText="Belum ada segment"
                    addingLabel="Menambahkan..."
                  />
                </div>
              )}

              {!isWedding && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="nama@email.com (opsional)"
                    className="rounded-xl"
                  />
                </div>
              )}

              {isWedding && (
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
                  {/* ── Calon Pengantin Pria ── */}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Calon Pengantin Pria
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">Email CP Pria</label>
                      <Input
                        type="email"
                        value={form.emailCpp}
                        onChange={(e) => setField("emailCpp", e.target.value)}
                        placeholder="pria@email.com (opsional)"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">NIK CP Pria</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={16}
                        value={form.nikCpp}
                        onChange={(e) => setField("nikCpp", e.target.value.replace(/\D/g, ""))}
                        placeholder="16 digit NIK (opsional)"
                        className="rounded-xl font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">Alamat CP Pria</label>
                      <Textarea
                        value={form.addressCpp}
                        onChange={(e) => setField("addressCpp", e.target.value)}
                        placeholder="Alamat sesuai KTP (opsional)"
                        rows={2}
                        className="rounded-xl resize-none"
                      />
                    </div>
                  </div>

                  <div className="border-t border-border" />

                  {/* ── Calon Pengantin Wanita ── */}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Calon Pengantin Wanita
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">Email CP Wanita</label>
                      <Input
                        type="email"
                        value={form.emailCpw}
                        onChange={(e) => setField("emailCpw", e.target.value)}
                        placeholder="wanita@email.com (opsional)"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">NIK CP Wanita</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={16}
                        value={form.nikCpw}
                        onChange={(e) => setField("nikCpw", e.target.value.replace(/\D/g, ""))}
                        placeholder="16 digit NIK (opsional)"
                        className="rounded-xl font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">Alamat CP Wanita</label>
                      <Textarea
                        value={form.addressCpw}
                        onChange={(e) => setField("addressCpw", e.target.value)}
                        placeholder="Alamat sesuai KTP (opsional)"
                        rows={2}
                        className="rounded-xl resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ════════════════════════════════════════════════════════
                SECTION: Kontak
            ════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={Phone} title="Kontak (HP / WA)" />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Nama PIC / Client <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.picName}
                  onChange={(e) => setField("picName", e.target.value)}
                  placeholder={isMice ? "Nama penanggung jawab..." : "e.g. Nama CPP / CPW..."}
                  className="rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  No. HP / WA <span className="text-destructive">*</span>
                </label>
                <PhoneInput
                  value={form.picPhone}
                  onChange={(v) => setField("picPhone", v)}
                  maxNationalDigits={14}
                  wrapperClassName="rounded-xl"
                />
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                SECTION: Venue
            ════════════════════════════════════════════════════════ */}
            {!isMice && <div className="flex flex-col gap-4">
              <SectionHeader icon={MapPoint} title="Venue" />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Venue Utama</label>
                <SearchableSelect
                  options={venueOptions}
                  value={form.venueId}
                  onChange={(v) => setField("venueId", v)}
                  placeholder="Pilih venue utama..."
                  searchPlaceholder="Cari venue..."
                  emptyText="Venue tidak ditemukan"
                />
              </div>

              {showVenueSecondary ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Venue Secondary</label>
                  <SearchableSelect
                    options={venueSecondaryOptions}
                    value={form.venueSecondaryId}
                    onChange={(v) => setField("venueSecondaryId", v)}
                    placeholder="Pilih venue secondary..."
                    searchPlaceholder="Cari venue..."
                    emptyText="Venue tidak ditemukan"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowVenueSecondary(false);
                      setField("venueSecondaryId", "");
                    }}
                    className="self-start text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                  >
                    <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                    Hapus Venue Secondary
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowVenueSecondary(true)}
                  className="self-start flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                  Tambah Venue Secondary
                </button>
              )}
            </div>}

            {/* ════════════════════════════════════════════════════════
                SECTION: Tanggal Event
            ════════════════════════════════════════════════════════ */}
            {!isMice && <div className="flex flex-col gap-4">
              <SectionHeader icon={CalendarDate} title="Tanggal Event" />

              {/* Tanggal Utama + session-nya */}
              <AvailabilityDatePickerField
                label="Tanggal Utama"
                required
                value={form.eventDate}
                onChange={(v) => setField("eventDate", v)}
                placeholder="Pilih tanggal utama..."
                venueId={form.venueId || undefined}
              />

              {isWedding && (
                <SessionPillRadio
                  label="Sesi Acara (Tanggal Utama)"
                  required
                  value={form.weddingSession}
                  onChange={(v) => setField("weddingSession", v)}
                  venueId={form.venueId || undefined}
                  eventDate={form.eventDate || undefined}
                />
              )}

              {isMice && (
                <SessionPillRadio
                  label="Sesi Event (Tanggal Utama)"
                  value={form.miceSession}
                  onChange={(v) => setField("miceSession", v)}
                  venueId={form.venueId || undefined}
                  eventDate={form.eventDate || undefined}
                />
              )}

              {/* Tanggal Alternatif + session-nya */}
              {showDateAlt ? (
                <div className="flex flex-col gap-3">
                  <AvailabilityDatePickerField
                    label="Tanggal Alternatif"
                    value={form.eventDateAlt}
                    onChange={(v) => {
                      setField("eventDateAlt", v);
                      if (!v) {
                        setField("weddingSessionAlt", "");
                        setField("miceSessionAlt", "");
                      }
                    }}
                    placeholder="Pilih tanggal alternatif..."
                    venueId={form.venueId || undefined}
                  />
                  {form.eventDateAlt && form.eventDateAlt === form.eventDate && (
                    <p className="text-xs text-destructive">
                      Tanggal alternatif tidak boleh sama dengan tanggal utama.
                    </p>
                  )}

                  {isWedding && form.eventDateAlt && (
                    <SessionPillRadio
                      label="Sesi Acara (Tanggal Alternatif)"
                      required
                      value={form.weddingSessionAlt}
                      onChange={(v) => setField("weddingSessionAlt", v)}
                      venueId={form.venueId || undefined}
                      eventDate={form.eventDateAlt || undefined}
                    />
                  )}

                  {isMice && form.eventDateAlt && (
                    <SessionPillRadio
                      label="Sesi Event (Tanggal Alternatif)"
                      value={form.miceSessionAlt}
                      onChange={(v) => setField("miceSessionAlt", v)}
                      venueId={form.venueId || undefined}
                      eventDate={form.eventDateAlt || undefined}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowDateAlt(false);
                      setField("eventDateAlt", "");
                      setField("weddingSessionAlt", "");
                      setField("miceSessionAlt", "");
                    }}
                    className="self-start text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                  >
                    <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                    Hapus Tanggal Alternatif
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDateAlt(true)}
                  className="self-start flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                  Tambah Tanggal Alternatif
                </button>
              )}
            </div>}

            {/* ════════════════════════════════════════════════════════
                SECTION: Kunci Tanggal & Venue
            ════════════════════════════════════════════════════════ */}
            {!isMice && <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
                  <Switch
                    checked={form.isDateLocked}
                    onCheckedChange={(checked) => {
                      setField("isDateLocked", checked);
                      if (!checked) {
                        setField("bookingFeeAmount", 0);
                        setField("bookingFeeDate", "");
                        setBookingFeeEvidence(null);
                        // Jangan hapus existingEvidenceUrl — biar user sadar ada bukti lama
                      }
                    }}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <LockKeyhole weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      Kunci Tanggal &amp; Venue
                      {form.isDateLocked && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px] font-semibold rounded-full">
                          <LockKeyhole weight="BoldDuotone" className="h-2.5 w-2.5 mr-0.5" />
                          Terkunci
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Membutuhkan booking fee. Tanggal &amp; venue akan diblokir untuk lead/booking lain.
                    </span>
                  </div>
                </div>

                {form.isDateLocked && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-muted/60 border border-border p-3.5">
                    <ShieldWarning
                      weight="BoldDuotone"
                      className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"
                    />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Tanggal dan venue akan dikunci setelah booking fee diterima dan diverifikasi.
                      Pastikan nominal, tanggal terima, dan bukti bayar sudah diisi sebelum menyimpan.
                    </p>
                  </div>
                )}
              </div>

              {form.isDateLocked && (
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2 pb-1 border-b border-border">
                    <Banknote weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Booking Fee
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-booking-fee-amount" className="text-sm font-medium text-foreground">
                      Nominal Booking Fee
                      <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <CurrencyInput
                      id="edit-booking-fee-amount"
                      value={form.bookingFeeAmount}
                      onChange={(v) => setField("bookingFeeAmount", v)}
                      placeholder="Masukkan nominal..."
                    />
                    {form.bookingFeeAmount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Rp {fmtCurrency(form.bookingFeeAmount)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Tanggal Terima Booking Fee
                      <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <Popover open={bookingFeeDateOpen} onOpenChange={setBookingFeeDateOpen}>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal rounded-xl",
                              !form.bookingFeeDate && "text-muted-foreground",
                            )}
                          >
                            <CalendarDate weight="BoldDuotone" className="mr-2 h-4 w-4 shrink-0" />
                            {form.bookingFeeDate
                              ? format(
                                  new Date(form.bookingFeeDate + "T00:00:00"),
                                  "d MMMM yyyy",
                                  { locale: localeId },
                                )
                              : "Pilih tanggal terima..."}
                          </Button>
                        }
                      />
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={
                            form.bookingFeeDate
                              ? new Date(form.bookingFeeDate + "T00:00:00")
                              : undefined
                          }
                          onSelect={(date) => {
                            if (date) {
                              const y = date.getFullYear();
                              const m = String(date.getMonth() + 1).padStart(2, "0");
                              const d = String(date.getDate()).padStart(2, "0");
                              setField("bookingFeeDate", `${y}-${m}-${d}`);
                            } else {
                              setField("bookingFeeDate", "");
                            }
                            setBookingFeeDateOpen(false);
                          }}
                          fromYear={new Date().getFullYear() - 1}
                          toYear={new Date().getFullYear() + 5}
                          defaultMonth={
                            form.bookingFeeDate
                              ? new Date(form.bookingFeeDate + "T00:00:00")
                              : new Date()
                          }
                        />
                        {form.bookingFeeDate && (
                          <div className="border-t p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs text-muted-foreground"
                              onClick={() => {
                                setField("bookingFeeDate", "");
                                setBookingFeeDateOpen(false);
                              }}
                            >
                              Hapus tanggal
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Bukti Bayar — show existing + optional replace */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Bukti Bayar / Evidence
                      <span className="text-destructive ml-0.5">*</span>
                    </label>

                    {/* Existing evidence URL (kalau ada dan belum di-replace) */}
                    {existingEvidenceUrl && !bookingFeeEvidence && (
                      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                        <FileText weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <a
                          href={existingEvidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 truncate text-xs font-medium text-foreground hover:underline flex items-center gap-1"
                        >
                          Lihat Bukti Bayar
                          <LinkMinimalistic weight="BoldDuotone" className="h-3 w-3 shrink-0" />
                        </a>
                        <span className="text-xs text-muted-foreground shrink-0">(ganti jika perlu)</span>
                      </div>
                    )}

                    {/* Upload area */}
                    <input
                      ref={evidenceInputRef}
                      id="edit-booking-fee-evidence-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setBookingFeeEvidence(file);
                        if (evidenceInputRef.current) evidenceInputRef.current.value = "";
                      }}
                    />
                    <div
                      className={cn(
                        "flex items-center gap-2.5 w-full rounded-xl border border-dashed text-sm transition-colors",
                        bookingFeeEvidence
                          ? "border-border bg-muted/40 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground",
                      )}
                    >
                      <label
                        htmlFor="edit-booking-fee-evidence-input"
                        className={cn(
                          "flex flex-1 min-w-0 items-center gap-2.5 px-3 py-2.5 cursor-pointer",
                          !bookingFeeEvidence && "hover:bg-muted/50",
                        )}
                      >
                        {bookingFeeEvidence ? (
                          <>
                            <FileText weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate text-xs font-medium">
                              {bookingFeeEvidence.name}
                            </span>
                          </>
                        ) : (
                          <>
                            <Gallery weight="BoldDuotone" className="h-4 w-4 shrink-0" />
                            <span className="text-xs">
                              {existingEvidenceUrl ? "Ganti bukti bayar..." : "Pilih foto / PDF bukti bayar..."}
                            </span>
                          </>
                        )}
                      </label>
                      {bookingFeeEvidence && (
                        <button
                          type="button"
                          onClick={() => setBookingFeeEvidence(null)}
                          className="shrink-0 p-0.5 mr-2.5 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Hapus file"
                        >
                          <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Format: JPG, PNG, WebP, PDF. Maks 10 MB.
                    </p>
                  </div>
                </div>
              )}
            </div>}

            {/* ════════════════════════════════════════════════════════
                SECTION: Detail Event
            ════════════════════════════════════════════════════════ */}
            {!isMice && <div className="flex flex-col gap-4">
              <SectionHeader icon={Buildings2} title="Detail Event" />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Event Type <span className="text-destructive">*</span>
                </label>
                <SearchableSelect
                  options={eventTypeOptions}
                  value={form.eventTypeId}
                  onChange={(v) => {
                    setField("eventTypeId", v);
                    setField("time", "");
                  }}
                  placeholder={
                    isWedding ? "Pilih jenis acara nikah..." : "Pilih jenis event MICE..."
                  }
                  searchPlaceholder="Cari event type..."
                  emptyText="Tidak ada event type"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Estimasi Waktu</label>
                <TimeRangePicker
                  value={form.time}
                  onChange={(v) => setField("time", v)}
                  placeholder="Pilih waktu (bisa rentang)..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Estimasi Pax</label>
                <Input
                  type="number"
                  min={1}
                  value={form.estimatedPax}
                  onChange={(e) => setField("estimatedPax", e.target.value)}
                  placeholder="300"
                  inputMode="numeric"
                  className="rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <TagPrice weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                  Budget Range
                </label>
                <Input
                  value={form.budgetRange}
                  onChange={(e) => setField("budgetRange", e.target.value)}
                  placeholder="e.g. 50 - 75 juta (opsional)"
                  className="rounded-xl"
                />
              </div>
            </div>}

            {/* ════════════════════════════════════════════════════════
                SECTION: Prospek & Penawaran (MICE only)
            ════════════════════════════════════════════════════════ */}
            {isMice && <div className="flex flex-col gap-4">
              <SectionHeader icon={Case} title="Prospek & Penawaran" />

              {/* Lokasi / Alamat kantor prospek */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Streets weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                  Lokasi / Alamat Kantor
                </label>
                <Textarea
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="e.g. Cibis 9, Cilandak, Jakarta Selatan (opsional)"
                  rows={2}
                  className="rounded-xl resize-none"
                />
              </div>

              {/* Instagram prospek */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Camera weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                  Instagram
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    @
                  </span>
                  <Input
                    value={form.instagramUrl}
                    onChange={(e) => setField("instagramUrl", e.target.value)}
                    placeholder="username atau link instagram (opsional)"
                    className="rounded-xl pl-7"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Boleh isi username (mis. cosmaxindonesia) atau tempel link lengkap.
                </p>
              </div>

              {/* Jadwal Site Visit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <CalendarMark weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                  Jadwal Site Visit
                </label>
                <Popover open={siteVisitDateOpen} onOpenChange={setSiteVisitDateOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal rounded-xl",
                          !form.siteVisitDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarDate weight="BoldDuotone" className="mr-2 h-4 w-4 shrink-0" />
                        {form.siteVisitDate
                          ? format(
                              new Date(form.siteVisitDate + "T00:00:00"),
                              "d MMMM yyyy",
                              { locale: localeId },
                            )
                          : "Pilih tanggal kunjungan... (opsional)"}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={
                        form.siteVisitDate
                          ? new Date(form.siteVisitDate + "T00:00:00")
                          : undefined
                      }
                      onSelect={(date) => {
                        if (date) {
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(2, "0");
                          const d = String(date.getDate()).padStart(2, "0");
                          setField("siteVisitDate", `${y}-${m}-${d}`);
                        } else {
                          setField("siteVisitDate", "");
                        }
                        setSiteVisitDateOpen(false);
                      }}
                      fromYear={new Date().getFullYear() - 1}
                      toYear={new Date().getFullYear() + 5}
                      defaultMonth={
                        form.siteVisitDate
                          ? new Date(form.siteVisitDate + "T00:00:00")
                          : new Date()
                      }
                    />
                    {form.siteVisitDate && (
                      <div className="border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground"
                          onClick={() => {
                            setField("siteVisitDate", "");
                            setSiteVisitDateOpen(false);
                          }}
                        >
                          Hapus tanggal
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>}

            {/* ════════════════════════════════════════════════════════
                SECTION: Sales & Pipeline
            ════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={UsersGroupRounded} title="Sales & Pipeline" />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Sumber Informasi <span className="text-destructive">*</span>
                </label>
                <SearchableSelect
                  options={sources}
                  value={form.sourceOfInformationId}
                  onChange={(v) => {
                    setField("sourceOfInformationId", v);
                    const isBitrix =
                      sources.find((s) => s.id === v)
                        ?.name.toLowerCase()
                        .includes("bitrix") ?? false;
                    if (!isBitrix) setField("bitrixId", "");
                  }}
                  onAdd={handleAddSource}
                  placeholder="Pilih atau tambah sumber..."
                  searchPlaceholder="Cari atau tambah sumber..."
                  emptyText="Belum ada sumber"
                  addingLabel="Menambahkan..."
                />
              </div>

              {isBitrixSource && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Bitrix ID <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.bitrixId}
                    onChange={(e) => setField("bitrixId", e.target.value)}
                    placeholder="e.g. 12345"
                    className="rounded-xl"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Sales PIC <span className="text-destructive">*</span>
                </label>
                <SearchableSelect
                  options={salesOptions}
                  value={form.assignedToId}
                  onChange={(v) => setField("assignedToId", v)}
                  placeholder="Pilih sales PIC..."
                  searchPlaceholder="Cari sales..."
                  emptyText="Sales tidak ditemukan"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Status Pipeline <span className="text-destructive">*</span>
                </label>
                <SearchableSelect
                  options={statusOptions}
                  value={form.statusId}
                  onChange={(v) => setField("statusId", v)}
                  placeholder="Pilih status..."
                  searchPlaceholder="Cari status..."
                  emptyText="Tidak ada status"
                />
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                SECTION: Catatan
            ════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={Notes} title="Catatan" />
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                placeholder="Catatan tambahan mengenai lead ini (opsional)..."
                className="rounded-xl resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="sticky bottom-0 bg-background pt-4 border-t border-border mt-2">
          {submitError && (
            <p className="mb-3 text-xs text-destructive text-center">{submitError}</p>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 rounded-full"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isIncomplete || isSubmitting}
              className="flex-1 rounded-full"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Refresh weight="BoldDuotone" className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </span>
              ) : (
                "Simpan Perubahan"
              )}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
