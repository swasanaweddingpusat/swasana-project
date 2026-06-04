"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { Calendar as CalendarIcon, FileText, TrashBinTrash, CloseCircle, AddCircle, AltArrowDown } from "@solar-icons/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { cn, formatRupiah } from "@/lib/utils";
import {
  idbClearAllEvidence,
} from "@/lib/idbDraftStore";
import { useCreateBooking } from "@/hooks/use-bookings";
import {
  useUnfinishedDraft,
  useCreateDraftBooking,
  useUpdateDraftStep2,
  useUpdateDraftStep3,
  useUpdateDraftStep4,
  useFinalizeDraftBooking,
} from "@/hooks/use-booking-draft";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { BookingInput } from "@/lib/validations/booking";
import type { MobileNumberEntry } from "@/lib/validations/customer";
import type { BookingPrefillLead } from "@/types/lead";
import {
  getWeddingTimeRange,
  type WeddingSession,
  type WeddingEventType,
} from "@/lib/constants/wedding-session-times";

/** Map weddingType (R/AR/TR/PR/VO) ke WeddingEventType untuk auto-fill time.
 *  TR, PR, VO tidak punya padanan standar → return "" (user isi manual). */
function mapWeddingTypeToEventType(weddingType: string | null): WeddingEventType | "" {
  if (weddingType === "R") return "resepsi";
  if (weddingType === "AR") return "akad-dan-resepsi";
  return "";
}

interface BookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** When provided, the drawer opens pre-filled from this lead (skips draft). */
  prefillLead?: BookingPrefillLead | null;
  /**
   * When provided (Deal flow), the drawer resumes this existing draft instead of
   * creating a new one on Step 1 "Continue". Skips the resume prompt entirely.
   */
  initialDraftId?: string | null;
}

type Option = { id: string; name: string };
interface CustomerOption { id: string; name: string; mobileNumber: string; email: string; cppNik: string | null; cpwNik: string | null; cppAddress: string | null; cpwAddress: string | null; sourceOfInformationId: string | null; bitrixId: string | null }
interface LeadOption { id: string; name: string; email: string | null; contactNumbers: Array<{ label?: string; name?: string; number: string }>; address: string | null; sourceOfInformation: { id: string; name: string } | null; bitrixId: string | null; convertedToCustomerId: string | null; assignedTo: { id: string; fullName: string | null } | null }
interface CategoryPriceEntry {
  id: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
}
interface PackageData {
  id: string;
  packageName: string;
  pax: number;
  margin: number;
  sellingPrice: number;
  categoryPrices: CategoryPriceEntry[];
}
interface VendorCategoryData { id: string; name: string; vendors: { id: string; name: string; categoryId: string }[] }
interface BonusRow { vendorId: string; vendorCategoryId: string; vendorName: string; description: string; qty: number; nominal: number }
interface TermRow { name: string; amount: number; dueDate: string; sortOrder: number; paymentStatus: "unpaid" | "paid" | "partial"; paymentEvidence?: File | null }

