"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { Calendar as CalendarIcon, CloseCircle } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { ContactEntry, parseStoredPhone } from "@/components/shared/PhoneInput";
import { cn, toDateOnly, parseDateOnly } from "@/lib/utils";
import { editBooking, updateBookingClientInfo } from "@/actions/booking";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SalesSignatureContent } from "./SalesSignatureDrawer";
import { EditTopContentById } from "./edit-top-drawer";
import { EditTakeoutContent } from "./EditTakeoutDrawer";
import { EditPackageItemsContent } from "./EditPackageItemsDrawer";
import type { BookingListItem } from "@/lib/queries/bookings";
import type { MobileNumberEntry } from "@/lib/validations/customer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  booking: BookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VenueOption { id: string; name: string }
interface CategoryPriceEntry { id: string; categoryName: string; basePrice: number; sortOrder: number; isShow: boolean }
interface PackageOption { id: string; packageName: string; pax: number; margin: number; sellingPrice: number; categoryPrices: CategoryPriceEntry[] }


const STEP_LABELS: Record<number, string> = { 1: "Client", 2: "Venue & Paket" };

const LBL = "text-sm font-medium text-foreground";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
}

// ─── EditBookingDrawer ────────────────────────────────────────────────────────

export function EditBookingDrawer({ booking, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { users: salesUsers } = useSalesUsers();
  const { user: currentUser } = useCurrentUser();

  const isSalesPIC =
    !!currentUser?.profileId && !!booking?.salesId && currentUser.profileId === booking.salesId;

  const [currentStep, setCurrentStep] = useState(1);

  // ── Sub-drawers (continue flow: null → "package-items" → "takeout" → "top" → "signature" → null) ──
  const [continueFlowStep, setContinueFlowStep] = useState<null | "package-items" | "takeout" | "top" | "signature">(null);

  // ── Step 1: Client info ──
  const [customerName, setCustomerName] = useState("");
  const [contactNumbers, setContactNumbers] = useState<MobileNumberEntry[]>([]);
  const [contactInput, setContactInput] = useState({ name: "", phone: "" });
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [contactEmailCpp, setContactEmailCpp] = useState("");
  const [contactEmailCpw, setContactEmailCpw] = useState("");
  const [contactNikCpp, setContactNikCpp] = useState("");
  const [contactNikCpw, setContactNikCpw] = useState("");
  const [contactCppAddress, setContactCppAddress] = useState("");
  const [contactCpwAddress, setContactCpwAddress] = useState("");
  const [contactBitrixId, setContactBitrixId] = useState("");
  const [sourceOfInformationId, setSourceOfInformationId] = useState("");
  const [salesId, setSalesId] = useState<string | null>(null);

  // ── Step 2: Venue / Package / Event ──
  const [venueId, setVenueId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [weddingSession, setWeddingSession] = useState("");
  const [weddingType, setWeddingType] = useState("");
  const [time, setTime] = useState("");
  const [noteDateEvent, setNoteDateEvent] = useState("");
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  // ── Change detection (untuk trigger continue flow setelah save) ──
  const [originalVenueId, setOriginalVenueId] = useState("");
  const [originalPackageId, setOriginalPackageId] = useState("");
  const [originalBookingDate, setOriginalBookingDate] = useState("");
  const [originalWeddingSession, setOriginalWeddingSession] = useState("");
  const [originalWeddingType, setOriginalWeddingType] = useState("");
  const [originalTime, setOriginalTime] = useState("");
  const [originalNoteDateEvent, setOriginalNoteDateEvent] = useState("");

  // ── Venue availability ──
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});

  // ── Submit state ──
  const [isSavingClientInfo, setIsSavingClientInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Data queries ──
  const { data: detail } = useQuery({
    queryKey: ["bookings", booking?.id],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${booking!.id}`);
      return res.ok ? res.json() : null;
    },
    enabled: !!booking?.id && open,
    staleTime: 2 * 60_000,
  });

  const { data: venues = [] } = useQuery<VenueOption[]>({
    queryKey: ["venues"],
    queryFn: () => fetchJson("/api/venues"),
    staleTime: 5 * 60_000,
  });

  const { data: packages = [], isError: packagesError } = useQuery<PackageOption[]>({
    queryKey: ["packages", venueId, "booking"],
    queryFn: () => fetchJson(`/api/packages?venueId=${venueId}&forBooking=true`),
    enabled: !!venueId,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const { data: sources = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchJson("/api/source-of-informations"),
    staleTime: 10 * 60_000,
  });

  const isBitrixSource =
    sources.find((o) => o.id === sourceOfInformationId)?.name.toLowerCase().includes("bitrix") ?? false;

  // ── Init state on open ──
  useEffect(() => {
    if (!open || !booking) return;
    setIsSubmitting(false);
    setCurrentStep(1);
    setContinueFlowStep(null);

    // Step 1: client fields
    setCustomerName(booking.snapCustomer?.name ?? "");
    const raw = booking.snapCustomer?.mobileNumber ?? "";
    if (typeof raw === "string" && raw.trim()) {
      const parsed: MobileNumberEntry[] = raw.split(",").map((segment) => {
        const trimmed = segment.trim();
        const bracketMatch = trimmed.match(/^(.+?)\s*\((.+)\)$/);
        if (bracketMatch) return { name: bracketMatch[1].trim(), number: bracketMatch[2].trim() };
        return { name: "", number: trimmed };
      });
      setContactNumbers(parsed);
    } else if (Array.isArray(raw)) {
      setContactNumbers(raw as MobileNumberEntry[]);
    } else {
      setContactNumbers([]);
    }

    setSalesId(booking.salesId ?? null);
    setSourceOfInformationId(booking.sourceOfInformationId ?? "");

    // Step 2: venue / event fields
    setVenueId(booking.venueId ?? "");
    setPackageId(booking.packageId ?? "");
    const eventDateStr = booking.eventDate ? toDateOnly(new Date(booking.eventDate)) : "";
    setBookingDate(eventDateStr);
    setWeddingSession(booking.weddingSession ?? "");
    setWeddingType(booking.weddingType ?? "");
    setTime(booking.eventTime ?? "");
    setNoteDateEvent(booking.notes ?? "");

    // Snapshot originals for change detection
    setOriginalVenueId(booking.venueId ?? "");
    setOriginalPackageId(booking.packageId ?? "");
    setOriginalBookingDate(eventDateStr);
    setOriginalWeddingSession(booking.weddingSession ?? "");
    setOriginalWeddingType(booking.weddingType ?? "");
    setOriginalTime(booking.eventTime ?? "");
    setOriginalNoteDateEvent(booking.notes ?? "");
  }, [open, booking]);

  // ── Init detail fields (email, NIK, address, bitrix) ──
  useEffect(() => {
    if (!detail) return;
    setContactEmailCpp(detail.snapCustomer?.emailCpp ?? detail.customer?.emailCpp ?? "");
    setContactEmailCpw(detail.snapCustomer?.emailCpw ?? detail.customer?.emailCpw ?? "");
    setContactNikCpp(detail.snapCustomer?.cppNik ?? detail.customer?.cppNik ?? "");
    setContactNikCpw(detail.snapCustomer?.cpwNik ?? detail.customer?.cpwNik ?? "");
    setContactCppAddress(detail.snapCustomer?.cppAddress ?? detail.customer?.cppAddress ?? "");
    setContactCpwAddress(detail.snapCustomer?.cpwAddress ?? detail.customer?.cpwAddress ?? "");
    setContactBitrixId(detail.customer?.bitrixId ?? "");
    if (detail.salesId && !salesId) setSalesId(detail.salesId as string);
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Venue availability ──
  useEffect(() => {
    if (!venueId) { setAvailability({}); return; }
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    const bookingId = booking?.id ?? "";
    const params = new URLSearchParams({ month, exclude: bookingId });
    fetch(`/api/venues/${venueId}/availability?${params}`)
      .then((r) => r.json())
      .then(setAvailability)
      .catch(() => setAvailability({}));
  }, [venueId, visibleMonth, booking?.id]);

  // ── Helpers ──
  function getDateStatus(d: Date): "available" | "partial" | "unavailable" | "unknown" {
    const key = toDateOnly(d);
    const a = availability[key];
    if (!a) return "unknown";
    if (!a.morning && !a.evening && !a.fullday) return "unavailable";
    if (a.morning && a.evening && a.fullday) return "available";
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

  // ── Change detection (step 2 fields) ──
  const hasVenueTabChange =
    venueId !== originalVenueId ||
    packageId !== originalPackageId ||
    bookingDate !== originalBookingDate ||
    weddingSession !== originalWeddingSession ||
    weddingType !== originalWeddingType ||
    time !== originalTime ||
    noteDateEvent !== originalNoteDateEvent;

  // ── Completeness ──
  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0);
  const isStep2Complete = !!(venueId && packageId && bookingDate && weddingSession && weddingType);

  // ── Save Step 1 ──
  async function handleSaveClientInfo() {
    if (!booking) return;
    if (!isStep1Complete) { toast.error("Lengkapi field yang wajib diisi."); return; }
    setIsSavingClientInfo(true);
    try {
      const r = await updateBookingClientInfo({
        id: booking.id,
        customerName,
        contactNumbers: JSON.stringify(contactNumbers),
        contactEmailCpp,
        contactEmailCpw,
        contactNikCpp,
        contactNikCpw,
        contactCppAddress,
        contactCpwAddress,
        contactBitrixId: isBitrixSource ? contactBitrixId : "",
        salesId: salesId || null,
        sourceOfInformationId: sourceOfInformationId || null,
      });
      if (!r.success) { toast.error(r.error); return; }
      qc.invalidateQueries({ queryKey: ["bookings"] });
      if (booking) qc.invalidateQueries({ queryKey: ["booking-detail", booking.id] });
      toast.success("Informasi client berhasil disimpan");
    } finally {
      setIsSavingClientInfo(false);
    }
  }

  // ── Submit Step 2 ── kalau ada perubahan venue/paket → chain continue flow takeout→top
  async function handleSubmit() {
    if (!booking || !isStep2Complete) return;
    setIsSubmitting(true);
    try {
      const r = await editBooking({
        id: booking.id,
        customerName,
        contactNumbers: JSON.stringify(contactNumbers),
        contactEmailCpp,
        contactEmailCpw,
        contactNikCpp,
        contactNikCpw,
        contactCppAddress,
        contactCpwAddress,
        contactBitrixId: isBitrixSource ? contactBitrixId : "",
        salesId: salesId || null,
        sourceOfInformationId: sourceOfInformationId || null,
        venueId,
        packageId,
        eventDate: bookingDate,
        weddingSession: weddingSession as "morning" | "evening" | "fullday",
        weddingType,
        eventTime: time || null,
        notes: noteDateEvent || null,
        signingLocation: null,
        // Pass empty arrays — server skips TOP/takeout when empty (booking.ts line 1138 & 1583)
        termOfPayments: [],
        categoryToggles: [],
        // Discount (specialBonusName/Amount) is intentionally OMITTED — it's owned by
        // the TOP drawer (updateTermOfPayments). Sending null here would wipe the
        // existing discount to 0 and spuriously trigger a re-approval revision.
        signatureSales: null,
      });
      if (!r.success) { toast.error(r.error); return; }
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-detail", booking.id] });
      toast.success("Booking berhasil diupdate");
      if (hasVenueTabChange) {
        setContinueFlowStep("package-items");
      } else {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrevious() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  function handleGoToStep(step: number) {
    setCurrentStep(step);
  }


  const sessionLabels: Record<string, string> = { morning: "Pagi", evening: "Malam", fullday: "Fullday" };

  const lockedSalesName =
    salesUsers.find((s) => s.id === salesId)?.fullName ??
    (isSalesPIC ? (currentUser?.name ?? "—") : "—");

  // ── Single-drawer header: title + step indicator are CONTINUOUS across the whole
  // Edit → Item Paket → Takeout → TOP → Signature sequence (1..6), since it all lives in ONE Sheet.
  // Step 1 Client, 2 Venue & Paket, 3 Item Paket, 4 Takeout, 5 TOP, 6 Tanda Tangan.
  const TOTAL_FLOW_STEPS = 6;
  const flowStepNumber =
    continueFlowStep === "package-items"
      ? 3
      : continueFlowStep === "takeout"
        ? 4
        : continueFlowStep === "top"
          ? 5
          : continueFlowStep === "signature"
            ? 6
            : currentStep; // null → still in the Edit Booking body (step 1 or 2)
  const drawerTitle =
    continueFlowStep === null
      ? "Edit Booking"
      : continueFlowStep === "package-items"
        ? "Item Paket"
        : continueFlowStep === "takeout"
          ? "Edit Takeout"
          : continueFlowStep === "top"
            ? "Term of Payment"
            : "Tanda Tangan Sales";
  const stepHeader = `Step ${flowStepNumber} / ${TOTAL_FLOW_STEPS}`;

  function handleCloseAll() {
    setContinueFlowStep(null);
    onOpenChange(false);
  }

  return (
    <Drawer
      isOpen={open}
      onClose={handleCloseAll}
      title={drawerTitle}
      maxWidth="sm:max-w-xl"
      headerActions={<span className="text-sm text-muted-foreground">{stepHeader}</span>}
    >
      {continueFlowStep === null && (
        <div className={cn("flex", "flex-col", "justify-between", "h-full")}>

          {/* ─── Tab Navigator ─── */}
          <div className="mb-3 shrink-0 overflow-x-auto border-b scrollbar-none">
            <div className="flex w-max min-w-full gap-1">
              {([1, 2] as number[]).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleGoToStep(step)}
                  className={cn(
                    "relative shrink-0 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors",
                    "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:transition-colors",
                    currentStep === step
                      ? "text-foreground after:bg-primary"
                      : "text-muted-foreground after:bg-transparent hover:text-foreground",
                  )}
                >
                  {STEP_LABELS[step]}
                </button>
              ))}
            </div>
          </div>

          <div className={cn("flex-1", "overflow-y-auto", "px-2")}>
            {/* ─── Step 1: Informasi Client ─── */}
            {currentStep === 1 && (
              <div className="space-y-3">
                <div>
                  <label className={LBL}>Customer Name <span className="text-destructive">*</span></label>
                  <Input className="mt-1" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
                </div>

                {/* Contact Person */}
                <div>
                  <label className={LBL}>Contact Person <span className="text-destructive">*</span></label>
                  <div className="mt-1 rounded-lg bg-muted p-3 space-y-2">
                    {contactNumbers.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md bg-background border px-3 py-2">
                        <div className="flex-1 min-w-0">
                          {entry.name && <p className="text-xs text-muted-foreground">{entry.name}</p>}
                          <p className="text-sm font-medium">+{entry.number}</p>
                        </div>
                        <button type="button" className="shrink-0 text-destructive hover:bg-destructive/10 rounded-full p-1" onClick={() => setContactNumbers((p) => p.filter((_, j) => j !== i))}>
                          <CloseCircle weight="BoldDuotone" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <Popover open={contactPopoverOpen} onOpenChange={(o) => { setContactPopoverOpen(o); if (!o) setContactInput({ name: "", phone: "" }); }}>
                      <PopoverTrigger render={
                        <Button type="button" variant="outline" className="shrink-0 bg-background w-full text-xs h-8">
                          Tambah Nomor
                        </Button>
                      } />
                      <PopoverContent className="w-72 p-3" align="end">
                        <p className="text-xs font-medium mb-2">Tambah Nomor</p>
                        <ContactEntry
                          nameValue={contactInput.name}
                          onNameChange={(v) => setContactInput((p) => ({ ...p, name: v }))}
                          phoneValue={contactInput.phone}
                          onPhoneChange={(v) => setContactInput((p) => ({ ...p, phone: v }))}
                          onAdd={() => {
                            const stored = contactInput.phone.trim();
                            const label = contactInput.name.trim();
                            const { nationalNumber } = parseStoredPhone(stored);
                            if (!label) { toast.error("Label wajib diisi"); return; }
                            if (nationalNumber.length < 7) return;
                            if (contactNumbers.some((c) => c.number === stored)) { toast.error("Nomor sudah ada"); return; }
                            setContactNumbers((prev) => [...prev, { name: label, number: stored }]);
                            setContactInput({ name: "", phone: "" });
                            setContactPopoverOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Sales PIC */}
                {isSalesPIC ? (
                  <div>
                    <label className={LBL}>Sales PIC</label>
                    <div className="mt-1 flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
                      {lockedSalesName}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={LBL}>Sales PIC</label>
                    <SearchableSelect
                      options={salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? "" }))}
                      value={salesId ?? ""}
                      onChange={(id) => setSalesId(id || null)}
                      placeholder="Pilih sales..."
                      searchPlaceholder="Cari sales..."
                      emptyText="Sales tidak ditemukan"
                    />
                  </div>
                )}

                <div>
                  <label className={LBL}>Sumber Informasi</label>
                  <SearchableSelect
                    options={sources}
                    value={sourceOfInformationId}
                    onChange={(id) => {
                      setSourceOfInformationId(id);
                      const isBitrix = sources.find((o) => o.id === id)?.name.toLowerCase().includes("bitrix") ?? false;
                      if (!isBitrix) setContactBitrixId("");
                    }}
                    placeholder="Pilih sumber informasi"
                    searchPlaceholder="Cari sumber..."
                    emptyText="Tidak ada data"
                  />
                </div>

                <div>
                  <label className={LBL}>
                    Bitrix ID {isBitrixSource && <span className="text-destructive">*</span>}
                  </label>
                  <Input className="mt-1" value={contactBitrixId} onChange={(e) => setContactBitrixId(e.target.value)} placeholder="Bitrix ID" />
                </div>

                <div>
                  <label className={LBL}>Email CPP</label>
                  <Input className="mt-1" value={contactEmailCpp} onChange={(e) => setContactEmailCpp(e.target.value)} placeholder="Email CPP" />
                </div>
                <div>
                  <label className={LBL}>Email CPW</label>
                  <Input className="mt-1" value={contactEmailCpw} onChange={(e) => setContactEmailCpw(e.target.value)} placeholder="Email CPW" />
                </div>
                <div>
                  <label className={LBL}>NIK CPP</label>
                  <Input className="mt-1" value={contactNikCpp} onChange={(e) => setContactNikCpp(e.target.value.replace(/\D/g, "").slice(0, 16))} inputMode="numeric" maxLength={16} placeholder="NIK CPP" />
                </div>
                <div>
                  <label className={LBL}>NIK CPW</label>
                  <Input className="mt-1" value={contactNikCpw} onChange={(e) => setContactNikCpw(e.target.value.replace(/\D/g, "").slice(0, 16))} inputMode="numeric" maxLength={16} placeholder="NIK CPW" />
                </div>
                <div>
                  <label className={LBL}>Alamat CPP</label>
                  <Textarea className="mt-1" rows={3} value={contactCppAddress} onChange={(e) => setContactCppAddress(e.target.value)} placeholder="Alamat CPP" />
                </div>
                <div>
                  <label className={LBL}>Alamat CPW</label>
                  <Textarea className="mt-1" rows={3} value={contactCpwAddress} onChange={(e) => setContactCpwAddress(e.target.value)} placeholder="Alamat CPW" />
                </div>
              </div>
            )}

            {/* ─── Step 2: Venue / Package / Event Date / Session / Time / Note ─── */}
            {currentStep === 2 && (
              <div className="space-y-3">
                {/* Venue */}
                <div>
                  <label className={LBL}>Venue <span className="text-destructive">*</span></label>
                  <SearchableSelect
                    options={venues}
                    value={venueId}
                    onChange={(id) => {
                      setVenueId(id);
                      setPackageId("");
                    }}
                    placeholder="Pilih venue..."
                    searchPlaceholder="Cari venue..."
                    emptyText="Tidak ada venue"
                  />
                </div>

                {/* Package */}
                <div>
                  <label className={LBL}>Pilih Paket <span className="text-destructive">*</span></label>
                  <SearchableSelect
                    options={packages.map((p) => ({ id: p.id, name: `${p.packageName} · ${p.pax} PAX` }))}
                    value={packageId}
                    onChange={(id) => setPackageId(id)}
                    placeholder={venueId ? "Pilih paket..." : "Pilih venue dulu"}
                    disabled={!venueId}
                    searchPlaceholder="Cari paket..."
                    emptyText="Tidak ada paket"
                  />
                  {packagesError && <p className="text-xs text-destructive mt-1">Gagal memuat paket. Coba pilih venue ulang.</p>}
                </div>

                {/* Event Type */}
                <div>
                  <label className={LBL}>Event Type <span className="text-destructive">*</span></label>
                  <Select value={weddingType} onValueChange={setWeddingType}>
                    <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="R">Resepsi</SelectItem>
                      <SelectItem value="AR">Akad &amp; Resepsi</SelectItem>
                      <SelectItem value="TR">Teapai &amp; Resepsi</SelectItem>
                      <SelectItem value="PR">Pemberkatan Resepsi</SelectItem>
                      <SelectItem value="VO">Venue Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Date */}
                <div>
                  <label className={LBL}>Event Date <span className="text-destructive">*</span></label>
                  <Popover>
                    <PopoverTrigger render={
                      <Button variant="outline" disabled={!venueId} className={cn("w-full mt-1 justify-start text-left font-normal", !bookingDate && "text-muted-foreground")}>
                        <CalendarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                        {bookingDate ? format(parseDateOnly(bookingDate), "PPP") : "Pilih tanggal event"}
                      </Button>
                    } />
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        selected={bookingDate ? parseDateOnly(bookingDate) : undefined}
                        onSelect={(date) => { setBookingDate(date ? toDateOnly(date) : ""); setWeddingSession(""); }}
                        fromYear={new Date().getFullYear() - 10}
                        toYear={new Date().getFullYear() + 10}
                        defaultMonth={bookingDate ? parseDateOnly(bookingDate) : new Date()}
                        onMonthChange={setVisibleMonth}
                        disabled={(d) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const isExistingDate = bookingDate && toDateOnly(d) === bookingDate;
                          if (isExistingDate) return false;
                          return d < today || (!!venueId && getDateStatus(d) === "unavailable");
                        }}
                        modifiers={{
                          available: (d) => !!venueId && getDateStatus(d) === "available",
                          partial: (d) => !!venueId && getDateStatus(d) === "partial",
                          unavailable: (d) => !!venueId && getDateStatus(d) === "unavailable",
                        }}
                        modifiersClassNames={{ available: "day-available", partial: "day-partial", unavailable: "day-unavailable" }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Event Session */}
                <div>
                  <label className={LBL}>Event Session <span className="text-destructive">*</span></label>
                  <Select value={weddingSession} onValueChange={setWeddingSession}>
                    <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih session" /></SelectTrigger>
                    <SelectContent>
                      {(bookingDate ? getAvailableSessions(bookingDate) : ["morning", "evening", "fullday"]).map((s) => (
                        <SelectItem key={s} value={s}>{sessionLabels[s] ?? s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Time */}
                <div>
                  <label className={LBL}>Time (Jam Acara)</label>
                  <div className="mt-1">
                    <TimeRangePicker
                      value={time}
                      onChange={setTime}
                      placeholder="Pilih waktu (bisa rentang)..."
                    />
                  </div>
                </div>

                {/* Note Date Event */}
                <div>
                  <label className={LBL}>Note Date Event</label>
                  <Textarea
                    placeholder="Add note for date event"
                    value={noteDateEvent}
                    onChange={(e) => setNoteDateEvent(e.target.value)}
                    rows={3}
                    className="mt-1"
                  />
                </div>

              </div>
            )}
          </div>

          {/* ─── Footer ─── */}
          <div className="bg-background sticky bottom-0 z-10">
            <div className="flex py-4 gap-2">
              {currentStep === 1 ? (
                <Button
                  onClick={handleSaveClientInfo}
                  disabled={isSavingClientInfo || !isStep1Complete}
                  className={cn("w-full cursor-pointer", (isSavingClientInfo || !isStep1Complete) && "opacity-50 cursor-not-allowed")}
                >
                  {isSavingClientInfo ? "Menyimpan..." : "Save & Publish"}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={isSubmitting}
                    className="flex-[40%] cursor-pointer"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!isStep2Complete || isSubmitting}
                    className={cn(
                      "flex-[60%] cursor-pointer",
                      (!isStep2Complete || isSubmitting) && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {isSubmitting ? "Menyimpan..." : hasVenueTabChange ? "Continue" : "Save"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Continue flow embedded in the SAME drawer: item paket → takeout → top → signature ───
       * Only the body swaps; the Sheet stays mounted so there is no close/reopen
       * flash between steps. Each step fetches its own data when it becomes active. */}
      {booking && continueFlowStep === "package-items" && (
        <EditPackageItemsContent
          active
          bookingId={booking.id}
          onClose={() => setContinueFlowStep("takeout")}
          onPrevious={() => setContinueFlowStep(null)}
        />
      )}
      {booking && continueFlowStep === "takeout" && (
        <EditTakeoutContent
          active
          bookingId={booking.id}
          onClose={() => setContinueFlowStep("top")}
          onPrevious={() => setContinueFlowStep("package-items")}
        />
      )}
      {booking && continueFlowStep === "top" && (
        <EditTopContentById
          active
          bookingId={booking.id}
          onSaved={() => setContinueFlowStep("signature")}
          onPrevious={() => setContinueFlowStep("takeout")}
          saveLabel="Continue"
        />
      )}
      {booking && continueFlowStep === "signature" && (
        <SalesSignatureContent
          bookingId={booking.id}
          onDone={handleCloseAll}
          onPrevious={() => setContinueFlowStep("top")}
        />
      )}
    </Drawer>
  );
}
