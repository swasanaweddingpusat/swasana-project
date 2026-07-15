"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { editBooking, updateBookingClientInfo } from "@/actions/booking";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toDateOnly } from "@/lib/utils";
import type { BookingListItem } from "@/lib/queries/bookings";
import type { MobileNumberEntry } from "@/lib/validations/customer";
import { validateBookingField, type BookingFieldKey } from "@/lib/validations/booking-form";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface VenueOption { id: string; name: string }
export interface CategoryPriceEntry { id: string; categoryName: string; basePrice: number; sortOrder: number; isShow: boolean }
export interface PackageOption { id: string; packageName: string; pax: number; margin: number; sellingPrice: number; categoryPrices: CategoryPriceEntry[] }

type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };

export const STEP_LABELS: Record<number, string> = {
  1: "Client",
  2: "Venue & Paket",
  3: "Item Paket",
  4: "Takeout",
  5: "TOP",
  6: "TTD",
};
export const LBL = "text-sm font-medium text-foreground";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json() as Promise<T>;
}

// â”€â”€â”€ Return type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface EditBookingForm {
  // query client / user info
  qc: ReturnType<typeof useQueryClient>;
  salesUsers: ReturnType<typeof useSalesUsers>["users"];
  currentUser: ReturnType<typeof useCurrentUser>["user"];

  // step navigation
  currentStep: number;
  setCurrentStep: (s: number) => void;
  /** Legacy alias for backward compat â€” maps to currentStep 3-7 names. */
  continueFlowStep: null | "package-items" | "takeout" | "top" | "signature";
  setContinueFlowStep: (s: null | "package-items" | "takeout" | "top" | "signature") => void;
  /** When true, tab clicks are disabled and continue buttons advance linearly. */
  linearMode: boolean;

  // step 1: client info state
  customerName: string;
  setCustomerName: (v: string) => void;
  contactNumbers: MobileNumberEntry[];
  setContactNumbers: (fn: MobileNumberEntry[] | ((prev: MobileNumberEntry[]) => MobileNumberEntry[])) => void;
  contactInput: { name: string; phone: string };
  setContactInput: (fn: { name: string; phone: string } | ((prev: { name: string; phone: string }) => { name: string; phone: string })) => void;
  contactPopoverOpen: boolean;
  setContactPopoverOpen: (v: boolean) => void;
  contactEmailCpp: string;
  setContactEmailCpp: (v: string) => void;
  contactEmailCpw: string;
  setContactEmailCpw: (v: string) => void;
  contactNikCpp: string;
  setContactNikCpp: (v: string) => void;
  contactNikCpw: string;
  setContactNikCpw: (v: string) => void;
  contactCppAddress: string;
  setContactCppAddress: (v: string) => void;
  contactCpwAddress: string;
  setContactCpwAddress: (v: string) => void;
  contactBitrixId: string;
  setContactBitrixId: (v: string) => void;
  sourceOfInformationId: string;
  setSourceOfInformationId: (v: string) => void;
  salesId: string | null;
  setSalesId: (v: string | null) => void;

  // step 2: venue/event state
  venueId: string;
  setVenueId: (v: string) => void;
  packageId: string;
  setPackageId: (v: string) => void;
  bookingDate: string;
  setBookingDate: (v: string) => void;
  weddingSession: string;
  setWeddingSession: (v: string) => void;
  weddingType: string;
  setWeddingType: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  noteDateEvent: string;
  setNoteDateEvent: (v: string) => void;
  signingLocation: string;
  setSigningLocation: (v: string) => void;
  visibleMonth: Date;
  setVisibleMonth: (v: Date) => void;

  // availability
  availability: Record<string, DayAvail>;

  // submit state
  isSavingClientInfo: boolean;
  isSubmitting: boolean;

  // validation
  errors: Record<string, string>;
  clearError: (field: string) => void;
  validateField: (field: BookingFieldKey, value: string) => void;

  // queries
  venues: VenueOption[];
  packages: PackageOption[];
  packagesError: boolean;
  sources: { id: string; name: string }[];

  // derived
  isSalesPIC: boolean;
  isBitrixSource: boolean;
  hasVenueTabChange: boolean;
  isFrozen: boolean;
  willResetApproval: boolean;
  isStep1Complete: boolean;
  isStep2Complete: boolean;
  lockedSalesName: string;
  sessionLabels: Record<string, string>;
  flowStepNumber: number;
  drawerTitle: string;
  stepHeader: string;
  hideCloseButton: boolean;
  TOTAL_FLOW_STEPS: number;

  // helpers
  getDateStatus: (d: Date) => "available" | "partial" | "unavailable" | "unknown";
  getAvailableSessions: (dateStr: string) => string[];

  // handlers
  handleSaveClientInfo: () => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleGoToStep: (step: number) => void;
  handleCloseAll: () => void;
}

