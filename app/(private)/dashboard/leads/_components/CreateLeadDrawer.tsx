"use client";

/**
 * CreateLeadDrawer — frontend-only UI for creating a new lead.
 *
 * FRONTEND ONLY: uses dummy data for all select options.
 * No server actions or API calls are made.
 *
 * TODO(backend): replace all dummy data arrays + submit handler with real hooks/actions.
 */

import React, { useState, useRef } from "react";
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
  type IconProps,
} from "@solar-icons/react";

// ─── Currency helpers (same pattern as DrawerFinanceBase) ─────────────────────

function fmtCurrency(value: number): string {
  if (!value) return "";
  return value.toLocaleString("id-ID");
}

function parseCurrency(value: string): number {
  return parseInt(value.replace(/\D/g, ""), 10) || 0;
}

// ─── Availability dummy logic ─────────────────────────────────────────────────
//
// DUMMY: maps a specific set of date strings to "unavailable" to simulate
// a fully-booked date. Any other non-empty date = "available".
// Partial example included for demo.
// TODO(backend): replace dummy availability with grouped booking+locked-lead check
// against the real bookings table (category, session, venueId filters).

type AvailStatus = "available" | "partial" | "unavailable";

const DUMMY_BOOKED_DATES: Set<string> = new Set([
  "2026-08-02",
  "2026-08-15",
  "2026-09-06",
]);

const DUMMY_PARTIAL_DATES: Set<string> = new Set([
  "2026-08-09",
  "2026-09-20",
]);