const PAYMENT_STATUS = ["unpaid", "paid", "partial"] as const;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  // Throw on error so React Query treats it as a real error (retried, NOT cached
  // as an empty "success"). Returning [] here poisons the shared queryKey cache.
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function FilePreview({ file, onOpen }: { file: File; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  // Create the object URL inside the effect (not during render) so the create
  // and revoke stay balanced — React StrictMode double-invokes effects, and a
  // render-phase URL would get revoked without being recreated, blanking the
  // preview.
  /* eslint-disable react-hooks/set-state-in-effect -- syncing object-URL preview from the file prop */
  useEffect(() => {
    if (!file.type.startsWith("image/")) { setUrl(null); return; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="relative z-10 h-10 w-10 object-cover rounded border shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpen(); }} />;
}

function getPackagePrice(p: PackageData) {
  if (p.sellingPrice > 0) return p.sellingPrice;
  const base = (p.categoryPrices ?? []).reduce((s, c) => s + Number(c.basePrice), 0);
  return base + Math.round(base * ((p.margin ?? 0) / 100));
}


function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

// Fixed defaults: Booking Fee Rp5jt, DP Rp10jt. The rest of the package price
// (after these two) is split evenly across the remaining terms up to Final.
const BOOKING_FEE_DEFAULT = 5_000_000;
const DP_DEFAULT = 10_000_000;

function makeDefaultTerms(): TermRow[] {
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

/**
 * Recalculates due dates for terms that have an empty dueDate.
 * Terms that already have a dueDate (manually set by user) are left untouched.
 * Pass `force = true` to overwrite all dates (e.g. explicit "reset dates" action).
 */
function recalcTermDates(terms: TermRow[], eventDate: string, force = false): TermRow[] {
  if (!eventDate || terms.length === 0) return terms;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const totalMs = event.getTime() - now.getTime();
  if (totalMs <= 0) return terms;
  const n = terms.length;
  return terms.map((t, i) => {
    // Skip terms that already have a date set by the user, unless forced.
    if (!force && t.dueDate) return t;
    return {
      ...t,
      dueDate: toLocalISO(new Date(now.getTime() + Math.round((totalMs * i) / (n - 1 || 1)))),
    };
  });
}

function clearLocalDraftArtifacts() {
  // Clean up any residual localStorage draft keys from the old system
  try { localStorage.removeItem("booking_draft"); } catch { /* noop */ }
  // Fire-and-forget — IndexedDB cleanup is async but non-critical.
  void idbClearAllEvidence();
}

/** Map a lead's wedding eventType.name back to the drawer's weddingType code. */
function mapEventTypeNameToWeddingType(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("akad") && n.includes("resepsi")) return "AR";
  if (n.includes("teapai")) return "TR";
  if (n.includes("pemberkatan")) return "PR";
  if (n.includes("venue only") || n === "vo") return "VO";
  if (n.includes("resepsi")) return "R";
  return null;
}

export function BookingDrawer({ open, onOpenChange, onSuccess, prefillLead, initialDraftId }: BookingDrawerProps) {
  // Keep legacy createBooking for backwards compat (used as final fallback if draft flow fails)
  const createMut = useCreateBooking();
  const createDraftMut = useCreateDraftBooking();
  const updateStep2Mut = useUpdateDraftStep2();
  const updateStep3Mut = useUpdateDraftStep3();
  const updateStep4Mut = useUpdateDraftStep4();
  const finalizeMut = useFinalizeDraftBooking();
  const qc = useQueryClient();

  // DB draft ID — set after Step 1 "Continue" (or injected via initialDraftId from Deal flow)
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  // Guard against double-click creating two drafts before the first mutateAsync resolves.
  const isCreatingDraftRef = useRef(false);
  const { users: salesUsers } = useSalesUsers();
  const { user } = useCurrentUser();

  // Sales auto-detect: salesUsers already contains both "sales" & "sales-mice"
  // roles, and s.id === profileId. If the logged-in user is in that list, lock
  // the sales field to themselves; admin/manager picks freely.
  const currentUserIsSales = !!user && salesUsers.some((s) => s.id === user.profileId);

  // Check for unfinished DB draft on open (only when not coming from prefillLead)
  const { data: unfinishedDraft } = useUnfinishedDraft(
    open && !prefillLead ? (user?.profileId ?? null) : null,
    "WEDDINGS",
  );

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const sigSalesRef = useRef<SignatureCanvas>(null);
  const [signatureSales, setSignatureSales] = useState("");
  const [signingLocation, setSigningLocation] = useState("");
  const [specialBonusName, setSpecialBonusName] = useState("Discount");
  const [specialBonusAmount, setSpecialBonusAmount] = useState(0);
  const [contactNumbers, setContactNumbers] = useState<MobileNumberEntry[]>([]);
  const [contactInput, setContactInput] = useState({ name: "", number: "" });
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactNikCpp, setContactNikCpp] = useState("");
  const [contactNikCpw, setContactNikCpw] = useState("");
  const [contactCppAddress, setContactCppAddress] = useState("");
  const [contactCpwAddress, setContactCpwAddress] = useState("");
  const [contactBitrixId, setContactBitrixId] = useState("");
  const [noteDateEvent, setNoteDateEvent] = useState("");
  const [time, setTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(customerSearch), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: customersResult } = useQuery({
    queryKey: ["customers", debouncedSearch],
    queryFn: () => fetchJson<{ data: CustomerOption[] }>(`/api/customers?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30_000,
  });
  const customers = customersResult?.data ?? [];

  const { data: leadsResult } = useQuery({
    queryKey: ["leads-search", debouncedSearch],
    queryFn: () => fetchJson<{ items: LeadOption[] }>(`/api/leads?search=${encodeURIComponent(debouncedSearch)}&pageSize=5`),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30_000,
  });
  const leadOptions = leadsResult?.items ?? [];
  const { data: venues = [] } = useQuery({ queryKey: ["venues"], queryFn: () => fetchJson<Option[]>("/api/venues"), staleTime: 5 * 60_000 });
  const { data: sourceOptions = [] } = useQuery({ queryKey: ["source-of-informations"], queryFn: () => fetchJson<Option[]>("/api/source-of-informations"), staleTime: 5 * 60_000 });
  const { data: vendorCategories = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchJson<VendorCategoryData[]>("/api/vendors"), staleTime: 5 * 60_000 });

  const [selectedVenueId, setSelectedVenueId] = useState("");
  const { data: packages = [], isLoading: packagesLoading, isError: packagesError } = useQuery({ queryKey: ["packages", selectedVenueId, "booking"], queryFn: () => fetchJson<PackageData[]>(`/api/packages?venueId=${selectedVenueId}&forBooking=true`), enabled: !!selectedVenueId, staleTime: 5 * 60_000, retry: 1 });

  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedPackagePrice, setSelectedPackagePrice] = useState(0);
  // originalPackagePrice tracks the full selling price of the selected package
  // before any takeout deductions. Used as the sticky base for step2 takeout calc
  // so toggling takeout categories on/off always subtracts from the true original,
  // not from a previously-reduced selectedPackagePrice.
  const [originalPackagePrice, setOriginalPackagePrice] = useState(0);
  // Tracks the price used in the most recent allocatePrice call so we can skip
  // re-allocation when the user visits step 2 again without changing anything.
  // This preserves manual amount edits made in step 3.
  const [lastAllocatedPrice, setLastAllocatedPrice] = useState(0);
  const [categoryToggles, setCategoryToggles] = useState<Record<string, boolean>>({}); // categoryName -> isTakeout
  const [takeoutPrices, setTakeoutPrices] = useState<Record<string, number>>({}); // categoryName -> editable takeout nominal

  // Venue availability
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [availLoading, setAvailLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!selectedVenueId) { setAvailability({}); return; }
    setAvailLoading(true);
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    // Availability is per-venue — do NOT pass packageId.
    // Any active booking at this venue blocks the slot regardless of package.
    const params = new URLSearchParams({ month });
    fetch(`/api/venues/${selectedVenueId}/availability?${params}`)
      .then((r) => r.json())
      .then((data: Record<string, DayAvail>) => setAvailability(data))
      .catch(() => setAvailability({}))
      .finally(() => setAvailLoading(false));
  }, [selectedVenueId, visibleMonth]);

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

  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const [bonusPickerOpen, setBonusPickerOpen] = useState(false);
  const allVendors = vendorCategories.flatMap((c) => c.vendors.map((v) => ({ ...v, categoryId: c.id, categoryName: c.name })));
  const availableVendorsForBonus = allVendors.filter((v) => !bonuses.some((b) => b.vendorId === v.id));

  const [terms, setTerms] = useState<TermRow[]>(makeDefaultTerms);
  // Track COLLAPSED terms — default empty = semua kebuka
  const [collapsedTerms, setCollapsedTerms] = useState<Set<number>>(new Set());

  function toggleTerm(idx: number) {
    setCollapsedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  }

  const form = useForm<BookingInput>({
    defaultValues: {
      bookingDate: "", customerId: "", venueId: "", packageId: "",
      salesId: null,
      paymentMethodId: null, sourceOfInformationId: null,
      weddingSession: null, weddingType: null, bonuses: [], termOfPayments: [],
      specialBonusName: null, specialBonusAmount: null,
      signingLocation: null, signatureSales: null,
      withMaterai: false,
    },
  });

  // Helper: reset all form state to clean slate
  function resetToClean() {
    form.reset();
    setSelectedVenueId(""); setSelectedPackageId(""); setSelectedPackagePrice(0); setOriginalPackagePrice(0); setLastAllocatedPrice(0);
    setBonuses([]); setTerms(makeDefaultTerms());
    setCurrentStep(1); setSignatureSales(""); setSigningLocation("");
    setSpecialBonusName("Discount"); setSpecialBonusAmount(0);
    setContactNumbers([]); setContactEmail(""); setContactNikCpp(""); setContactNikCpw("");
    setContactCppAddress(""); setContactCpwAddress(""); setContactBitrixId(""); setNoteDateEvent(""); setCustomerName(""); setSelectedLeadId("");
    setTakeoutPrices({}); setCategoryToggles({}); setTime("");
    setDraftId(null);
    sigSalesRef.current?.clear();
    // Migrate any leftover localStorage draft artifacts
    clearLocalDraftArtifacts();
  }

  useEffect(() => {
    if (open) {
      setBonusPickerOpen(false);
      setShowResumePrompt(false);

      // Deal flow: initialDraftId injected — resume that draft, no resume prompt.
      // Prefill step 1 fields from lead so they're populated when user navigates
      // back, then jump to step 2 (draft already created by handleConfirmDeal).
      if (initialDraftId) {
        resetToClean();
        setDraftId(initialDraftId);
        // Always prefill step 1 form from lead so data is visible if user goes back
        if (prefillLead) {
          setCustomerName(prefillLead.name);
          setSelectedLeadId(prefillLead.leadId);
          form.setValue("customerId", "");
          const mappedNumbers = (prefillLead.contactNumbers ?? [])
            .map((e) => ({ name: e.label ?? "", number: e.number }))
            .filter((e) => e.number);
          setContactNumbers(mappedNumbers);
          setContactEmail(prefillLead.email ?? "");
          setContactNikCpp("");
          setContactNikCpw("");
          setContactCppAddress(prefillLead.address ?? "");
          setContactCpwAddress("");
          setContactBitrixId(prefillLead.bitrixId ?? "");
          setNoteDateEvent(prefillLead.notes ?? "");
          setTime(prefillLead.time ?? "");
          if (prefillLead.sourceOfInformation?.id) form.setValue("sourceOfInformationId", prefillLead.sourceOfInformation.id);
          if (prefillLead.assignedTo?.id) form.setValue("salesId", prefillLead.assignedTo.id);
          if (prefillLead.venue?.id) { form.setValue("venueId", prefillLead.venue.id); setSelectedVenueId(prefillLead.venue.id); }
          else setSelectedVenueId("");
          if (prefillLead.package?.id) { form.setValue("packageId", prefillLead.package.id); setSelectedPackageId(prefillLead.package.id); }
          if (prefillLead.eventType) form.setValue("weddingType", mapEventTypeNameToWeddingType(prefillLead.eventType.name));
          if (prefillLead.weddingSession) form.setValue("weddingSession", prefillLead.weddingSession);
          if (prefillLead.eventDate) form.setValue("bookingDate", new Date(prefillLead.eventDate).toISOString());
        }
        // Jump to step 2 — draft already persisted by Deal flow in leads-table
        setCurrentStep(2);
        return;
      }

      // Prefill from a lead takes precedence over draft resume.
      if (prefillLead) {
        resetToClean();
        setCustomerName(prefillLead.name);
        setSelectedLeadId(prefillLead.leadId);
        form.setValue("customerId", "");
        const mappedNumbers = (prefillLead.contactNumbers ?? [])
          .map((e) => ({ name: e.label ?? "", number: e.number }))
          .filter((e) => e.number);
        setContactNumbers(mappedNumbers);
        setContactEmail(prefillLead.email ?? "");
        setContactNikCpp("");
        setContactNikCpw("");
        setContactCppAddress(prefillLead.address ?? "");
        setContactCpwAddress("");
        setContactBitrixId(prefillLead.bitrixId ?? "");
        setNoteDateEvent(prefillLead.notes ?? "");
        setTime(prefillLead.time ?? "");
        if (prefillLead.sourceOfInformation?.id) form.setValue("sourceOfInformationId", prefillLead.sourceOfInformation.id);
        if (prefillLead.assignedTo?.id) form.setValue("salesId", prefillLead.assignedTo.id);
        if (prefillLead.venue?.id) { form.setValue("venueId", prefillLead.venue.id); setSelectedVenueId(prefillLead.venue.id); }
        else setSelectedVenueId("");
        if (prefillLead.package?.id) { form.setValue("packageId", prefillLead.package.id); setSelectedPackageId(prefillLead.package.id); }
        if (prefillLead.eventType) form.setValue("weddingType", mapEventTypeNameToWeddingType(prefillLead.eventType.name));
        if (prefillLead.weddingSession) form.setValue("weddingSession", prefillLead.weddingSession);
        if (prefillLead.eventDate) form.setValue("bookingDate", new Date(prefillLead.eventDate).toISOString());
        return;
      }

      // Clean slate — resume prompt will show separately via useEffect on unfinishedDraft
      resetToClean();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show resume prompt when unfinished draft is found after drawer opens
  // (skip if initialDraftId is already injected — that IS the draft to use)
  useEffect(() => {
    if (open && !prefillLead && !initialDraftId && unfinishedDraft && !draftId) {
      setShowResumePrompt(true);
    }
  }, [open, prefillLead, initialDraftId, unfinishedDraft, draftId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Note: localStorage auto-save draft removed — DB-backed draft is created on Step 1 "Continue".
  // Draft ID is tracked in `draftId` state and updated per step.

  const getBasePrice = () => selectedPackagePrice;
  const getPriceAfterDiscount = () => Math.max(0, getBasePrice() - specialBonusAmount);
  const getTotalTerms = () => terms.reduce((s, t) => s + (t.amount || 0), 0);
  const getDifference = () => getTotalTerms() - getPriceAfterDiscount();

  // Booking Fee (index 0) and DP (index 1) stay fixed at their defaults; the
  // leftover (total − fee − dp) is split evenly across the remaining terms, with
  // the last term absorbing the rounding remainder.
  const allocatePrice = (price: number, discount: number) => {
    const total = Math.max(0, price - discount);
    setTerms((prev) => {
      const n = prev.length || 1;
      // Fewer than 3 terms: no "rest" buckets — fall back to an even split.
      if (n <= 2) {
        const base = Math.floor(total / n);
        const remainder = total % n;
        return prev.map((t, i) => ({ ...t, amount: i === n - 1 ? base + remainder : base }));
      }
      const fee = Math.min(BOOKING_FEE_DEFAULT, total);
      const dp = Math.min(DP_DEFAULT, Math.max(0, total - fee));
      const rest = Math.max(0, total - fee - dp);
      const restCount = n - 2;
      const base = Math.floor(rest / restCount);
      const remainder = rest % restCount;
      return prev.map((t, i) => {
        if (i === 0) return { ...t, amount: fee };
        if (i === 1) return { ...t, amount: dp };
        return { ...t, amount: i === n - 1 ? base + remainder : base };
      });
    });
  };

  const [wVenueId, wPackageId, wBookingDate, wWeddingSession, wWeddingType, wSourceOfInformationId, wPaymentMethodId, wSalesId] = form.watch(["venueId", "packageId", "bookingDate", "weddingSession", "weddingType", "sourceOfInformationId", "paymentMethodId", "salesId"]);
  // Name shown in the locked sales field — resolves from the current salesId.
  const lockedSalesName =
    salesUsers.find((s) => s.id === wSalesId)?.fullName ??
    (currentUserIsSales ? (user?.name ?? "—") : "—");
  const isBitrixSource = sourceOptions.find((o) => o.id === wSourceOfInformationId)?.name.toLowerCase().includes("bitrix") ?? false;
  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0 && wVenueId && wPackageId && wBookingDate && wWeddingSession && wWeddingType && wSourceOfInformationId && (!isBitrixSource || contactBitrixId.trim()) && time.trim() && wSalesId);

  const selectedVariantData = packages.find((p: PackageData) => p.id === wPackageId);

  const allCategoryPrices = selectedVariantData?.categoryPrices ?? [];
  const visibleCategories = allCategoryPrices.filter((c) => c.isShow);
  const margin = selectedVariantData?.margin ?? 0;

  const baseSellingPrice = (() => {
    if (selectedVariantData?.sellingPrice && selectedVariantData.sellingPrice > 0) {
      return selectedVariantData.sellingPrice;
    }
    const allBase = allCategoryPrices.reduce((sum, c) => sum + c.basePrice, 0);
    return allBase + Math.round(allBase * (margin / 100));
  })();

  const totalTakeoutNominal = visibleCategories
    .filter((c) => categoryToggles[c.categoryName])
    .reduce((sum, c) => sum + (takeoutPrices[c.categoryName] ?? c.basePrice), 0);

  // step2Price uses originalPackagePrice as the invariant base — always the full
  // selling price of the selected package before any takeout. This guarantees that
  // toggling categories on/off always subtracts from the same origin, so the
  // arithmetic is a simple subtraction regardless of how many times step 2 is
  // visited. selectedPackagePrice will be updated to step2Price only when the user
  // explicitly advances to step 3, making it "sticky" from that point.
  const step2Price = Math.max(0, (originalPackagePrice || selectedPackagePrice) - totalTakeoutNominal);

  const isStep2Complete =
    visibleCategories.length === 0 ||
    visibleCategories.some((c) => !(categoryToggles[c.categoryName] ?? false));

  const allPaidTermsHaveEvidence = terms
    .filter(t => (t.paymentStatus ?? "unpaid") === "paid")
    .every(t => t.paymentEvidence instanceof File);
  const isStep3Complete = !!wPaymentMethodId && (
    getBasePrice() === 0 || (
      (terms[0]?.paymentStatus ?? "unpaid") === "paid" &&
      allPaidTermsHaveEvidence
    )
  );
  const isStep4Complete = !!signatureSales && !!signingLocation.trim();

  // Recalc term dates when event date changes
  useEffect(() => {
    if (wBookingDate) setTerms((prev) => recalcTermDates(prev, wBookingDate));
  }, [wBookingDate]);

  // Resolve package price once packages load for a prefilled package (price
  // starts at 0 because the lead only carries the package id, not its pricing).
  useEffect(() => {
    if (!selectedPackageId || selectedPackagePrice > 0 || packages.length === 0) return;
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (pkg) {
      const p = getPackagePrice(pkg);
      setSelectedPackagePrice(p);
      setOriginalPackagePrice(p);
      allocatePrice(p, specialBonusAmount);
      setLastAllocatedPrice(p);
    }
  }, [packages, selectedPackageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill time dari session + weddingType (weddings only, R/AR saja)
  useEffect(() => {
    const mappedType = mapWeddingTypeToEventType(wWeddingType ?? null);
    const autoTime = getWeddingTimeRange(
      (wWeddingSession as WeddingSession | "") ?? "",
      mappedType,
    );
    if (autoTime) {
      setTime(autoTime);
    }
  }, [wWeddingSession, wWeddingType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Force-assign the sales field to the logged-in sales user (covers salesUsers
  // loading after the open/draft reset, and re-applies if it gets cleared).
  useEffect(() => {
    if (open && currentUserIsSales && user?.profileId && wSalesId !== user.profileId) {
      form.setValue("salesId", user.profileId);
    }
  }, [open, currentUserIsSales, user?.profileId, wSalesId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = async () => {
    if (currentStep === 1 && !isStep1Complete) {
      if (!wSalesId) { toast.error("Sales PIC wajib dipilih."); return; }
      if (!wSourceOfInformationId) { toast.error("Sumber informasi wajib diisi."); return; }
      if (isBitrixSource && !contactBitrixId.trim()) { toast.error("Bitrix ID wajib diisi jika sumber informasi adalah Bitrix."); return; }
      toast.error("Lengkapi field yang wajib diisi terlebih dahulu.");
      return;
    }

    // Step 1 → 2: Create DB draft
    if (currentStep === 1) {
      const step1Payload = {
        bookingDate: form.getValues("bookingDate"),
        category: "WEDDINGS" as const,
        venueId: form.getValues("venueId"),
        packageId: form.getValues("packageId") || null,
        salesId: form.getValues("salesId") || null,
        sourceOfInformationId: form.getValues("sourceOfInformationId") || null,
        weddingSession: form.getValues("weddingSession") || null,
        weddingType: form.getValues("weddingType") || null,
        customerId: form.getValues("customerId") || null,
        leadId: selectedLeadId || null,
        customerName: customerName || undefined,
        contactNumbers: JSON.stringify(contactNumbers),
        contactEmail,
        contactNikCpp,
        contactNikCpw,
        contactCppAddress,
        contactCpwAddress,
        contactBitrixId: isBitrixSource ? contactBitrixId : "",
        // Time & note are step 1 fields that must be persisted to DB immediately.
        eventTime: time || null,
        notes: noteDateEvent || null,
        specialBonusName: specialBonusName || null,
        specialBonusAmount: specialBonusAmount || null,
      };

      // If we already have a draftId (resumed draft), skip re-creation.
      // isCreatingDraftRef guards against double-click triggering two creates
      // before the first mutateAsync resolves (the button isPending state catches
      // subsequent clicks once re-render fires, but the very first simultaneous
      // click may slip through the synchronous guard).
      if (!draftId && !isCreatingDraftRef.current) {
        isCreatingDraftRef.current = true;
        const result = await createDraftMut.mutateAsync(step1Payload).finally(() => {
          isCreatingDraftRef.current = false;
        });
        if (!result.success) { toast.error(result.error ?? "Gagal membuat draft."); return; }
        setDraftId(result.draftId ?? null);
      }

      setCurrentStep(2);
      return;
    }

    if (currentStep === 2 && !isStep2Complete) {
      toast.error("Minimal satu kategori harus tetap included.");
      return;
    }

    // Step 2 → 3: Save package/takeout data to draft
    if (currentStep === 2) {
      setSelectedPackagePrice(step2Price);
      if (step2Price !== lastAllocatedPrice) {
        allocatePrice(step2Price, specialBonusAmount);
        setLastAllocatedPrice(step2Price);
      }

      if (draftId) {
        const step2Payload = {
          packageId: form.getValues("packageId") || null,
          specialBonusName: specialBonusName || null,
          specialBonusAmount: specialBonusAmount || null,
          categoryToggles: allCategoryPrices.map((c) => ({
            categoryName: c.categoryName,
            isTakeout: c.isShow ? (categoryToggles[c.categoryName] ?? false) : false,
          })),
        };
        const result = await updateStep2Mut.mutateAsync({ draftId, data: step2Payload });
        if (!result.success) { toast.error(result.error ?? "Gagal menyimpan data paket."); return; }
      }

      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      const firstTerm = terms[0];
      if (!firstTerm || !firstTerm.amount || firstTerm.amount <= 0) {
        toast.error("Nominal term pertama (Booking Fee) wajib diisi dan harus lebih dari 0.");
        return;
      }
      if ((firstTerm.paymentStatus ?? "unpaid") !== "paid") {
        toast.error("Booking Fee harus berstatus Paid sebelum melanjutkan.");
        return;
      }
      const diff = getDifference();
      if (getBasePrice() > 0 && diff !== 0) {
        toast.error(`Total term (Rp${fmtRp(getTotalTerms())}) tidak sama dengan harga setelah discount (Rp${fmtRp(getPriceAfterDiscount())}). Selisih: Rp${fmtRp(Math.abs(diff))}`);
        return;
      }

      // Save term of payments to draft
      if (draftId) {
        const step3Payload = {
          paymentMethodId: form.getValues("paymentMethodId") || null,
          specialBonusName: specialBonusName || null,
          specialBonusAmount: specialBonusAmount || null,
          termOfPayments: terms.filter((t) => t.dueDate).map((t) => ({
            name: t.name,
            amount: t.amount,
            dueDate: t.dueDate,
            sortOrder: t.sortOrder,
            paymentStatus: t.paymentStatus,
          })),
        };
        const result = await updateStep3Mut.mutateAsync({ draftId, data: step3Payload });
        if (!result.success) { toast.error(result.error ?? "Gagal menyimpan term of payment."); return; }
      }

      setCurrentStep(4);
      return;
    }

    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      if (currentStep === 4) { sigSalesRef.current?.clear(); setSignatureSales(""); }
      setCurrentStep(currentStep - 1);
    }
  };

  async function onSubmit(values: BookingInput) {
    // If we have a draftId, use finalize flow
    if (draftId) {
      // Persist step 4 data (signingLocation + signatureSales) to draft first.
      // This ensures the data survives if finalize fails and user resumes later.
      const step4SaveResult = await updateStep4Mut.mutateAsync({
        draftId,
        data: {
          signingLocation: signingLocation || null,
          signatureSales: signatureSales || null,
          withMaterai: values.withMaterai ?? false,
        },
      });
      if (!step4SaveResult.success) {
        toast.error(step4SaveResult.error ?? "Gagal menyimpan tanda tangan.");
        return;
      }

      const finalizePayload = {
        draftId,
        signingLocation: signingLocation || null,
        signatureSales: signatureSales || null,
        withMaterai: values.withMaterai ?? false,
        leadId: selectedLeadId || null,
        bonuses: bonuses.map((b) => ({
          vendorId: b.vendorId,
          vendorCategoryId: b.vendorCategoryId,
          vendorName: b.vendorName,
          description: b.description || null,
          qty: b.qty,
          nominal: b.nominal,
        })),
        categoryToggles: allCategoryPrices.map((c) => ({
          categoryName: c.categoryName,
          basePrice: c.basePrice,
          sortOrder: c.sortOrder,
          isShow: c.isShow,
          isTakeout: c.isShow ? (categoryToggles[c.categoryName] ?? false) : false,
        })),
      };

      const result = await finalizeMut.mutateAsync(finalizePayload);
      if (!result.success) { toast.error(result.error ?? "Gagal memfinalisasi booking."); return; }

      // Upload payment evidence per term
      const termsWithEvidence = terms.filter((t) => t.dueDate && t.paymentEvidence instanceof File);
      if (termsWithEvidence.length > 0 && result.termIds?.length) {
        await Promise.allSettled(
          termsWithEvidence.map((t) => {
            const termId = result.termIds!.find((r) => r.sortOrder === t.sortOrder)?.id;
            if (!termId || !t.paymentEvidence) return Promise.resolve();
            const fd = new FormData();
            fd.append("termId", termId);
            fd.append("file", t.paymentEvidence);
            return fetch("/api/bookings/upload-evidence", { method: "POST", body: fd });
          })
        );
      }

      clearLocalDraftArtifacts();
      toast.success("Booking berhasil dibuat.");
      onSuccess?.();
      onOpenChange(false);
      return;
    }

    // Fallback: no draftId (shouldn't happen in normal flow, but kept as safety net)
    const payload: BookingInput = {
      ...values,
      customerId: values.customerId || "",
      customerName: customerName || "",
      contactNumbers: JSON.stringify(contactNumbers),
      contactEmail,
      contactNikCpp,
      contactNikCpw,
      contactCppAddress,
      contactCpwAddress,
      contactBitrixId: isBitrixSource ? contactBitrixId : "",
      specialBonusName: specialBonusName || null,
      specialBonusAmount: specialBonusAmount || null,
      signingLocation: signingLocation || null,
      signatureSales: signatureSales || null,
      leadId: selectedLeadId || null,
      bonuses: bonuses.map((b) => ({ vendorId: b.vendorId, vendorCategoryId: b.vendorCategoryId, vendorName: b.vendorName, description: b.description || null, qty: b.qty, nominal: b.nominal })),
      termOfPayments: terms.filter((t) => t.dueDate).map((t) => ({ name: t.name, amount: t.amount, dueDate: t.dueDate, sortOrder: t.sortOrder, paymentStatus: t.paymentStatus })),
      categoryToggles: allCategoryPrices.map((c) => ({
        categoryName: c.categoryName,
        basePrice: c.basePrice,
        sortOrder: c.sortOrder,
        isShow: c.isShow,
        isTakeout: c.isShow ? (categoryToggles[c.categoryName] ?? false) : false,
      })),
    };
    const result = await createMut.mutateAsync(payload);
    if (!result.success) { toast.error(result.error); return; }

    const termsWithEvidence = terms.filter((t) => t.dueDate && t.paymentEvidence instanceof File);
    if (termsWithEvidence.length > 0 && result.termIds?.length) {
      await Promise.allSettled(
        termsWithEvidence.map((t) => {
          const termId = result.termIds!.find((r) => r.sortOrder === t.sortOrder)?.id;
          if (!termId || !t.paymentEvidence) return Promise.resolve();
          const fd = new FormData();
          fd.append("termId", termId);
          fd.append("file", t.paymentEvidence);
          return fetch("/api/bookings/upload-evidence", { method: "POST", body: fd });
        })
      );
    }

    clearLocalDraftArtifacts();
    toast.success("Booking berhasil dibuat.");
    onSuccess?.();
    onOpenChange(false);
  }

  const isDraftMutating =
    createDraftMut.isPending ||
    updateStep2Mut.isPending ||
    updateStep3Mut.isPending ||
    updateStep4Mut.isPending ||
    finalizeMut.isPending ||
    createMut.isPending;

  const isContinueDisabled =
    (currentStep === 1 && !isStep1Complete) ||
    (currentStep === 2 && !isStep2Complete) ||
    (currentStep === 3 && !isStep3Complete) ||
    (currentStep === 4 && !isStep4Complete) ||
    isDraftMutating;

  return (
    <Drawer isOpen={open} onClose={() => onOpenChange(false)} title="New Booking" maxWidth="sm:max-w-xl" steps={currentStep} totalSteps={totalSteps} isCloseButton={false}>
      <div className={cn('flex', 'flex-col', 'justify-between', 'h-full')}>

        {/* ─── Resume Draft Prompt ─── */}
        {showResumePrompt && unfinishedDraft && (
          <div className="mx-2 mt-4 mb-2 rounded-2xl border bg-card shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Lanjutkan draft sebelumnya?</p>
            <p className="text-xs text-muted-foreground">
              Kamu punya draft booking untuk{" "}
              <span className="font-medium text-foreground">
                {unfinishedDraft.customerName ?? "Customer Unknown"}
              </span>{" "}
              di{" "}
              <span className="font-medium text-foreground">
                {unfinishedDraft.venueName ?? "Venue Unknown"}
              </span>{" "}
              yang belum selesai.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowResumePrompt(false);
                  // Start fresh — old draft stays in DB and will be cleaned up by cron
                }}
              >
                Mulai Baru
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setDraftId(unfinishedDraft.id);
                  setShowResumePrompt(false);
                  // Prefill step 1 form from draft so user can navigate back and see data.
                  // Fields available from unfinishedDraft query (step-1 fields persisted to DB).
                  if (unfinishedDraft.venueId) {
                    setSelectedVenueId(unfinishedDraft.venueId);
                    form.setValue("venueId", unfinishedDraft.venueId);
                  }
                  if (unfinishedDraft.packageId) {
                    form.setValue("packageId", unfinishedDraft.packageId);
                    setSelectedPackageId(unfinishedDraft.packageId);
                  }
                  if (unfinishedDraft.weddingSession) {
                    form.setValue("weddingSession", unfinishedDraft.weddingSession as "morning" | "evening" | "fullday");
                  }
                  if (unfinishedDraft.weddingType) {
                    form.setValue("weddingType", unfinishedDraft.weddingType);
                  }
                  if (unfinishedDraft.sourceOfInformationId) {
                    form.setValue("sourceOfInformationId", unfinishedDraft.sourceOfInformationId);
                  }
                  if (unfinishedDraft.eventTime) {
                    setTime(unfinishedDraft.eventTime);
                  }
                  if (unfinishedDraft.notes) {
                    setNoteDateEvent(unfinishedDraft.notes);
                  }
                  // customerName — available from unfinishedDraft.customerName
                  if (unfinishedDraft.customerName) {
                    setCustomerName(unfinishedDraft.customerName);
                  }
                  // Note: contactNumbers, email, NIK, address, bitrixId, salesId are NOT returned
                  // by getUserUnfinishedDraft (not in snapshot). These fields will be blank
                  // when navigating back to step 1. Known limitation — full step1 prefill
                  // would require a dedicated getBookingDraftDetail query.
                  // Jump to step 2 (step 1 data already persisted in DB)
                  setCurrentStep(2);
                  toast.info("Draft dilanjutkan. Data step 1 sebagian telah diprefill.");
                }}
              >
                Lanjutkan
              </Button>
            </div>
          </div>
        )}

        <div className={cn('flex-1', 'overflow-y-auto', 'px-2', showResumePrompt ? 'hidden' : '')}>
          <Form {...form}>
            <form className="space-y-4">
              {/* ─── Step 1: Data Booking ─── */}
              {currentStep === 1 && (
                <div className="space-y-3">
                  {/* Customer / Lead selector */}
                  <div ref={customerDropdownRef}>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Customer Name *</FormLabel>
                    {selectedLeadId && (
                      <p className={cn('text-xs', 'text-[var(--brand-gold)]', 'mt-0.5')}>Dari Lead — konversi otomatis saat booking dibuat</p>
                    )}
                    <div className="relative mt-1">
                      <Input
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          setCustomerSearch(e.target.value);
                          form.setValue("customerId", "");
                          setSelectedLeadId("");
                          setCustomerDropdownOpen(true);
                        }}
                        onFocus={() => { if (customerName.trim()) setCustomerDropdownOpen(true); }}
                        placeholder="Cari lead atau customer terdaftar..."
                        className="w-full"
                      />
                      {customerDropdownOpen && customerName.trim() && (leadOptions.length > 0 || customers.length > 0) && (
                        <div className="absolute z-50 w-full mt-1 max-h-80 overflow-auto rounded-xl border bg-background shadow-md">
                          {leadOptions.length > 0 && (
                            <div>
                              <p className={cn('px-3', 'pt-2', 'pb-1', 'text-xs', 'font-semibold', 'text-muted-foreground', 'uppercase', 'tracking-wide')}>Dari Leads</p>
                              {leadOptions.map((lead) => (
                                <div
                                  key={lead.id}
                                  className={cn('cursor-pointer', 'px-3', 'py-2', 'text-sm', 'hover:bg-accent', 'transition-colors')}
                                  onClick={() => {
                                    setCustomerName(lead.name);
                                    setSelectedLeadId(lead.id);
                                    form.setValue("customerId", "");
                                    // Auto-populate: contactNumbers (label→name mapping)
                                    if (Array.isArray(lead.contactNumbers) && lead.contactNumbers.length > 0) {
                                      const mapped = lead.contactNumbers.map((e) => ({
                                        name: e.label ?? e.name ?? "",
                                        number: e.number,
                                      })).filter((e) => e.number);
                                      setContactNumbers(mapped);
                                    }
                                    if (lead.email) setContactEmail(lead.email);
                                    setContactCppAddress(lead.address ?? "");
                                    setContactCpwAddress("");
                                    if (lead.bitrixId) setContactBitrixId(lead.bitrixId);
                                    if (lead.sourceOfInformation?.id) form.setValue("sourceOfInformationId", lead.sourceOfInformation.id);
                                    // Sales — autofill dari sales lead. Skip kalau user login adalah
                                    // sales (field-nya terkunci ke dirinya sendiri).
                                    if (!currentUserIsSales && lead.assignedTo?.id) form.setValue("salesId", lead.assignedTo.id);
                                    setCustomerDropdownOpen(false);
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
                              <p className={cn('px-3', 'pt-2', 'pb-1', 'text-xs', 'font-semibold', 'text-muted-foreground', 'uppercase', 'tracking-wide')}>Customer Terdaftar</p>
                              {customers.map((c) => (
                                <div
                                  key={c.id}
                                  className={cn('cursor-pointer', 'px-3', 'py-2', 'text-sm', 'hover:bg-accent', 'transition-colors')}
                                  onClick={() => {
                                    setCustomerName(c.name);
                                    form.setValue("customerId", c.id);
                                    setSelectedLeadId("");
                                    if (c.mobileNumber) {
                                      const entries = Array.isArray(c.mobileNumber)
                                        ? (c.mobileNumber as MobileNumberEntry[])
                                        : String(c.mobileNumber).split(",").map((n) => ({ name: "", number: n.trim() })).filter((e) => e.number);
                                      setContactNumbers(entries);
                                    }
                                    if (c.email) setContactEmail(c.email);
                                    if (c.cppNik) setContactNikCpp(c.cppNik);
                                    if (c.cpwNik) setContactNikCpw(c.cpwNik);
                                    setContactCppAddress(c.cppAddress ?? "");
                                    setContactCpwAddress(c.cpwAddress ?? "");
                                    if (c.bitrixId) setContactBitrixId(c.bitrixId);
                                    if (c.sourceOfInformationId) form.setValue("sourceOfInformationId", c.sourceOfInformationId);
                                    setCustomerDropdownOpen(false);
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
                  </div>

                  {/* Contact Person */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Contact Person *</FormLabel>
                    <div className={cn('mt-1', 'rounded-lg', 'bg-muted', 'p-3', 'space-y-2')}>
                      {contactNumbers.map((entry, idx) => (
                        <div key={idx} className={cn('flex', 'items-center', 'gap-2', 'rounded-md', 'bg-background', 'border', 'px-3', 'py-2')}>
                          <div className={cn('flex-1', 'min-w-0')}>
                            {entry.name && <p className={cn('text-xs', 'text-muted-foreground')}>{entry.name}</p>}
                            <p className={cn('text-sm', 'font-medium')}>{entry.number}</p>
                          </div>
                          <button type="button" className={cn('shrink-0', 'text-destructive', 'hover:bg-destructive/10', 'rounded-full', 'p-1')} onClick={() => setContactNumbers((prev) => prev.filter((_, i) => i !== idx))}>
                            <CloseCircle weight="BoldDuotone" className={cn('w-3.5', 'h-3.5')} />
                          </button>
                        </div>
                      ))}
                      <Popover open={contactPopoverOpen} onOpenChange={(o) => { setContactPopoverOpen(o); if (!o) setContactInput({ name: "", number: "" }); }}>
                        <PopoverTrigger render={
                          <Button type="button" variant="outline" className="shrink-0 bg-background w-full text-xs h-8">
                            Tambah Nomor
                          </Button>
                        } />
                        <PopoverContent className="w-72 p-3 space-y-2" align="end">
                          <p className="text-xs font-medium">Tambah Nomor</p>
                          <Input
                            value={contactInput.name}
                            onChange={(e) => setContactInput((p) => ({ ...p, name: e.target.value }))}
                            placeholder="cpw, cpp, ortu, ..."
                            className="h-8 text-xs"
                          />
                          <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                            <span className="px-2 text-xs text-muted-foreground border-r bg-muted self-stretch flex items-center shrink-0">+62</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={contactInput.number}
                              onChange={(e) => {
                                let raw = e.target.value.replace(/\D/g, "");
                                if (raw.startsWith("62")) raw = raw.slice(2);
                                else if (raw.startsWith("0")) raw = raw.slice(1);
                                setContactInput((p) => ({ ...p, number: raw.slice(0, 13) }));
                              }}
                              placeholder="81234567890"
                              className="flex-1 px-3 py-1.5 text-xs outline-none bg-transparent min-w-0"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const digits = contactInput.number.trim();
                                  if (digits.length < 7) return;
                                  const full = "62" + digits;
                                  if (contactNumbers.some((c) => c.number === full)) { toast.error("Nomor sudah ada"); return; }
                                  setContactNumbers((prev) => [...prev, { name: contactInput.name.trim(), number: full }]);
                                  setContactInput({ name: "", number: "" });
                                  setContactPopoverOpen(false);
                                }
                              }}
                            />
                          </div>
                          <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={() => {
                            const digits = contactInput.number.trim();
                            if (digits.length < 7) return;
                            const full = "62" + digits;
                            if (contactNumbers.some((c) => c.number === full)) { toast.error("Nomor sudah ada"); return; }
                            setContactNumbers((prev) => [...prev, { name: contactInput.name.trim(), number: full }]);
                            setContactInput({ name: "", number: "" });
                            setContactPopoverOpen(false);
                          }}>Tambah</Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Sales PIC */}
                  {currentUserIsSales ? (
                    /* Logged-in user is a sales → locked to themselves */
                    <div>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Sales PIC *</FormLabel>
                      <div className="mt-1 flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
                        {lockedSalesName}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Booking ini akan tercatat atas nama Anda.
                      </p>
                    </div>
                  ) : (
                    <FormField control={form.control} name="salesId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Sales PIC *</FormLabel>
                        <SearchableSelect
                          options={salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? "" }))}
                          value={field.value ?? ""}
                          onChange={(id) => field.onChange(id || null)}
                          placeholder="Pilih sales..."
                          searchPlaceholder="Cari sales..."
                          emptyText="Sales tidak ditemukan"
                        />
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Sumber Informasi */}
                  <FormField control={form.control} name="sourceOfInformationId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Sumber Informasi *</FormLabel>
                      <SearchableSelect
                          options={sourceOptions}
                          value={field.value ?? ""}
                          onChange={(id) => {
                            field.onChange(id);
                            const isBitrix = sourceOptions.find((o) => o.id === id)?.name.toLowerCase().includes("bitrix") ?? false;
                            if (!isBitrix) setContactBitrixId("");
                          }}
                          placeholder="Pilih sumber informasi"
                          searchPlaceholder="Cari sumber..."
                          emptyText="Tidak ada data"
                          onAdd={async (name) => {
                            const { createSourceOfInformation } = await import("@/actions/source-of-information");
                            const result = await createSourceOfInformation(name);
                            if (!result.success) { toast.error(result.error ?? "Gagal menambahkan"); return; }
                            await qc.invalidateQueries({ queryKey: ["source-of-informations"] });
                            field.onChange(result.item!.id);
                            toast.success(`"${name}" berhasil ditambahkan`);
                          }}
                        />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Bitrix ID — hanya muncul jika sumber informasi adalah Bitrix */}
                  {isBitrixSource && (
                    <div>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Bitrix ID</FormLabel>
                      <Input placeholder="e.g. 12345" value={contactBitrixId} onChange={(e) => setContactBitrixId(e.target.value)} className="mt-1" />
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Email</FormLabel>
                    <Input placeholder="e.g. nama@email.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1" />
                  </div>

                  {/* NIK CPP */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>NIK CPP</FormLabel>
                    <Input placeholder="e.g. 3275010101010001" value={contactNikCpp} onChange={(e) => setContactNikCpp(e.target.value.replace(/\D/g, "").slice(0, 16))} inputMode="numeric" maxLength={16} className="mt-1" />
                  </div>

                  {/* Alamat CPP */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Alamat CPP</FormLabel>
                    <Textarea placeholder="e.g. Jl. Melati No. 10, Jakarta Selatan" value={contactCppAddress} onChange={(e) => setContactCppAddress(e.target.value)} rows={3} className="mt-1" />
                  </div>

                  {/* NIK CPW */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>NIK CPW</FormLabel>
                    <Input placeholder="e.g. 3275010101010002" value={contactNikCpw} onChange={(e) => setContactNikCpw(e.target.value.replace(/\D/g, "").slice(0, 16))} inputMode="numeric" maxLength={16} className="mt-1" />
                  </div>

                  {/* Alamat CPW */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Alamat CPW</FormLabel>
                    <Textarea placeholder="e.g. Jl. Melati No. 10, Jakarta Selatan" value={contactCpwAddress} onChange={(e) => setContactCpwAddress(e.target.value)} rows={3} className="mt-1" />
                  </div>

                  {/* Venue */}
                  <FormField control={form.control} name="venueId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Venue *</FormLabel>
                      <SearchableSelect options={venues} value={field.value} onChange={(id) => { field.onChange(id); setSelectedVenueId(id); setSelectedPackageId(""); setSelectedPackagePrice(0); setOriginalPackagePrice(0); setCategoryToggles({}); setTakeoutPrices({}); form.setValue("packageId", ""); form.setValue("paymentMethodId", null); }} placeholder="Pilih venue..." searchPlaceholder="Cari venue..." emptyText="Tidak ada venue" />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Pilih Paket */}
                  <FormField control={form.control} name="packageId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Pilih Paket *</FormLabel>
                      <SearchableSelect options={packages.map((p) => ({ id: p.id, name: `${p.packageName} — ${p.pax} pax — ${formatRupiah(getPackagePrice(p))}` }))} value={field.value} onChange={(id) => { field.onChange(id); setSelectedPackageId(id); setSelectedPackagePrice(0); setOriginalPackagePrice(0); setLastAllocatedPrice(0); setCategoryToggles({}); setTakeoutPrices({}); const pkg = packages.find((x: PackageData) => x.id === id); if (pkg) { const p = getPackagePrice(pkg); setSelectedPackagePrice(p); setOriginalPackagePrice(p); allocatePrice(p, specialBonusAmount); setLastAllocatedPrice(p); } }} placeholder={!selectedVenueId ? "Pilih venue dulu" : packagesLoading ? "Memuat paket..." : packagesError ? "Gagal memuat paket" : "Pilih paket..."} disabled={!selectedVenueId || packagesLoading} searchPlaceholder="Cari paket..." emptyText="Tidak ada paket" />
                      {packagesError && <p className="text-xs text-destructive mt-1">Gagal memuat paket. Coba pilih venue ulang.</p>}
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Event Type */}
                  <FormField control={form.control} name="weddingType" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Event Type *</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Pilih type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="R">Resepsi</SelectItem>
                          <SelectItem value="AR">Akad & Resepsi</SelectItem>
                          <SelectItem value="TR">Teapai & Resepsi</SelectItem>
                          <SelectItem value="PR">Pemberkatan Resepsi</SelectItem>
                          <SelectItem value="VO">Venue Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Event Date */}
                  <FormField control={form.control} name="bookingDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Event Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger render={
                          <Button
                            variant="outline"
                            disabled={!selectedVenueId}
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            <CalendarIcon weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4')} />
                            {selectedVenueId
                              ? (field.value ? format(new Date(field.value), "PPP") : "Pilih tanggal event")
                              : "Pilih venue terlebih dahulu"}
                          </Button>
                        } />
                        <PopoverContent className={cn('w-auto', 'p-0')} align="start">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => { field.onChange(date ? date.toISOString() : ""); form.setValue("weddingSession", null); }}
                            disabled={(d) => getDateStatus(d) === "unavailable"}
                            fromYear={new Date().getFullYear() - 10}
                            toYear={new Date().getFullYear() + 10}
                            defaultMonth={field.value ? new Date(field.value) : new Date()}
                            onMonthChange={setVisibleMonth}
                            modifiers={{
                              available: (d) => !!selectedVenueId && getDateStatus(d) === "available",
                              partial: (d) => !!selectedVenueId && getDateStatus(d) === "partial",
                              unavailable: (d) => !!selectedVenueId && getDateStatus(d) === "unavailable",
                            }}
                            modifiersClassNames={{
                              available: "day-available",
                              partial: "day-partial",
                              unavailable: "day-unavailable",
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      {availLoading && <p className={cn('text-xs', 'text-muted-foreground', 'mt-1')}>Mengecek ketersediaan...</p>}
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Event Session */}
                  <FormField control={form.control} name="weddingSession" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Event Session *</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Pilih session" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(() => {
                            const dateStr = wBookingDate ? format(new Date(wBookingDate), "yyyy-MM-dd") : null;
                            const sessions = dateStr ? getAvailableSessions(dateStr) : ["morning", "evening", "fullday"];
                            const labels: Record<string, string> = { morning: "Pagi", evening: "Malam", fullday: "Fullday" };
                            return sessions.map((s) => <SelectItem key={s} value={s}>{labels[s]}</SelectItem>);
                          })()}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Time */}
                  <div className="flex flex-col gap-1">
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>
                      Time *
                      {wWeddingSession && mapWeddingTypeToEventType(wWeddingType ?? null) && (
                        <span className="ml-2 font-normal text-muted-foreground text-xs">
                          (auto-filled, bisa diubah manual)
                        </span>
                      )}
                    </FormLabel>
                    <TimeRangePicker
                      value={time}
                      onChange={setTime}
                      placeholder="Pilih waktu (bisa rentang)..."
                    />
                  </div>

                  {/* Note Date Event */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Note Date Event</FormLabel>
                    <Textarea placeholder="Add note for date event" value={noteDateEvent} onChange={(e) => setNoteDateEvent(e.target.value)} rows={3} className="mt-1" />
                  </div>

                  {/* Complimentary (Bonus) */}
                  <div className="space-y-2">
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Complimentary (Bonus)</FormLabel>
                    {bonusPickerOpen ? (
                      <SearchableSelect
                        options={availableVendorsForBonus.map((v) => ({ id: v.id, name: v.name }))}
                        value=""
                        onChange={(vendorId) => { const v = allVendors.find((x) => x.id === vendorId); if (v) setBonuses((prev) => [...prev, { vendorId: v.id, vendorCategoryId: v.categoryId, vendorName: v.name, description: "", qty: 1, nominal: 0 }]); setBonusPickerOpen(false); }}
                        placeholder="Pilih vendor..."
                        searchPlaceholder="Cari vendor..."
                        emptyText="Tidak ada vendor"
                      />
                    ) : (
                      <Button type="button" variant="outline" className="w-full rounded-xl border-dashed" onClick={() => setBonusPickerOpen(true)}>
                        <AddCircle weight="BoldDuotone" className={cn('h-4', 'w-4', 'mr-1')} />
                        Tambah Complimentary
                      </Button>
                    )}
                    {bonuses.map((b, idx) => (
                      <div key={idx} className={cn('bg-muted', 'border', 'border-border', 'rounded-md', 'px-3', 'py-2', 'space-y-1.5')}>
                        <div className={cn('flex', 'items-center', 'justify-between', 'gap-2')}>
                          <div className="flex-1">
                            <SearchableSelect
                              options={allVendors.filter((v) => !bonuses.some((x, i) => i !== idx && x.vendorId === v.id)).map((v) => ({ id: v.id, name: v.name }))}
                              value={b.vendorId}
                              onChange={(vendorId) => { const v = allVendors.find((x) => x.id === vendorId); if (v) setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, vendorId: v.id, vendorCategoryId: v.categoryId, vendorName: v.name } : x)); }}
                              placeholder="Pilih vendor..."
                              searchPlaceholder="Cari vendor..."
                              emptyText="Tidak ada vendor"
                            />
                          </div>
                          <Button type="button" variant="ghost" size="sm" className={cn('h-6', 'w-6', 'p-0', 'text-destructive', 'hover:text-destructive', 'shrink-0')} onClick={() => setBonuses((prev) => prev.filter((_, i) => i !== idx))}>
                            <CloseCircle weight="BoldDuotone" className={cn('h-3', 'w-3')} />
                          </Button>
                        </div>
                        <div className="relative">
                          <span className={cn('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'text-xs', 'text-muted-foreground')}>Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            className={cn('w-full', 'pl-8', 'pr-3', 'py-1.5', 'text-sm', 'border', 'border-input', 'rounded-md', 'bg-background')}
                            placeholder="Nominal"
                            value={b.nominal ? new Intl.NumberFormat("id-ID").format(b.nominal) : ""}
                            onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, nominal: n } : x)); }}
                          />
                        </div>
                        <Textarea
                          value={b.description}
                          onChange={(e) => setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                          placeholder="Keterangan bonus..."
                          rows={3}
                          className="resize-none text-sm"
                        />
                      </div>
                    ))}
                    {bonuses.length === 0 && <p className={cn('text-xs', 'text-muted-foreground', 'italic', 'text-center', 'py-1')}>Belum ada complimentary</p>}
                  </div>
                </div>
              )}
              {/* ─── Step 2: Package Prices ─── */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {/* Sticky price summary — second sticky (footer is first) */}
                  <div className="sticky top-0 z-10 bg-background pb-2">
                    <div className={cn('rounded-2xl', 'border', 'bg-card', 'shadow-sm', 'p-4')}>
                      <p className="text-xs text-muted-foreground mb-1">Harga setelah takeout</p>
                      <p className={cn('text-xl', 'font-semibold', 'font-heading', 'text-foreground')}>
                        Rp{fmtRp(step2Price)}
                      </p>
                      {totalTakeoutNominal > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="line-through">Rp{fmtRp(baseSellingPrice)}</span>
                          <span className="ml-2 text-destructive font-medium">-Rp{fmtRp(totalTakeoutNominal)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className={cn('text-sm', 'font-medium', 'text-foreground')}>Kategori Harga Package</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Tandai kategori sebagai takeout jika klien menyediakan sendiri. Harga otomatis berkurang.
                    </p>
                  </div>
                  {visibleCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Tidak ada kategori harga untuk paket ini.
                    </p>
                  )}
                  <div className="space-y-2">
                    {visibleCategories.map((cat) => {
                      const isTakeout = categoryToggles[cat.categoryName] ?? false;
                      const takeoutNominal = takeoutPrices[cat.categoryName] ?? cat.basePrice;
                      return (
                        <div
                          key={cat.categoryName}
                          className={cn('rounded-xl', 'border', 'p-3', isTakeout && 'border-destructive/30 bg-destructive/5')}
                        >
                          <div className={cn('flex', 'items-center', 'justify-between')}>
                            <div>
                              <p className={cn('text-sm font-medium', isTakeout && 'line-through text-muted-foreground')}>{cat.categoryName}</p>
                              <p className={cn('text-xs text-muted-foreground', isTakeout && 'line-through')}>
                                Rp{fmtRp(cat.basePrice)}
                              </p>
                            </div>
                            <div className={cn('flex', 'items-center', 'gap-2')}>
                              <span className={cn('text-xs', isTakeout ? 'text-destructive font-medium' : 'text-muted-foreground')}>Takeout</span>
                              <Switch
                                checked={isTakeout}
                                onCheckedChange={(v) => {
                                  setCategoryToggles((prev) => ({ ...prev, [cat.categoryName]: v }));
                                  if (!v) {
                                    setTakeoutPrices((prev) => {
                                      const next = { ...prev };
                                      delete next[cat.categoryName];
                                      return next;
                                    });
                                  }
                                }}
                              />
                            </div>
                          </div>
                          {isTakeout && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-1">Nominal takeout</p>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={takeoutNominal ? fmtRp(takeoutNominal) : ""}
                                  onChange={(e) => {
                                    const num = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                                    setTakeoutPrices((prev) => ({ ...prev, [cat.categoryName]: num }));
                                  }}
                                  placeholder={`Rp${fmtRp(cat.basePrice)}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* ─── Step 3: Term of Payments ─── */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  {/* Package price */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Total Harga Package</FormLabel>
                    <Input disabled value={`Rp${fmtRp(getPriceAfterDiscount())}`} className="mt-1" />
                  </div>

                  {/* Discount / Special Bonus */}
                  <div className={cn('flex', 'flex-col', 'gap-2', 'border-y', 'py-4')}>
                    <Input
                      placeholder="Nama bonus (e.g. Discount)"
                      value={specialBonusName}
                      onChange={(e) => setSpecialBonusName(e.target.value)}
                      className={cn('border-0', 'p-0', 'text-sm', 'font-medium', 'text-foreground', 'bg-transparent', 'shadow-none', 'focus-visible:ring-0', 'h-auto')}
                    />
                    <Input
                      placeholder="IDR. 0"
                      value={specialBonusAmount ? fmtRp(specialBonusAmount) : ""}
                      onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setSpecialBonusAmount(num); allocatePrice(getBasePrice(), num); setLastAllocatedPrice(getBasePrice()); }}
                      inputMode="numeric"
                      className="rounded-none"
                    />
                    <p className={cn('text-xs', 'text-muted-foreground')}>Input ini akan ditampilkan di dokumen PO. Terms otomatis di-recalculate saat discount diubah.</p>
                  </div>

                  {/* Payment Method */}
                  <FormField control={form.control} name="paymentMethodId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Pembayaran Melalui *</FormLabel>
                      <BankAccountSelect value={field.value ?? ""} onChange={field.onChange} placeholder={selectedVenueId ? "Pilih metode pembayaran" : "Pilih venue dulu"} disabled={!selectedVenueId} venueId={selectedVenueId} disableAdd />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Term of Payments */}
                  <div>
                    <FormLabel className="text-sm font-medium text-foreground mb-2 block">Term of Payments</FormLabel>
                    <div className="space-y-2">
                      {terms.map((t, idx) => {
                        const isFirstTerm = idx === 0;
                        const isFirstInvalid = isFirstTerm && (!t.amount || t.amount <= 0);
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
                                    {isFirstTerm && <span className="text-destructive ml-1">*</span>}
                                  </p>
                                  {!isOpen && (
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                      <span className={cn(payStatus === "paid" ? "text-foreground" : "text-muted-foreground")}>
                                        {statusLabel}
                                      </span>
                                      {t.amount ? ` · Rp${fmtRp(t.amount)}` : ""}
                                      {t.dueDate ? ` · ${format(new Date(t.dueDate), "dd MMM yyyy")}` : ""}
                                    </p>
                                  )}
                                </div>
                              </CollapsibleTrigger>
                              {/* Tombol hapus — SIBLING dari trigger, bukan child-nya */}
                              {terms.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTerms((prev) => recalcTermDates(prev.filter((_, i) => i !== idx), wBookingDate));
                                    setCollapsedTerms((prev) => {
                                      const next = new Set<number>();
                                      prev.forEach((n) => { if (n < idx) { next.add(n); } else if (n > idx) { next.add(n - 1); } });
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

                            {/* ── Collapsible body ── */}
                            <CollapsibleContent>
                              <div className="px-3 pb-3 space-y-3 border-t border-border/60">
                                {/* Term name + Status pembayaran — satu row dua kolom */}
                                <div className="pt-2 flex items-center gap-2">
                                  <div className="flex flex-1 min-w-0 items-center gap-1">
                                    <Input
                                      value={t.name}
                                      onChange={(e) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                                      placeholder="Nama term (mis. Booking Fee)"
                                      className="border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto"
                                    />
                                    {isFirstTerm && <span className="text-destructive text-xs font-medium shrink-0">*</span>}
                                  </div>

                                  <Select
                                    value={payStatus}
                                    onValueChange={(v) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentStatus: v as TermRow["paymentStatus"] } : x))}
                                  >
                                    <SelectTrigger className="w-32 h-8 bg-background shrink-0">
                                      <span className={cn("text-xs font-semibold", payStatus === "paid" ? "text-foreground" : "text-muted-foreground")}>
                                        {statusLabel}
                                      </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PAYMENT_STATUS.filter((s) => s !== "partial").map((s) => (
                                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Amount + Date row */}
                                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                                  <div className="sm:flex-[2]">
                                    <Input
                                      value={t.amount ? fmtRp(t.amount) : ""}
                                      onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, amount: num } : x)); }}
                                      placeholder="Amount"
                                      inputMode="numeric"
                                      className="bg-background"
                                    />
                                  </div>
                                  <div className="sm:flex-1">
                                    <Popover>
                                      <PopoverTrigger render={
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background", !t.dueDate && "text-muted-foreground")}>
                                          <CalendarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                                          {t.dueDate ? format(new Date(t.dueDate), "dd MMM yyyy") : "Select Date"}
                                        </Button>
                                      } />
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          captionLayout="dropdown"
                                          selected={t.dueDate ? new Date(t.dueDate) : undefined}
                                          onSelect={(date) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, dueDate: date ? date.toISOString() : "" } : x))}
                                          fromYear={new Date().getFullYear() - 10}
                                          toYear={new Date().getFullYear() + 10}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>

                                {/* Upload bukti pembayaran — hanya kalau paid */}
                                {payStatus === "paid" && (
                                  <div>
                                    <div className="relative flex items-center gap-2 px-3 py-2 border rounded-xl bg-muted/30 text-muted-foreground cursor-pointer hover:bg-muted/50 text-xs">
                                      {t.paymentEvidence instanceof File && t.paymentEvidence.type.startsWith("image/") ? (
                                        <FilePreview file={t.paymentEvidence} onOpen={() => { const url = URL.createObjectURL(t.paymentEvidence!); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); }} />
                                      ) : (
                                        <FileText weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                                      )}
                                      {t.paymentEvidence ? (
                                        <button type="button" className="relative z-10 flex-1 truncate text-left hover:underline" onClick={(e) => { e.stopPropagation(); const url = URL.createObjectURL(t.paymentEvidence!); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); }}>
                                          {t.paymentEvidence.name}
                                        </button>
                                      ) : (
                                        <span className="flex-1 truncate">Upload bukti pembayaran</span>
                                      )}
                                      {t.paymentEvidence && (
                                        <button type="button" className="shrink-0 hover:text-destructive z-10 relative" onClick={(e) => { e.stopPropagation(); setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentEvidence: null } : x)); }}>
                                          <CloseCircle weight="BoldDuotone" className="h-3 w-3" />
                                        </button>
                                      )}
                                      <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const f = e.target.files?.[0]; if (f) setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentEvidence: f } : x)); e.target.value = ""; }} />
                                    </div>
                                    <p className="mt-1 text-xs text-destructive">
                                      Bukti pembayaran wajib diupload untuk melanjutkan ke langkah berikutnya.
                                    </p>
                                  </div>
                                )}

                                {isFirstInvalid && (
                                  <p className="text-xs text-destructive">Nominal Booking Fee wajib diisi</p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>

                    {/* Add button */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 border-dashed gap-1.5 text-muted-foreground"
                        onClick={() => {
                          setTerms((prev) => recalcTermDates([...prev, { name: "", amount: 0, dueDate: "", sortOrder: prev.length, paymentStatus: "unpaid" }], wBookingDate));
                          // term baru otomatis kebuka (default open)
                        }}
                      >
                        <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                        Tambah Payment
                      </Button>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className={cn('p-3', 'bg-muted', 'rounded-lg')}>
                    <div className={cn('flex', 'justify-between', 'items-center', 'mb-2')}>
                      <span className={cn('text-sm', 'font-medium', 'text-foreground')}>Harga Paket:</span>
                      <span className={cn('text-sm', 'font-medium', 'text-foreground')}>Rp{fmtRp(getBasePrice())}</span>
                    </div>
                    <div className={cn('flex', 'justify-between', 'items-center', 'mb-2')}>
                      <span className={cn('text-sm', 'font-medium', 'text-destructive')}>{specialBonusName || "Discount"}:</span>
                      <span className={cn('text-sm', 'font-medium', 'text-destructive')}>- Rp{fmtRp(specialBonusAmount)}</span>
                    </div>
                    <div className={cn('flex', 'justify-between', 'items-center', 'mb-2', 'border-t', 'pt-2')}>
                      <span className={cn('text-sm', 'font-medium', 'text-foreground')}>Harga Setelah Discount:</span>
                      <span className={cn('text-sm', 'font-medium', 'text-foreground')}>Rp{fmtRp(getPriceAfterDiscount())}</span>
                    </div>
                    <div className={cn('flex', 'justify-between', 'items-center', 'mb-2')}>
                      <span className={cn('text-sm', 'font-medium', 'text-foreground')}>Total Input User:</span>
                      <span className={cn('text-sm', 'font-medium', 'text-foreground')}>Rp{fmtRp(getTotalTerms())}</span>
                    </div>
                    <div className={cn('flex', 'justify-between', 'items-center')}>
                      <span className={cn('text-sm', 'font-medium', 'text-foreground')}>Selisih:</span>
                      <span className={cn("text-sm font-medium", getDifference() !== 0 ? "text-destructive" : "text-foreground")}>
                        Rp{fmtRp(Math.abs(getDifference()))}{getDifference() < 0 ? " (Kurang)" : getDifference() > 0 ? " (Lebih)" : " (Sesuai)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* ─── Step 4: Signature ─── */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground', 'mb-2', 'block')}>Lokasi Tanda Tangan *</FormLabel>
                    <Input placeholder="Contoh: Jakarta, Bandung, Surabaya..." value={signingLocation} onChange={(e) => setSigningLocation(e.target.value)} />
                  </div>
                  {/* E-Meterai — hidden for WEDDINGS category, reserved for future use */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground', 'mb-2', 'block')}>Tanda Tangan Sales *</FormLabel>
                    <div className={cn("border-2 border-dashed rounded-xl overflow-hidden bg-muted", !signatureSales ? "border-destructive/40" : "border-border")}>
                      <SignatureCanvas
                        ref={sigSalesRef}
                        penColor="black"
                        canvasProps={{ className: "w-full", style: { width: "100%", height: 200, touchAction: "none" } }}
                        onEnd={() => { if (sigSalesRef.current) setSignatureSales(sigSalesRef.current.toDataURL("image/png")); }}
                      />
                    </div>
                    <div className={cn('flex', 'items-center', 'justify-between', 'mt-1.5')}>
                      {!signatureSales && <p className={cn('text-xs', 'text-destructive')}>Tanda tangan sales wajib diisi</p>}
                      <button type="button" onClick={() => { sigSalesRef.current?.clear(); setSignatureSales(""); }} className={cn('text-xs', 'text-destructive', 'hover:text-destructive', 'underline', 'ml-auto')}>Hapus tanda tangan</button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </div>
        {/* Footer — hidden when showing resume prompt */}
        <div className={cn('bg-background', 'sticky', 'bottom-0', 'z-10', showResumePrompt ? 'hidden' : '')}>
          <div className={cn('flex', 'py-4', 'gap-2')}>
            <Button
              variant="outline"
              onClick={currentStep === 1 ? () => onOpenChange(false) : handlePrevious}
              disabled={isDraftMutating}
              className="flex-[40%] cursor-pointer"
            >
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={currentStep < totalSteps ? handleNext : form.handleSubmit(onSubmit)}
              disabled={isContinueDisabled}
              className={cn("flex-[60%] cursor-pointer", isContinueDisabled && "opacity-50 cursor-not-allowed")}
            >
              {currentStep < totalSteps
                ? (isDraftMutating ? "Menyimpan..." : "Continue")
                : (isDraftMutating ? "Membuat Booking..." : "Create New Booking")}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