// â”€â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function useEditBookingForm(
  booking: BookingListItem | null,
  open: boolean,
  onOpenChange: (open: boolean) => void,
): EditBookingForm {
  const qc = useQueryClient();
  const { users: salesUsers } = useSalesUsers();
  const { user: currentUser } = useCurrentUser();

  const isSalesPIC =
    !!currentUser?.profileId && !!booking?.salesId && currentUser.profileId === booking.salesId;

  const [currentStep, setCurrentStep] = useState(1);

  // â”€â”€ Linear mode: forced walk-through when venue/package changes. â”€â”€
  // When true the tab header is click-disabled, sub-step save buttons say
  // "Continue" and advance automatically. Cleared on drawer close/open.
  const [linearMode, setLinearMode] = useState(false);

  // â”€â”€ Legacy continueFlowStep: derived view of currentStep for back-compat â”€â”€
  // We still expose this so the render block in edit-booking-drawer can read it.
  // It is purely derived â€” setting it is a no-op alias that sets currentStep.
  const continueFlowStepMap: Record<number, null | "package-items" | "takeout" | "top" | "signature"> = {
    1: null, 2: null, 3: "package-items", 4: "takeout", 5: "top", 6: "signature",
  };
  const continueFlowStep = continueFlowStepMap[currentStep] ?? null;

  function setContinueFlowStep(s: null | "package-items" | "takeout" | "top" | "signature") {
    if (s === null) { setCurrentStep(2); return; }
    if (s === "package-items") { setCurrentStep(3); return; }
    if (s === "takeout") { setCurrentStep(4); return; }
    if (s === "top") { setCurrentStep(5); return; }
    if (s === "signature") { setCurrentStep(6); return; }
  }

  // â”€â”€ Step 1: Client info â”€â”€
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

  // â”€â”€ Step 2: Venue / Package / Event â”€â”€
  const [venueId, setVenueId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [weddingSession, setWeddingSession] = useState("");
  const [weddingType, setWeddingType] = useState("");
  const [time, setTime] = useState("");
  const [noteDateEvent, setNoteDateEvent] = useState("");
  const [signingLocation, setSigningLocation] = useState("");
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  // â”€â”€ Validation errors â”€â”€
  const [errors, setErrors] = useState<Record<string, string>>({});
  function clearError(field: string) {
    setErrors((prev) => { if (!prev[field]) return prev; const n = { ...prev }; delete n[field]; return n; });
  }
  function validateField(field: BookingFieldKey, value: string) {
    const msg = validateBookingField(field, value);
    setErrors((prev) => { const n = { ...prev }; if (msg) n[field] = msg; else delete n[field]; return n; });
  }
  function validateStep1(): boolean {
    const next: Record<string, string> = {};
    const c = validateBookingField("customerName", customerName); if (c) next.customerName = c;
    const ec = validateBookingField("emailCpp", contactEmailCpp); if (ec) next.emailCpp = ec;
    const ew = validateBookingField("emailCpw", contactEmailCpw); if (ew) next.emailCpw = ew;
    const nc = validateBookingField("nikCpp", contactNikCpp); if (nc) next.nikCpp = nc;
    const nw = validateBookingField("nikCpw", contactNikCpw); if (nw) next.nikCpw = nw;
    // Bitrix ID is required when the source of information is Bitrix.
    if (isBitrixSource && !contactBitrixId.trim()) next.bitrixId = "Bitrix ID wajib diisi";
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  function validateStep2(): boolean {
    const next: Record<string, string> = {};
    const v = validateBookingField("venueId", venueId); if (v) next.venueId = v;
    const p = validateBookingField("packageId", packageId); if (p) next.packageId = p;
    const d = validateBookingField("eventDate", bookingDate); if (d) next.eventDate = d;
    const s = validateBookingField("weddingSession", weddingSession); if (s) next.weddingSession = s;
    const t = validateBookingField("weddingType", weddingType); if (t) next.weddingType = t;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // â”€â”€ Change detection â”€â”€
  const [originalVenueId, setOriginalVenueId] = useState("");
  const [originalPackageId, setOriginalPackageId] = useState("");
  const [originalBookingDate, setOriginalBookingDate] = useState("");

  // â”€â”€ Venue availability â”€â”€
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});

  // â”€â”€ Submit state â”€â”€
  const [isSavingClientInfo, setIsSavingClientInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // â”€â”€ Data queries â”€â”€
  const { data: detail } = useQuery({
    queryKey: ["booking-detail", booking?.id],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${booking!.id}`);
      return res.ok ? (res.json() as Promise<Record<string, unknown>>) : null;
    },
    enabled: !!booking?.id && open,
    staleTime: 0,
  });

  const { data: venues = [] } = useQuery<VenueOption[]>({
    queryKey: ["venues"],
    queryFn: () => fetchJson<VenueOption[]>("/api/venues"),
    staleTime: 5 * 60_000,
  });

  const { data: packages = [], isError: packagesError } = useQuery<PackageOption[]>({
    queryKey: ["packages", venueId, "booking"],
    queryFn: () => fetchJson<PackageOption[]>(`/api/packages?venueId=${venueId}&forBooking=true`),
    enabled: !!venueId,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const { data: sources = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchJson<{ id: string; name: string }[]>("/api/source-of-informations"),
    staleTime: 10 * 60_000,
  });

  const isBitrixSource =
    sources.find((o) => o.id === sourceOfInformationId)?.name.toLowerCase().includes("bitrix") ?? false;

  // â”€â”€ Init state on open â”€â”€
  useEffect(() => {
    if (!open || !booking) return;
    setIsSubmitting(false);
    setCurrentStep(1);
    setLinearMode(false);

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

    setVenueId(booking.venueId ?? "");
    setPackageId(booking.packageId ?? "");
    const eventDateStr = booking.eventDate ? toDateOnly(new Date(booking.eventDate)) : "";
    setBookingDate(eventDateStr);
    setWeddingSession(booking.weddingSession ?? "");
    setWeddingType(booking.weddingType ?? "");
    setTime(booking.eventTime ?? "");
    setNoteDateEvent(booking.notes ?? "");
    setSigningLocation(booking.signingLocation ?? "");

    setOriginalVenueId(booking.venueId ?? "");
    setOriginalPackageId(booking.packageId ?? "");
    setOriginalBookingDate(eventDateStr);
  }, [open, booking]);

  // â”€â”€ Init detail fields â”€â”€
  useEffect(() => {
    if (!detail) return;
    const detailName =
      (detail.snapCustomer as Record<string, unknown> | null)?.name as string | undefined
      ?? (detail.customer as Record<string, unknown> | null)?.name as string | undefined
      ?? "";
    if (detailName) setCustomerName(detailName);
    const snapC = detail.snapCustomer as Record<string, unknown> | null;
    const custC = detail.customer as Record<string, unknown> | null;
    const rawContact = (snapC?.mobileNumber ?? custC?.mobileNumber ?? "") as string | MobileNumberEntry[];
    if (typeof rawContact === "string" && rawContact.trim()) {
      const parsed: MobileNumberEntry[] = rawContact.split(",").map((segment: string) => {
        const trimmed = segment.trim();
        const bracketMatch = trimmed.match(/^(.+?)\s*\((.+)\)$/);
        if (bracketMatch) return { name: bracketMatch[1].trim(), number: bracketMatch[2].trim() };
        return { name: "", number: trimmed };
      });
      setContactNumbers(parsed);
    } else if (Array.isArray(rawContact)) {
      setContactNumbers(rawContact as MobileNumberEntry[]);
    }
    setContactEmailCpp((snapC?.emailCpp ?? custC?.emailCpp ?? "") as string);
    setContactEmailCpw((snapC?.emailCpw ?? custC?.emailCpw ?? "") as string);
    setContactNikCpp((snapC?.cppNik ?? custC?.cppNik ?? "") as string);
    setContactNikCpw((snapC?.cpwNik ?? custC?.cpwNik ?? "") as string);
    setContactCppAddress((snapC?.cppAddress ?? custC?.cppAddress ?? "") as string);
    setContactCpwAddress((snapC?.cpwAddress ?? custC?.cpwAddress ?? "") as string);
    setContactBitrixId((custC?.bitrixId ?? "") as string);
    if (detail.salesId && !salesId) setSalesId(detail.salesId as string);
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Venue availability â”€â”€
  useEffect(() => {
    if (!venueId) { setAvailability({}); return; }
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    const bookingId = booking?.id ?? "";
    const params = new URLSearchParams({ month, exclude: bookingId });
    fetch(`/api/venues/${venueId}/availability?${params}`)
      .then((r) => r.json())
      .then((data: Record<string, DayAvail>) => setAvailability(data))
      .catch(() => setAvailability({}));
  }, [venueId, visibleMonth, booking?.id]);

  // â”€â”€ Helpers â”€â”€
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

  // â”€â”€ Derived â”€â”€
  const hasVenueTabChange =
    venueId !== originalVenueId || packageId !== originalPackageId;

  const isFrozen = !!booking?.snapshotFrozenAt;
  const willResetApproval =
    isFrozen &&
    (venueId !== originalVenueId ||
      packageId !== originalPackageId ||
      bookingDate !== originalBookingDate);

  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0 && (!isBitrixSource || contactBitrixId.trim()));
  const isStep2Complete = !!(venueId && packageId && bookingDate && weddingSession && weddingType);

  const sessionLabels: Record<string, string> = { morning: "Pagi", evening: "Malam", fullday: "Fullday" };

  const lockedSalesName =
    salesUsers.find((s) => s.id === salesId)?.fullName ??
    (isSalesPIC ? (currentUser?.name ?? "â€”") : "â€”");

  const TOTAL_FLOW_STEPS = 6;
  const flowStepNumber = currentStep;

  const STEP_TITLES: Record<number, string> = {
    1: "Edit Booking",
    2: "Edit Booking",
    3: "Item Paket",
    4: "Edit Takeout",
    5: "Term of Payment",
    6: "Tanda Tangan Sales",
  };
  const drawerTitle = STEP_TITLES[currentStep] ?? "Edit Booking";
  const stepHeader = `Step ${flowStepNumber} / ${TOTAL_FLOW_STEPS}`;

  // Hide close button in linear mode (user must walk through steps) or when
  // step 2 has venue changes that haven't been saved yet (pre-save state).
  const hideCloseButton = linearMode || (currentStep === 2 && hasVenueTabChange);

  // â”€â”€ Handlers â”€â”€
  async function handleSaveClientInfo(): Promise<void> {
    if (!booking) return;
    if (!validateStep1()) { toast.error("Perbaiki isian yang tidak valid."); return; }
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

  async function handleSubmit(): Promise<void> {
    if (!booking || !isStep2Complete) return;
    if (!validateStep2()) { toast.error("Perbaiki isian yang tidak valid."); return; }
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
        signingLocation: signingLocation || null,
        termOfPayments: [],
        categoryToggles: [],
        signatureSales: null,
      });
      if (!r.success) { toast.error(r.error); return; }
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-detail", booking.id] });
      toast.success("Booking berhasil diupdate");
      if (hasVenueTabChange) {
        // Enter linear mode: force user to walk steps 3â†’4â†’5â†’6.
        setLinearMode(true);
        setCurrentStep(3);
      } else {
        setOriginalVenueId(venueId);
        setOriginalPackageId(packageId);
        setOriginalBookingDate(bookingDate);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoToStep(step: number): void {
    // In linear mode, tab navigation is disabled â€” user must follow Continue buttons.
    if (linearMode) return;
    if (step >= 1 && step <= 6) setCurrentStep(step);
  }

  function handleCloseAll(): void {
    setLinearMode(false);
    setCurrentStep(1);
    onOpenChange(false);
  }

  return {
    qc,
    salesUsers,
    currentUser,
    currentStep,
    setCurrentStep,
    continueFlowStep,
    setContinueFlowStep,
    linearMode,
    customerName,
    setCustomerName,
    contactNumbers,
    setContactNumbers,
    contactInput,
    setContactInput,
    contactPopoverOpen,
    setContactPopoverOpen,
    contactEmailCpp,
    setContactEmailCpp,
    contactEmailCpw,
    setContactEmailCpw,
    contactNikCpp,
    setContactNikCpp,
    contactNikCpw,
    setContactNikCpw,
    contactCppAddress,
    setContactCppAddress,
    contactCpwAddress,
    setContactCpwAddress,
    contactBitrixId,
    setContactBitrixId,
    sourceOfInformationId,
    setSourceOfInformationId,
    salesId,
    setSalesId,
    venueId,
    setVenueId,
    packageId,
    setPackageId,
    bookingDate,
    setBookingDate,
    weddingSession,
    setWeddingSession,
    weddingType,
    setWeddingType,
    time,
    setTime,
    noteDateEvent,
    setNoteDateEvent,
    signingLocation,
    setSigningLocation,
    visibleMonth,
    setVisibleMonth,
    availability,
    isSavingClientInfo,
    isSubmitting,
    errors,
    clearError,
    validateField,
    venues,
    packages,
    packagesError,
    sources,
    isSalesPIC,
    isBitrixSource,
    hasVenueTabChange,
    isFrozen,
    willResetApproval,
    isStep1Complete,
    isStep2Complete,
    lockedSalesName,
    sessionLabels,
    flowStepNumber,
    drawerTitle,
    stepHeader,
    hideCloseButton,
    TOTAL_FLOW_STEPS,
    getDateStatus,
    getAvailableSessions,
    handleSaveClientInfo,
    handleSubmit,
    handleGoToStep,
    handleCloseAll,
  };
}

