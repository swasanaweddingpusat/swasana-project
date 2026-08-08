"use client";

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
import { ContactEntry, parseStoredPhone } from "@/components/shared/PhoneInput";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
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
  Camera,
  CalendarMark,
  ChatRound,
  Streets,
  Case,
} from "@solar-icons/react";
import {
  getWeddingTimeRange,
  type WeddingEventType,
} from "@/lib/constants/wedding-session-times";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import { useLeadSegments, useCreateLeadSegment } from "@/hooks/use-lead-segments";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCreateDailyActivity } from "@/hooks/use-daily-activities";
import {
  SectionHeader,
  SessionPillRadio,
  AvailabilityDatePickerField,
  CurrencyInput,
  fmtCurrency,
  mapCodeToWeddingEventType,
} from "./daily-activity-form-fields";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingCategory = "WEDDINGS" | "MICE";
type WeddingSession = "morning" | "evening" | "fullday";


interface ContactNumber {
  label: string;
  number: string;
}

// MICE offering channel — cara sales melakukan penawaran ke prospek.
// Menggantikan kolom "Milestone Client" di sheet yang isinya free-text campur aduk
// (Penawaran Via DM / pitching by ig,email / Sudah isi gform / dll) → dinormalisasi
// jadi pilihan konsisten yang bisa difilter.
type OfferingChannel =
  | "WHATSAPP"
  | "INSTAGRAM_DM"
  | "EMAIL"
  | "TITIP_PROPOSAL"
  | "GFORM"
  | "LINKEDIN"
  | "PHONE"
  | "OTHER";

interface CreateDailyActivityFormState {
  name: string;
  email: string;
  emailCpp: string;
  emailCpw: string;
  nikCpp: string;
  nikCpw: string;
  addressCpp: string;
  addressCpw: string;
  address: string;
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
  packageId: string;
  segmentId: string;
  miceSession: WeddingSession | "";
  miceSessionAlt: WeddingSession | "";
  isDateLocked: boolean;
  bookingFeeAmount: number;
  bookingFeeDate: string;
  // ── MICE prospecting fields (dipindah dari Google Sheet "Daily Activity MICE") ──
  instagramUrl: string; // handle / URL IG prospek (dinormalisasi saat submit)
  siteVisitDate: string; // "YYYY-MM-DD" jadwal kunjungan venue
  offeringChannel: OfferingChannel | ""; // cara penawaran (enum bersih)
  offeringNote: string; // detail penawaran bebas (mis. "req hard copy weekdays")
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FORM: CreateDailyActivityFormState = {
  name: "",
  email: "",
  emailCpp: "",
  emailCpw: "",
  nikCpp: "",
  nikCpw: "",
  addressCpp: "",
  addressCpw: "",
  address: "",
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
  packageId: "",
  segmentId: "",
  miceSession: "",
  miceSessionAlt: "",
  isDateLocked: false,
  bookingFeeAmount: 5000000,
  bookingFeeDate: "",
  instagramUrl: "",
  siteVisitDate: "",
  offeringChannel: "",
  offeringNote: "",
};

// ── Opsi channel penawaran (label ramah untuk dropdown) ──────────────────────
const OFFERING_CHANNEL_OPTIONS: { id: OfferingChannel; name: string }[] = [
  { id: "WHATSAPP", name: "WhatsApp" },
  { id: "INSTAGRAM_DM", name: "Instagram DM" },
  { id: "EMAIL", name: "Email" },
  { id: "TITIP_PROPOSAL", name: "Titip Proposal / Hard Copy" },
  { id: "GFORM", name: "Google Form Pengajuan" },
  { id: "LINKEDIN", name: "LinkedIn" },
  { id: "PHONE", name: "Telepon" },
  { id: "OTHER", name: "Lainnya" },
];

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadBookingFeeEvidence(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/booking-fee-evidence", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal upload bukti bayar");
  }
  const { key } = await res.json() as { key: string };
  return key;
}

// Sub-components are imported from ./lead-form-fields


// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateDailyActivityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreateDailyActivityDrawer({ open, onOpenChange, onSuccess }: CreateDailyActivityDrawerProps) {
  // ── Step 0: tipe booking ────────────────────────────────────────────────────
  const [category, setCategory] = useState<BookingCategory | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<CreateDailyActivityFormState>(DEFAULT_FORM);

  // ── Multi-contact state ────────────────────────────────────────────────────
  const [contactNumbers, setContactNumbers] = useState<ContactNumber[]>([]);
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [contactInput, setContactInput] = useState({ name: "", phone: "" });

  // ── MICE segment options (normalized master, FK-backed) ──────────────────────
  const { data: masterSegments = [] } = useLeadSegments();
  const createSegment = useCreateLeadSegment();
  const miceSegments = masterSegments
    .filter((s) => s.isActive)
    .map((s) => ({ id: s.id, name: s.name }));

  // ── UI toggles ─────────────────────────────────────────────────────────────
  const [showDateAlt, setShowDateAlt] = useState(false);
  const [showVenueSecondary, setShowVenueSecondary] = useState(false);

  // ── Booking fee evidence ───────────────────────────────────────────────────
  const [bookingFeeEvidence, setBookingFeeEvidence] = useState<File | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  // ── Booking fee date popover ───────────────────────────────────────────────
  const [bookingFeeDateOpen, setBookingFeeDateOpen] = useState(false);

  // ── Site visit date popover (MICE) ─────────────────────────────────────────
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
  const createLead = useCreateDailyActivity();

  // ── Sales PIC lock ───────────────────────────────────────────────────────────
  // When the logged-in user is a sales rep, the PIC is forced to themselves and
  // locked. AssignableSalesUser.id and session.user.profileId are both profile ids.
  const isSalesRole =
    currentUser?.roleName === "sales" || currentUser?.roleName === "sales-mice";

  // sales-mice only works with MICE leads — auto-select category and hide the picker.
  const isMiceOnly = currentUser?.roleName === "sales-mice";
  const isSelfAssignableSales =
    isSalesRole &&
    !!currentUser?.profileId &&
    salesUsers.some((u) => u.id === currentUser.profileId);

  // Force assignedToId to the sales rep once the drawer is open and data is ready.
  useEffect(() => {
    if (!open || !isSelfAssignableSales || !currentUser?.profileId) return;
    setForm((prev) =>
      prev.assignedToId === currentUser.profileId
        ? prev
        : { ...prev, assignedToId: currentUser.profileId! },
    );
  }, [open, isSelfAssignableSales, currentUser?.profileId]);

  // Auto-select MICE for sales-mice role — they only handle corporate leads.
  useEffect(() => {
    if (open && isMiceOnly && category !== "MICE") setCategory("MICE");
  }, [open, isMiceOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────
  const isWedding = category === "WEDDINGS";
  const isMice = category === "MICE";

  const venueOptions = venues.map((v) => ({ id: v.id, name: v.name }));
  const venueSecondaryOptions = venueOptions.filter((v) => v.id !== form.venueId);

  const eventTypeOptions = (eventTypesData ?? []).map((et) => ({ id: et.id, name: et.name, code: et.code }));
  const statusOptions = leadStatuses.map((s) => ({ id: s.id, name: s.name }));
  const salesOptions = salesUsers.map((u) => ({
    id: u.id,
    name: u.fullName ?? u.id,
  }));
  // Source of informations — fetched inline (no hook exists, quick fetch)
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/source-of-informations")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setSources(data); })
      .catch(() => {});
  }, []);

  const isBitrixSource =
    sources.find((s) => s.id === form.sourceOfInformationId)
      ?.name.toLowerCase()
      .includes("bitrix") ?? false;

  // Booking fee lock validation
  const isLockIncomplete =
    form.isDateLocked &&
    (form.bookingFeeAmount <= 0 || !form.bookingFeeDate || !bookingFeeEvidence);

  const isIncomplete =
    !category ||
    !form.name.trim() ||
    contactNumbers.length === 0 ||
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

  // ── Auto-fill time from session + event type ────────────────────────────────
  const selectedEventType = eventTypeOptions.find((et) => et.id === form.eventTypeId);
  const weddingEventTypeMapped: WeddingEventType | "" = selectedEventType
    ? mapCodeToWeddingEventType(selectedEventType.code)
    : "";

  useEffect(() => {
    if (!isWedding) return;
    // fullday has no standard time range; morning/evening are mapped
    if (form.weddingSession === "fullday" || !form.weddingSession) return;
    const sessionVal = form.weddingSession; // "morning" | "evening"
    const autoTime = getWeddingTimeRange(sessionVal, weddingEventTypeMapped);
    if (autoTime) {
      setForm((prev) => ({ ...prev, time: autoTime }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.weddingSession, form.eventTypeId, isWedding]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setField = useCallback(<K extends keyof CreateDailyActivityFormState>(
    key: K,
    value: CreateDailyActivityFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  function handleCategorySelect(cat: BookingCategory) {
    setCategory(cat);
    setForm((prev) => ({
      ...prev,
      eventTypeId: "",
      weddingSession: "",
      weddingSessionAlt: "",
      packageId: "",
      emailCpp: "",
      emailCpw: "",
      nikCpp: "",
      nikCpw: "",
      addressCpp: "",
      addressCpw: "",
      segmentId: "",
      miceSession: "",
      miceSessionAlt: "",
      time: "",
      address: "",
      instagramUrl: "",
      siteVisitDate: "",
      offeringChannel: "",
      offeringNote: "",
    }));
  }

  function addContact() {
    const label = contactInput.name.trim();
    const stored = contactInput.phone.trim();
    if (!label || !stored) return;
    const { nationalNumber } = parseStoredPhone(stored);
    if (nationalNumber.length < 7) return;
    if (contactNumbers.some((c) => c.number === stored)) return;
    setContactNumbers((prev) => [...prev, { label, number: stored }]);
    setContactInput({ name: "", phone: "" });
    setContactPopoverOpen(false);
  }

  function removeContact(idx: number) {
    setContactNumbers((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setCategory(null);
    setForm(DEFAULT_FORM);
    setContactNumbers([]);
    setShowDateAlt(false);
    setShowVenueSecondary(false);
    setBookingFeeEvidence(null);
    setSubmitError(null);
  }



  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit() {
    if (isIncomplete || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload booking fee evidence to S3 first (if locked + evidence provided)
      let evidenceUrl: string | null = null;
      if (form.isDateLocked && bookingFeeEvidence) {
        evidenceUrl = await uploadBookingFeeEvidence(bookingFeeEvidence);
      }

      // 2. Determine effective session (MICE uses miceSession mapped to weddingSession field)
      const effectiveSession = isWedding
        ? (form.weddingSession || undefined)
        : (form.miceSession || undefined);

      const effectiveSessionAlt = isWedding
        ? (form.weddingSessionAlt || null)
        : (form.miceSessionAlt || null);

      // 3. Call createLead server action
      const result = await createLead.mutateAsync({
        name: form.name.trim(),
        contactNumbers,
        email: isWedding ? undefined : (form.email || undefined),
        emailCpp: isWedding ? (form.emailCpp || undefined) : undefined,
        emailCpw: isWedding ? (form.emailCpw || undefined) : undefined,
        nikCpp: isWedding ? (form.nikCpp || undefined) : undefined,
        nikCpw: isWedding ? (form.nikCpw || undefined) : undefined,
        addressCpp: isWedding ? (form.addressCpp || undefined) : undefined,
        addressCpw: isWedding ? (form.addressCpw || undefined) : undefined,
        address: isMice ? (form.address || undefined) : undefined,
        // NOTE(UI-first): instagramUrl / siteVisitDate / offeringChannel / offeringNote
        // belum dikirim — field DB-nya belum ada. Menunggu UI di-acc lalu migration.
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
        packageId: isWedding ? (form.packageId || null) : null,
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
        bookingFeeEvidenceUrl: evidenceUrl,
      });

      if (!result.success) {
        setSubmitError(result.error ?? "Gagal menyimpan lead.");
        return;
      }

      resetForm();
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

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      title="Tambah Lead Baru"
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 pb-4">

            {/* ════════════════════════════════════════════════════════
                STEP 0 — Pilih Tipe Booking (hidden for sales-mice)
            ════════════════════════════════════════════════════════ */}
            {!isMiceOnly && <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground">
                Tipe Booking <span className="text-destructive">*</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleCategorySelect("WEDDINGS")}
                  className={cn(
                    "relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    category === "WEDDINGS"
                      ? "border-foreground bg-accent shadow-md"
                      : "border-border bg-card hover:border-foreground/30 hover:shadow-sm",
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
                      "h-8 w-8 transition-colors",
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
                </button>

                <button
                  type="button"
                  onClick={() => handleCategorySelect("MICE")}
                  className={cn(
                    "relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    category === "MICE"
                      ? "border-foreground bg-accent shadow-md"
                      : "border-border bg-card hover:border-foreground/30 hover:shadow-sm",
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
                      "h-8 w-8 transition-colors",
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
                </button>
              </div>
            </div>}

            {/* ════════════════════════════════════════════════════════
                FIELDS — hanya tampil setelah kategori dipilih
            ════════════════════════════════════════════════════════ */}
            {category && (
              <>
                {/* ── SECTION: Informasi Client ─────────────────────── */}
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

                {/* ── SECTION: Kontak ───────────────────────────────── */}
                <div className="flex flex-col gap-4">
                  <SectionHeader icon={Phone} title="Kontak (HP / WA)" />

                  <div className="rounded-2xl bg-muted p-4 flex flex-col gap-2">
                    {contactNumbers.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl bg-background border border-border px-3 py-2.5 shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground font-medium">{entry.label}</p>
                          <p className="text-sm font-semibold text-foreground">+{entry.number}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContact(idx)}
                          className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`Hapus ${entry.label}`}
                        >
                          <CloseCircle weight="BoldDuotone" className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <Popover
                      open={contactPopoverOpen}
                      onOpenChange={(o) => {
                        setContactPopoverOpen(o);
                        if (!o) setContactInput({ name: "", phone: "" });
                      }}
                    >
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full rounded-xl text-xs h-9 border-dashed gap-1.5"
                          >
                            <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                            {contactNumbers.length === 0 ? "Tambah Nomor HP/WA *" : "Tambah Nomor Lain"}
                          </Button>
                        }
                      />
                      <PopoverContent className="w-72 p-3" align="end">
                        <p className="text-xs font-semibold mb-3">Tambah Nomor Kontak</p>
                        <ContactEntry
                          nameValue={contactInput.name}
                          onNameChange={(v) => setContactInput((p) => ({ ...p, name: v }))}
                          phoneValue={contactInput.phone}
                          onPhoneChange={(v) => setContactInput((p) => ({ ...p, phone: v }))}
                          onAdd={addContact}
                          namePlaceholder={isMice ? "Nama PIC..." : "Label wajib: cpw, cpp, ortu..."}
                        />
                      </PopoverContent>
                    </Popover>

                    {contactNumbers.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        Minimal 1 nomor wajib diisi
                      </p>
                    )}
                  </div>
                </div>

                {/* ── SECTION: Venue ────────────────────────────────── */}
                {!isMice && <div className="flex flex-col gap-4">
                  <SectionHeader icon={MapPoint} title="Venue" />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Venue Utama</label>
                    <SearchableSelect
                      options={venueOptions}
                      value={form.venueId}
                      onChange={(v) => {
                        setField("venueId", v);
                        setField("packageId", "");
                      }}
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

                {/* ── SECTION: Tanggal Event ────────────────────────── */}
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

                {/* ── SECTION: Kunci Tanggal & Venue ───────────────────── */}
                {!isMice && <div className="flex flex-col gap-4">
                  {/* ── Toggle: Kunci Tanggal & Venue ─────────────────── */}
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

                  {/* ── Booking Fee section — hanya tampil saat locked ON ── */}
                  {form.isDateLocked && (
                    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="flex items-center gap-2 pb-1 border-b border-border">
                        <Banknote weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Booking Fee
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="booking-fee-amount" className="text-sm font-medium text-foreground">
                          Nominal Booking Fee
                          <span className="text-destructive ml-0.5">*</span>
                        </label>
                        <CurrencyInput
                          id="booking-fee-amount"
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

                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                          Bukti Bayar / Evidence
                          <span className="text-destructive ml-0.5">*</span>
                        </label>
                        <input
                          ref={evidenceInputRef}
                          id="booking-fee-evidence-input"
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
                            htmlFor="booking-fee-evidence-input"
                            className={cn(
                              "flex flex-1 min-w-0 items-center gap-2.5 px-3 py-2.5 cursor-pointer",
                              !bookingFeeEvidence && "hover:border-foreground/30 hover:bg-muted/50",
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
                                <span className="text-xs">Pilih foto / PDF bukti bayar...</span>
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

                {/* ── SECTION: Detail Event ─────────────────────────── */}
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
                        setField("time", ""); // clear time so autofill can fire
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

                {/* ── SECTION: Prospek & Penawaran (MICE only) ──────────
                    Field yang dipindahkan dari Google Sheet "Daily Activity
                    MICE": lokasi kantor, Instagram, jadwal site visit, dan
                    cara/channel penawaran. ─────────────────────────────── */}
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

                  {/* Channel Penawaran */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <ChatRound weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                      Cara Penawaran
                    </label>
                    <SearchableSelect
                      options={OFFERING_CHANNEL_OPTIONS}
                      value={form.offeringChannel}
                      onChange={(v) => setField("offeringChannel", v as OfferingChannel)}
                      placeholder="Pilih cara penawaran... (opsional)"
                      searchPlaceholder="Cari channel..."
                      emptyText="Tidak ada opsi"
                    />
                  </div>

                  {/* Catatan Penawaran */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Catatan Penawaran
                    </label>
                    <Input
                      value={form.offeringNote}
                      onChange={(e) => setField("offeringNote", e.target.value)}
                      placeholder="e.g. req kirim proposal hard copy weekdays (opsional)"
                      className="rounded-xl"
                    />
                  </div>
                </div>}

                {/* ── SECTION: Sales & Pipeline ─────────────────────── */}
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
                      placeholder="Pilih sumber informasi..."
                      searchPlaceholder="Cari sumber..."
                      emptyText="Tidak ada data"
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
                      disabled={isSelfAssignableSales}
                    />
                    {isSelfAssignableSales && (
                      <p className="text-xs text-muted-foreground">
                        Lead otomatis ditugaskan ke Anda.
                      </p>
                    )}
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

                {/* ── SECTION: Catatan ──────────────────────────────── */}
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
              </>
            )}
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
                "Simpan Lead"
              )}
            </Button>
          </div>
          {!category && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Pilih tipe booking dulu untuk melanjutkan
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