function getDummyAvailability(dateStr: string): AvailStatus | null {
  if (!dateStr) return null;
  if (DUMMY_BOOKED_DATES.has(dateStr)) return "unavailable";
  if (DUMMY_PARTIAL_DATES.has(dateStr)) return "partial";
  return "available";
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingCategory = "WEDDINGS" | "MICE";

type WeddingSession = "morning" | "evening" | "fullday";

interface ContactNumber {
  label: string;
  number: string; // stored: dialCode+national (e.g. "6281234567890")
}

interface CreateLeadFormState {
  // Common
  name: string;
  email: string;
  emailCpp: string; // wedding only
  emailCpw: string; // wedding only
  eventDate: string; // "yyyy-MM-dd"
  eventDateAlt: string; // "yyyy-MM-dd", optional
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
  // Wedding-only
  weddingSession: WeddingSession | "";
  packageId: string;
  // MICE-only
  instansi: string;
  miceSession: WeddingSession | "";
  // Kunci Tanggal & Venue
  isDateLocked: boolean;
  bookingFeeAmount: number;
  bookingFeeDate: string; // "yyyy-MM-dd"
}

// ─── Dummy data ───────────────────────────────────────────────────────────────
// TODO(backend): replace all dummy arrays with real TanStack Query hooks
// e.g. useVenues(), useEventTypes(), useLeadStatuses(), useSalesUsers(), etc.

const DUMMY_VENUES: { id: string; name: string }[] = [
  { id: "v1", name: "The Grand Ballroom" },
  { id: "v2", name: "Garden Pavillion" },
  { id: "v3", name: "Skyline Hall" },
  { id: "v4", name: "Heritage Room" },
  { id: "v5", name: "Lakeside Terrace" },
];

const DUMMY_EVENT_TYPES_WEDDING: { id: string; name: string }[] = [
  { id: "et-w1", name: "Akad Nikah" },
  { id: "et-w2", name: "Resepsi" },
  { id: "et-w3", name: "Akad & Resepsi" },
  { id: "et-w4", name: "Pengajian" },
];

const DUMMY_EVENT_TYPES_MICE: { id: string; name: string }[] = [
  { id: "et-m1", name: "Meeting" },
  { id: "et-m2", name: "Incentive" },
  { id: "et-m3", name: "Conference" },
  { id: "et-m4", name: "Exhibition" },
  { id: "et-m5", name: "Seminar" },
];

const DUMMY_SOURCES: { id: string; name: string }[] = [
  { id: "src1", name: "Instagram" },
  { id: "src2", name: "TikTok" },
  { id: "src3", name: "Rekomendasi Teman" },
  { id: "src4", name: "Bitrix CRM" }, // name contains "bitrix" → triggers bitrixId field
  { id: "src5", name: "Walk-in" },
  { id: "src6", name: "Website" },
  { id: "src7", name: "Google Ads" },
];

const DUMMY_SALES: { id: string; name: string; badge?: string }[] = [
  { id: "sal1", name: "Rina Wulandari", badge: "Sales" },
  { id: "sal2", name: "Budi Santoso", badge: "Sales" },
  { id: "sal3", name: "Dewi Maharani", badge: "Sales-Mice" },
  { id: "sal4", name: "Agus Pratama", badge: "Sales" },
  { id: "sal5", name: "Siti Rahayu", badge: "Sales-Mice" },
];

const DUMMY_STATUSES: { id: string; name: string; color: string }[] = [
  { id: "st1", name: "Cold", color: "#94a3b8" },
  { id: "st2", name: "Warm", color: "#f59e0b" },
  { id: "st3", name: "Hot", color: "#ef4444" },
  { id: "st4", name: "Follow-up", color: "#3b82f6" },
  { id: "st5", name: "Proposal Sent", color: "#8b5cf6" },
];

const DUMMY_PACKAGES: { id: string; name: string }[] = [
  { id: "pkg1", name: "Package Silver — 200 pax" },
  { id: "pkg2", name: "Package Gold — 300 pax" },
  { id: "pkg3", name: "Package Platinum — 500 pax" },
  { id: "pkg4", name: "Package Intimate — 100 pax" },
];

// ─── Constants ─────────────────────────────────────────────────────────────────

const SESSION_OPTIONS: { id: WeddingSession; name: string }[] = [
  { id: "morning", name: "Pagi (Morning)" },
  { id: "evening", name: "Malam (Evening)" },
  { id: "fullday", name: "Full Day" },
];

const DEFAULT_FORM: CreateLeadFormState = {
  name: "",
  email: "",
  emailCpp: "",
  emailCpw: "",
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
  packageId: "",
  instansi: "",
  miceSession: "",
  isDateLocked: false,
  bookingFeeAmount: 0,
  bookingFeeDate: "",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Section header dengan icon + judul */
function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-border">
      <Icon weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

/** Date picker button + calendar popover — reusable for Utama & Alternatif */
function DatePickerField({
  label,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayDate = value
    ? format(new Date(value + "T00:00:00"), "d MMMM yyyy", { locale: localeId })
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal rounded-xl",
                !displayDate && "text-muted-foreground",
              )}
            >
              <CalendarDate weight="BoldDuotone" className="mr-2 h-4 w-4 shrink-0" />
              {displayDate ?? (placeholder ?? "Pilih tanggal...")}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={value ? new Date(value + "T00:00:00") : undefined}
            onSelect={(date) => {
              if (date) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                onChange(`${y}-${m}-${d}`);
              } else {
                onChange("");
              }
              setOpen(false);
            }}
            fromYear={new Date().getFullYear() - 1}
            toYear={new Date().getFullYear() + 5}
            defaultMonth={value ? new Date(value + "T00:00:00") : new Date()}
          />
          {value && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => { onChange(""); setOpen(false); }}
              >
                Hapus tanggal
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Pill radio session (morning / evening / fullday) */
function SessionPillRadio({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: WeddingSession | "";
  onChange: (v: WeddingSession) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="flex gap-2 flex-wrap">
        {SESSION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === opt.id
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            {opt.id === "morning" ? "Pagi" : opt.id === "evening" ? "Malam" : "Full Day"}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Badge availability dummy — shown below each date field when a date is chosen */
function AvailabilityBadge({ dateStr }: { dateStr: string }) {
  const status = getDummyAvailability(dateStr);
  if (!status) return null;

  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <span>&#10003;</span>
        Tersedia
      </span>
    );
  }
  if (status === "unavailable") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <span>&#10007;</span>
        Terisi
      </span>
    );
  }
  // partial
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
      <span>&#9888;</span>
      Tersedia sebagian
    </span>
  );
}

