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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VenueOption { id: string; name: string }
export interface CategoryPriceEntry { id: string; categoryName: string; basePrice: number; sortOrder: number; isShow: boolean }
export interface PackageOption { id: string; packageName: string; pax: number; margin: number; sellingPrice: number; categoryPrices: CategoryPriceEntry[] }

type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };

export const STEP_LABELS: Record<number, string> = { 1: "Client", 2: "Venue & Paket" };
export const LBL = "text-sm font-medium text-foreground";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json() as Promise<T>;
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface EditBookingForm {
  // query client / user info
  qc: ReturnType<typeof useQueryClient>;
  salesUsers: ReturnType<typeof useSalesUsers>["users"];
  currentUser: ReturnType<typeof useCurrentUser>["user"];

  // step navigation
  currentStep: number;
  setCurrentStep: (s: number) => void;
  continueFlowStep: null | "package-items" | "takeout" | "top" | "signature";
  setContinueFlowStep: (s: null | "package-items" | "takeout" | "top" | "signature") => void;

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
  handlePrevious: () => void;
  handleGoToStep: (step: number) => void;
  handleCloseAll: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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

  // ── Sub-drawers (continue flow) ──
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
  const [signingLocation, setSigningLocation] = useState("");
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  // ── Change detection ──
  const [originalVenueId, setOriginalVenueId] = useState("");
  const [originalPackageId, setOriginalPackageId] = useState("");
  const [originalBookingDate, setOriginalBookingDate] = useState("");

  // ── Venue availability ──
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});

  // ── Submit state ──
  const [isSavingClientInfo, setIsSavingClientInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Data queries ──
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

  // ── Init state on open ──
  useEffect(() => {
    if (!open || !booking) return;
    setIsSubmitting(false);
    setCurrentStep(1);
    setContinueFlowStep(null);

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

  // ── Init detail fields ──
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

  // ── Venue availability ──
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

  // ── Derived ──
  const hasVenueTabChange =
    venueId !== originalVenueId || packageId !== originalPackageId;

  const isFrozen = !!booking?.snapshotFrozenAt;
  const willResetApproval =
    isFrozen &&
    (venueId !== originalVenueId ||
      packageId !== originalPackageId ||
      bookingDate !== originalBookingDate);

  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0);
  const isStep2Complete = !!(venueId && packageId && bookingDate && weddingSession && weddingType);

  const sessionLabels: Record<string, string> = { morning: "Pagi", evening: "Malam", fullday: "Fullday" };

  const lockedSalesName =
    salesUsers.find((s) => s.id === salesId)?.fullName ??
    (isSalesPIC ? (currentUser?.name ?? "—") : "—");

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
            : currentStep;
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

  const hideCloseButton =
    continueFlowStep !== null || (currentStep === 2 && hasVenueTabChange);

  // ── Handlers ──
  async function handleSaveClientInfo(): Promise<void> {
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

  async function handleSubmit(): Promise<void> {
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
        setContinueFlowStep("package-items");
      } else {
        setOriginalVenueId(venueId);
        setOriginalPackageId(packageId);
        setOriginalBookingDate(bookingDate);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrevious(): void {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  function handleGoToStep(step: number): void {
    setCurrentStep(step);
  }

  function handleCloseAll(): void {
    setContinueFlowStep(null);
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
    handlePrevious,
    handleGoToStep,
    handleCloseAll,
  };
}