/** Currency input with "Rp" prefix — pattern from DrawerFinanceBase */
function CurrencyInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [localText, setLocalText] = useState("");

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        Rp
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder ?? "0"}
        value={focused ? localText : fmtCurrency(value)}
        onFocus={() => {
          setLocalText(fmtCurrency(value));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          const num = parseCurrency(raw);
          setLocalText(raw ? fmtCurrency(num) : "");
          onChange(num);
        }}
        className="pl-9 rounded-xl"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CreateLeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after dummy submit with payload — real implementation connects to server action */
  onSubmit?: (
    payload: CreateLeadFormState & {
      contactNumbers: ContactNumber[];
      /** File object from booking fee evidence upload. TODO(backend): wire to storage. */
      bookingFeeEvidence: File | null;
    },
  ) => void;
}

export function CreateLeadDrawer({ open, onOpenChange, onSubmit }: CreateLeadDrawerProps) {
  // ── Step 0: tipe booking ────────────────────────────────────────────────────
  const [category, setCategory] = useState<BookingCategory | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<CreateLeadFormState>(DEFAULT_FORM);

  // ── Multi-contact state ────────────────────────────────────────────────────
  const [contactNumbers, setContactNumbers] = useState<ContactNumber[]>([]);
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [contactInput, setContactInput] = useState({ name: "", phone: "" });

  // ── Date alt toggle ────────────────────────────────────────────────────────
  const [showDateAlt, setShowDateAlt] = useState(false);

  // ── Venue secondary toggle ─────────────────────────────────────────────────
  const [showVenueSecondary, setShowVenueSecondary] = useState(false);

  // ── Booking fee evidence (file-only, frontend state) ───────────────────────
  // TODO(backend): wire evidence upload to storage (MinIO/S3) via server action
  const [bookingFeeEvidence, setBookingFeeEvidence] = useState<File | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  // ── Booking fee date popover ───────────────────────────────────────────────
  const [bookingFeeDateOpen, setBookingFeeDateOpen] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isWedding = category === "WEDDINGS";
  const isMice = category === "MICE";

  const isBitrixSource =
    DUMMY_SOURCES.find((s) => s.id === form.sourceOfInformationId)
      ?.name.toLowerCase()
      .includes("bitrix") ?? false;

  // Booking fee lock validation: when ON, amount + date + evidence all required
  const isLockIncomplete =
    form.isDateLocked &&
    (form.bookingFeeAmount <= 0 || !form.bookingFeeDate || !bookingFeeEvidence);

  // Required field check for submit button
  const isIncomplete =
    !category ||
    !form.name.trim() ||
    contactNumbers.length === 0 ||
    !form.eventDate ||
    !form.eventTypeId ||
    !form.sourceOfInformationId ||
    !form.assignedToId ||
    !form.statusId ||
    (isWedding && !form.weddingSession) ||
    (isBitrixSource && !form.bitrixId.trim()) ||
    isLockIncomplete;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function setField<K extends keyof CreateLeadFormState>(key: K, value: CreateLeadFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCategorySelect(cat: BookingCategory) {
    setCategory(cat);
    // Clear category-specific fields when switching
    setForm((prev) => ({
      ...prev,
      eventTypeId: "",
      weddingSession: "",
      packageId: "",
      emailCpp: "",
      emailCpw: "",
      instansi: "",
      miceSession: "",
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

  function handleClose() {
    onOpenChange(false);
  }

  function handleSubmit() {
    if (isIncomplete) return;
    const payload = {
      ...form,
      contactNumbers,
      // TODO(backend): bookingFeeEvidence should be uploaded to storage before
      // calling createLead — wire to uploadBookingFeeEvidence() server action.
      bookingFeeEvidence,
    };
    // TODO(backend): replace console.log with real server action call
    // e.g. await createLead(payload); then invalidate queries & close
    // eslint-disable-next-line no-console
    console.log("[CreateLeadDrawer] submit payload:", payload);
    onSubmit?.(payload);
    // Reset state
    setCategory(null);
    setForm(DEFAULT_FORM);
    setContactNumbers([]);
    setShowDateAlt(false);
    setShowVenueSecondary(false);
    setBookingFeeEvidence(null);
    onOpenChange(false);
  }

  // ── Event type options filtered by category ─────────────────────────────────
  const eventTypeOptions = isWedding
    ? DUMMY_EVENT_TYPES_WEDDING
    : isMice
      ? DUMMY_EVENT_TYPES_MICE
      : [];

  // ── Package disabled until venue is chosen ──────────────────────────────────
  const packageDisabled = !form.venueId;

  // ── Venue secondary options excluding primary choice ───────────────────────
  const venueSecondaryOptions = DUMMY_VENUES.filter((v) => v.id !== form.venueId);

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
                STEP 0 — Pilih Tipe Booking (ALWAYS VISIBLE ON TOP)
            ════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground">
                Tipe Booking <span className="text-destructive">*</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* WEDDINGS card */}
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
                    <span
                      className={cn(
                        "text-sm font-bold tracking-wide",
                        category === "WEDDINGS" ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      WEDDINGS
                    </span>
                    <span className="text-xs text-muted-foreground">Pernikahan</span>
                  </div>
                </button>

                {/* MICE card */}
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
                    <span
                      className={cn(
                        "text-sm font-bold tracking-wide",
                        category === "MICE" ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      MICE
                    </span>
                    <span className="text-xs text-muted-foreground">Corporate Event</span>
                  </div>
                </button>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                FIELDS — hanya tampil setelah kategori dipilih
            ════════════════════════════════════════════════════════ */}
            {category && (
              <>
                {/* ── SECTION: Informasi Client ─────────────────────── */}
                <div className="flex flex-col gap-4">
                  <SectionHeader icon={User} title="Informasi Client" />

                  {/* Nama */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {isWedding ? "Nama Pasangan" : "Nama Client"}
                      <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <Input
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder={
                        isWedding ? "e.g. Budi & Siti" : "e.g. PT Maju Bersama"
                      }
                      className="rounded-xl"
                    />
                  </div>

                  {/* Instansi — MICE only */}
                  {isMice && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">
                        Perusahaan / Instansi
                      </label>
                      <Input
                        value={form.instansi}
                        onChange={(e) => setField("instansi", e.target.value)}
                        placeholder="e.g. PT Maju Bersama (opsional)"
                        className="rounded-xl"
                      />
                    </div>
                  )}

                  {/* Email utama */}
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

                  {/* Email CPP & CPW — Wedding only */}
                  {isWedding && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                          Email CP Pria
                        </label>
                        <Input
                          type="email"
                          value={form.emailCpp}
                          onChange={(e) => setField("emailCpp", e.target.value)}
                          placeholder="pria@email.com"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                          Email CP Wanita
                        </label>
                        <Input
                          type="email"
                          value={form.emailCpw}
                          onChange={(e) => setField("emailCpw", e.target.value)}
                          placeholder="wanita@email.com"
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SECTION: Kontak ───────────────────────────────── */}
                <div className="flex flex-col gap-4">
                  <SectionHeader icon={Phone} title="Kontak (HP / WA)" />

                  <div className="rounded-2xl bg-muted p-4 flex flex-col gap-2">
                    {/* Existing contacts */}
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

                    {/* Add button */}
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

                {/* ── SECTION: Tanggal Event ────────────────────────── */}
                <div className="flex flex-col gap-4">
                  <SectionHeader icon={CalendarDate} title="Tanggal Event" />

                  {/* Tanggal Utama */}
                  <div className="flex flex-col gap-1.5">
                    <DatePickerField
                      label="Tanggal Utama"
                      required
                      value={form.eventDate}
                      onChange={(v) => setField("eventDate", v)}
                      placeholder="Pilih tanggal utama..."
                    />
                    <AvailabilityBadge dateStr={form.eventDate} />
                  </div>

                  {/* Tanggal Alternatif */}
                  {showDateAlt ? (
                    <div className="flex flex-col gap-1.5">
                      <DatePickerField
                        label="Tanggal Alternatif"
                        value={form.eventDateAlt}
                        onChange={(v) => setField("eventDateAlt", v)}
                        placeholder="Pilih tanggal alternatif..."
                      />
                      <AvailabilityBadge dateStr={form.eventDateAlt} />
                      <button
                        type="button"
                        onClick={() => {
                          setShowDateAlt(false);
                          setField("eventDateAlt", "");
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

                </div>

                {/* ── SECTION: Venue ────────────────────────────────── */}
                <div className="flex flex-col gap-4">
                  <SectionHeader icon={MapPoint} title="Venue" />

                  {/* Venue Utama */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Venue Utama</label>
                    <SearchableSelect
                      options={DUMMY_VENUES}
                      value={form.venueId}
                      onChange={(v) => {
                        setField("venueId", v);
                        // Reset package when venue changes
                        setField("packageId", "");
                      }}
                      placeholder="Pilih venue utama..."
                      searchPlaceholder="Cari venue..."
                      emptyText="Venue tidak ditemukan"
                    />
                  </div>

                  {/* Venue Secondary */}
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

                  {/* ── Toggle: Kunci Tanggal & Venue ─────────────────── */}
                  <div className="flex flex-col gap-3 pt-1">
                    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
                      <Switch
                        checked={form.isDateLocked}
                        onCheckedChange={(checked) => {
                          setField("isDateLocked", checked);
                          // Reset booking fee fields when turning off
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

                    {/* Callout saat lock ON */}
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
                      {/* Section header */}
                      <div className="flex items-center gap-2 pb-1 border-b border-border">
                        <Banknote weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Booking Fee
                        </span>
                      </div>

                      {/* Nominal Booking Fee */}
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

                      {/* Tanggal Terima Booking Fee */}
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

                      {/* Bukti Bayar / Evidence upload (frontend-only, no S3) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                          Bukti Bayar / Evidence
                          <span className="text-destructive ml-0.5">*</span>
                        </label>
                        {/* Hidden file input */}
                        <input
                          ref={evidenceInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setBookingFeeEvidence(file);
                            // Reset so same file can be re-selected
                            if (evidenceInputRef.current) evidenceInputRef.current.value = "";
                          }}
                        />
                        {/* Trigger area */}
                        <button
                          type="button"
                          onClick={() => evidenceInputRef.current?.click()}
                          className={cn(
                            "flex items-center gap-2.5 w-full rounded-xl border border-dashed px-3 py-2.5 text-sm transition-colors",
                            bookingFeeEvidence
                              ? "border-border bg-muted/40 text-foreground"
                              : "border-border bg-muted/30 text-muted-foreground hover:border-foreground/30 hover:bg-muted/50",
                          )}
                        >
                          {bookingFeeEvidence ? (
                            <>
                              <FileText weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate text-left text-xs font-medium">
                                {bookingFeeEvidence.name}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBookingFeeEvidence(null);
                                }}
                                className="shrink-0 p-0.5 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                                aria-label="Hapus file"
                              >
                                <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <Gallery weight="BoldDuotone" className="h-4 w-4 shrink-0" />
                              <span className="text-xs">Pilih foto / PDF bukti bayar...</span>
                            </>
                          )}
                        </button>
                        <p className="text-[10px] text-muted-foreground">
                          Format: JPG, PNG, WebP, PDF. Maks 10 MB.
                          {/* TODO(backend): wire evidence upload to storage */}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Package (Wedding only) — disabled sampai venue dipilih */}
                  {isWedding && (
                    <div className="flex flex-col gap-1.5">
                      <label
                        className={cn(
                          "text-sm font-medium",
                          packageDisabled ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        Package Estimasi
                        {packageDisabled && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (pilih venue utama dulu)
                          </span>
                        )}
                      </label>
                      <SearchableSelect
                        options={DUMMY_PACKAGES}
                        value={form.packageId}
                        onChange={(v) => setField("packageId", v)}
                        placeholder={packageDisabled ? "Pilih venue dulu..." : "Pilih package..."}
                        searchPlaceholder="Cari package..."
                        emptyText="Package tidak ditemukan"
                        disabled={packageDisabled}
                      />
                    </div>
                  )}
                </div>

                {/* ── SECTION: Detail Event ─────────────────────────── */}
                <div className="flex flex-col gap-4">
                  <SectionHeader icon={Buildings2} title="Detail Event" />

                  {/* Event Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Event Type <span className="text-destructive">*</span>
                    </label>
                    <SearchableSelect
                      options={eventTypeOptions}
                      value={form.eventTypeId}
                      onChange={(v) => setField("eventTypeId", v)}
                      placeholder={
                        isWedding ? "Pilih jenis acara nikah..." : "Pilih jenis event MICE..."
                      }
                      searchPlaceholder="Cari event type..."
                      emptyText="Tidak ada event type"
                    />
                  </div>

                  {/* Sesi — Wedding: pill radio required; MICE: select optional */}
                  {isWedding && (
                    <SessionPillRadio
                      label="Sesi Acara"
                      required
                      value={form.weddingSession}
                      onChange={(v) => setField("weddingSession", v)}
                    />
                  )}

                  {isMice && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">
                        Sesi Event
                      </label>
                      <SearchableSelect
                        options={SESSION_OPTIONS}
                        value={form.miceSession}
                        onChange={(v) => setField("miceSession", v as WeddingSession)}
                        placeholder="Pilih sesi (opsional)..."
                        searchPlaceholder="Cari sesi..."
                        emptyText="Tidak ada sesi"
                      />
                    </div>
                  )}

                  {/* Estimasi Waktu */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Estimasi Waktu</label>
                    <TimeRangePicker
                      value={form.time}
                      onChange={(v) => setField("time", v)}
                      placeholder="Pilih waktu (bisa rentang)..."
                    />
                  </div>

                  {/* Estimasi Pax */}
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

                  {/* Budget Range */}
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
                </div>

                {/* ── SECTION: Sales & Pipeline ─────────────────────── */}
                <div className="flex flex-col gap-4">
                  <SectionHeader icon={UsersGroupRounded} title="Sales & Pipeline" />

                  {/* Sumber Informasi */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Sumber Informasi <span className="text-destructive">*</span>
                    </label>
                    {/* TODO(backend): useSourceOfInformations() hook + onAdd server action */}
                    <SearchableSelect
                      options={DUMMY_SOURCES}
                      value={form.sourceOfInformationId}
                      onChange={(v) => {
                        setField("sourceOfInformationId", v);
                        // Clear bitrixId if switching away from bitrix source
                        const isBitrix =
                          DUMMY_SOURCES.find((s) => s.id === v)
                            ?.name.toLowerCase()
                            .includes("bitrix") ?? false;
                        if (!isBitrix) setField("bitrixId", "");
                      }}
                      placeholder="Pilih sumber informasi..."
                      searchPlaceholder="Cari sumber..."
                      emptyText="Tidak ada data"
                    />
                  </div>

                  {/* Bitrix ID — conditional: muncul kalau source mengandung "bitrix" */}
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

                  {/* Sales PIC */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Sales PIC <span className="text-destructive">*</span>
                    </label>
                    {/* TODO(backend): useSalesUsers() hook, lock to self if current user is sales */}
                    <SearchableSelect
                      options={DUMMY_SALES}
                      value={form.assignedToId}
                      onChange={(v) => setField("assignedToId", v)}
                      placeholder="Pilih sales PIC..."
                      searchPlaceholder="Cari sales..."
                      emptyText="Sales tidak ditemukan"
                    />
                  </div>

                  {/* Status Pipeline */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Status Pipeline <span className="text-destructive">*</span>
                    </label>
                    {/* TODO(backend): useLeadStatuses() hook with color dots */}
                    <SearchableSelect
                      options={DUMMY_STATUSES.map((s) => ({ id: s.id, name: s.name }))}
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
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 rounded-full"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isIncomplete}
              className="flex-1 rounded-full"
            >
              {/* TODO(backend): show loading state when server action is pending */}
              Simpan Lead
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
