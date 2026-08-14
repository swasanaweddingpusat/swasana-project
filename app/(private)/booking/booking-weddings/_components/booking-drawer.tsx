"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { Calendar as CalendarIcon, CloseCircle, AltArrowDown } from "@solar-icons/react";
import { CreatePaymentStep } from "@/app/(private)/booking/booking-weddings/_components/_create-booking/CreatePaymentStep";
import { CreatePaymentRecordStep, type CreatePaymentEntry } from "@/app/(private)/booking/booking-weddings/_components/_create-booking/CreatePaymentRecordStep";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BitrixDealSelect } from "./bitrix-deal-select";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactEntry, parseStoredPhone } from "@/components/shared/PhoneInput";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { cn, formatRupiah, toDateOnly, parseDateOnly } from "@/lib/utils";
import { safeRandomUUID } from "@/lib/uuid";
import {
  idbClearAllEvidence,
} from "@/lib/idbDraftStore";
import { useCreateBooking } from "@/hooks/use-bookings";
import { useMySignature } from "@/hooks/use-my-signature";
import {
  useUnfinishedDraft,
  useDraftBookingDetail,
  useCreateDraftBooking,
  useUpdateDraftStep2,
  useUpdateDraftStep3,
  useUpdateDraftStep4,
  useFinalizeDraftBooking,
} from "@/hooks/use-booking-draft";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useComplimentaries } from "@/hooks/use-complimentaries";
import { createComplimentary } from "@/actions/complimentary";
import { usePermissions } from "@/hooks/use-permissions";
import { ComplimentarySelect } from "@/app/(private)/booking/booking-weddings/_components/ComplimentarySelect";
import {
  PackageItemsEditor,
  type PackageInternalItemDraft,
  type PackageVendorItemDraft,
} from "@/components/shared/PackageItemsEditor";
import type { BookingInput } from "@/lib/validations/booking";
import type { MobileNumberEntry } from "@/lib/validations/customer";
import { validateBookingField, validateIdNumber, type BookingFieldKey } from "@/lib/validations/booking-form";
import type { BookingPrefillLead } from "@/types/daily-activity";
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
   * creating a new one on Step 1 "Continue". Skips the resume prompt entirely
   * and forces step 3.
   */
  initialDraftId?: string | null;
  /**
   * When provided (resume from booking table), the drawer immediately triggers
   * the data-driven resume flow: fetches the draft, prefills all fields, and
   * advances to the step appropriate for the draft's data — without showing the
   * in-drawer resume prompt (the user already chose to resume by clicking the row).
   * Unlike `initialDraftId`, this does NOT force step 3.
   */
  resumeDraftId?: string | null;
}

type Option = { id: string; name: string };
interface CustomerOption { id: string; name: string; mobileNumber: string; emailCpp: string | null; emailCpw: string | null; cppNik: string | null; cpwNik: string | null; cppIdType: string | null; cpwIdType: string | null; cppAddress: string | null; cpwAddress: string | null; sourceOfInformationId: string | null; bitrixId: string | null }
interface LeadOption { id: string; name: string; email: string | null; contactNumbers: Array<{ label?: string; name?: string; number: string }>; address: string | null; sourceOfInformation: { id: string; name: string } | null; bitrixId: string | null; convertedToCustomerId: string | null; assignedTo: { id: string; fullName: string | null } | null }
interface CategoryPriceEntry {
  id: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
}
interface PackageInternalItemEntry {
  id: string;
  itemName: string;
  itemDescription: string;
}
interface PackageVendorItemEntry {
  id: string;
  categoryId: string | null;
  categoryName: string;
  itemText: string;
}
interface PackageData {
  id: string;
  packageName: string;
  pax: number;
  margin: number;
  sellingPrice: number;
  categoryPrices: CategoryPriceEntry[];
  internalItems?: PackageInternalItemEntry[];
  vendorItems?: PackageVendorItemEntry[];
}
interface BonusRow { vendorId: string; vendorCategoryId: string; vendorName: string; description: string; qty: number; nominal: number }
interface ComplimentaryRow { id: string; complimentaryId: string | null; name: string; price: number; isShowPrice: boolean; description: string; qty: number }
// Fase 5: TOP = jadwal murni. Status/bukti bayar dilacak di Cashbook (Ledger),
// bukan lagi di termin. Step-5 hanya mengatur jadwal cicilan (nama/nominal/tanggal).
interface TermRow {
  /** Stable client-side id for React keys + drag-drop. Never persisted. */
  uid: string;
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
  /** DB term id — present once the draft term has been persisted. */
  termId?: string | null;
}

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
    { uid: safeRandomUUID(), name: "Booking Fee", amount: BOOKING_FEE_DEFAULT, dueDate: toLocalISO(new Date()), sortOrder: 0 },
    { uid: safeRandomUUID(), name: "DP", amount: DP_DEFAULT, dueDate: "", sortOrder: 1 },
    { uid: safeRandomUUID(), name: "Angsuran 1", amount: 0, dueDate: "", sortOrder: 2 },
    { uid: safeRandomUUID(), name: "Angsuran 2", amount: 0, dueDate: "", sortOrder: 3 },
    { uid: safeRandomUUID(), name: "Pelunasan 1", amount: 0, dueDate: "", sortOrder: 4 },
    { uid: safeRandomUUID(), name: "Pelunasan 2", amount: 0, dueDate: "", sortOrder: 5 },
    { uid: safeRandomUUID(), name: "Final", amount: 0, dueDate: "", sortOrder: 6 },
  ];
}

/** Kurangi `months` bulan dari `date` (clamp hari akhir bulan, mis. 31 Mar − 1 bln = 28/29 Feb). */
function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() - months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, lastDay));
  return d;
}

/**
 * Isi due date termin yang masih kosong, dihitung MUNDUR dari event date.
 * Termin terakhir (pelunasan) jatuh 1 bulan SEBELUM event; tiap termin di atasnya
 * mundur 1 bulan lagi. Kalau event terlalu mepet (termin awal jatuh sebelum hari
 * ini), fallback bagi rata dari hari ini s/d anchor (event − 1 bln) — biar tak ada
 * termin yang jatuh di masa lalu. Hanya create flow (edit pakai edit-top-drawer).
 *
 * Termin yang tanggalnya sudah diisi user dibiarkan, kecuali `force = true`.
 */
function recalcTermDates(terms: TermRow[], eventDate: string, force = false): TermRow[] {
  if (!eventDate || terms.length === 0) return terms;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);

  // Anchor = pelunasan harus lunas 1 bulan sebelum acara.
  const anchor = subMonths(event, 1);
  anchor.setHours(0, 0, 0, 0);
  if (anchor.getTime() <= now.getTime()) return terms; // event terlalu dekat — biarkan

  const n = terms.length;
  // Kandidat tanggal per termin (mundur 1 bln dari anchor). Index 0 = paling awal.
  const spaced = terms.map((_, i) => subMonths(anchor, n - 1 - i));
  // Kalau termin paling awal jatuh sebelum hari ini → mepet, pakai bagi rata.
  const tooTight = n > 1 && spaced[0].getTime() < now.getTime();
  const totalMs = anchor.getTime() - now.getTime();

  return terms.map((t, i) => {
    if (!force && t.dueDate) return t; // tanggal manual user — jangan timpa
    const date = tooTight
      ? new Date(now.getTime() + Math.round((totalMs * i) / (n - 1 || 1)))
      : spaced[i];
    return { ...t, dueDate: toLocalISO(date) };
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

// ─── localStorage helpers for wedding draft pointer ──────────────────────────

const WEDDING_DRAFT_LS_KEY = "swasana_wedding_draft_id";

function readWeddingDraftFromStorage(): string | null {
  try { return localStorage.getItem(WEDDING_DRAFT_LS_KEY); } catch { return null; }
}
function saveWeddingDraftToStorage(id: string) {
  try { localStorage.setItem(WEDDING_DRAFT_LS_KEY, id); } catch { /* noop */ }
}
function clearWeddingDraftFromStorage() {
  try { localStorage.removeItem(WEDDING_DRAFT_LS_KEY); } catch { /* noop */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingDrawer({ open, onOpenChange, onSuccess, prefillLead, initialDraftId, resumeDraftId }: BookingDrawerProps) {
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

  // ── Optimistic save state ──
  // Tracks whether a background save (step 2/3) is in-flight or has failed.
  // While hasPendingWriteError is true the Continue/Submit button is blocked.
  const [hasPendingWriteError, setHasPendingWriteError] = useState(false);
  const [pendingWriteErrorMsg, setPendingWriteErrorMsg] = useState<string | null>(null);
  // Guards the entire final-submit window (mutation + evidence upload + drawer close)
  // so the button stays disabled even after the mutation's isPending flips back to false.
  // Prevents a double-click from creating two bookings.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Holds the retry thunk for the last failed background save — calling it re-fires the save.
  const retryWriteRef = useRef<(() => Promise<void>) | null>(null);
  const { users: salesUsers } = useSalesUsers();
  const { user } = useCurrentUser();
  const { defaultSignature: myDefaultSignature } = useMySignature();

  // Sales auto-detect: salesUsers already contains both "sales" & "sales-mice"
  // roles, and s.id === profileId. If the logged-in user is in that list, lock
  // the sales field to themselves; admin/manager picks freely.
  const currentUserIsSales = !!user && salesUsers.some((s) => s.id === user.profileId);

  // Check for unfinished DB draft on open (only when not coming from prefillLead)
  const { data: unfinishedDraft } = useUnfinishedDraft(
    open && !prefillLead ? (user?.profileId ?? null) : null,
    "WEDDINGS",
  );

  // Full draft detail — fetched when user clicks "Lanjutkan" on resume prompt.
  // pendingResumeDraftId drives the query; once data arrives we prefill & clear.
  const [pendingResumeDraftId, setPendingResumeDraftId] = useState<string | null>(null);
  const { data: resumeDraftDetail } = useDraftBookingDetail(pendingResumeDraftId);

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;

  const sigSalesRef = useRef<SignatureCanvas>(null);
  const [signatureSales, setSignatureSales] = useState("");
  const [useDefaultSignature, setUseDefaultSignature] = useState(false);
  const [signingLocation, setSigningLocation] = useState("");
  const [specialBonusName, setSpecialBonusName] = useState("Discount");
  const [specialBonusAmount, setSpecialBonusAmount] = useState(0);
  const [contactNumbers, setContactNumbers] = useState<MobileNumberEntry[]>([]);
  const [contactInput, setContactInput] = useState({ name: "", phone: "" });
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [contactEmailCpp, setContactEmailCpp] = useState("");
  const [contactEmailCpw, setContactEmailCpw] = useState("");
  const [contactNikCpp, setContactNikCpp] = useState("");
  const [contactNikCpw, setContactNikCpw] = useState("");
  const [contactIdTypeCpp, setContactIdTypeCpp] = useState<"KTP" | "Paspor">("KTP");
  const [contactIdTypeCpw, setContactIdTypeCpw] = useState<"KTP" | "Paspor">("KTP");
  const [contactCppAddress, setContactCppAddress] = useState("");
  const [contactCpwAddress, setContactCpwAddress] = useState("");
  const [contactBitrixId, setContactBitrixId] = useState("");
  const [noteDateEvent, setNoteDateEvent] = useState("");
  const [time, setTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
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
    queryFn: () => fetchJson<{ items: LeadOption[] }>(`/api/daily-activity?search=${encodeURIComponent(debouncedSearch)}&pageSize=5`),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30_000,
  });
  const leadOptions = leadsResult?.items ?? [];
  const { data: venues = [] } = useQuery({ queryKey: ["venues"], queryFn: () => fetchJson<Option[]>("/api/venues"), staleTime: 5 * 60_000 });
  const { data: sourceOptions = [] } = useQuery({ queryKey: ["source-of-informations"], queryFn: () => fetchJson<Option[]>("/api/source-of-informations"), staleTime: 5 * 60_000 });
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

  // Step "Item Paket": editable package items (prefilled from template on package pick).
  const [packageInternalItems, setPackageInternalItems] = useState<PackageInternalItemDraft[]>([]);
  const [packageVendorItems, setPackageVendorItems] = useState<PackageVendorItemDraft[]>([]);
  const [packageItemsTab, setPackageItemsTab] = useState<"internal" | "vendor">("internal");
  // Guard: once the user edits items, don't clobber them by re-prefilling from the
  // template when the package effect re-runs (or when resuming a draft).
  const packageItemsDirtyRef = useRef(false);

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

  // Vendor bonus UI deprecated (diganti Complimentary). `bonuses` dipreserve (selalu []) agar payload tetap konsisten.
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);

  // New complimentary state (replaces vendor-based bonus in booking drawer UI)
  const [complimentaries, setComplimentaries] = useState<ComplimentaryRow[]>([]);
  // "none" = collapsed button | "picker" = SearchableSelect dropdown | "create-new" = inline mini-form
  const [complimentaryMode, setComplimentaryMode] = useState<"none" | "picker" | "create-new">("none");
  // Tracks which complimentary rows are collapsed (by c.id). Default = none → all open.
  const [collapsedComplimentaries, setCollapsedComplimentaries] = useState<Set<string>>(new Set());
  // Inline "buat baru" form state
  const [createNewComp, setCreateNewComp] = useState({ name: "", price: 0, description: "", isShowPrice: false });
  const [isCreatingComp, setIsCreatingComp] = useState(false);
  const { data: complimentaryResult } = useComplimentaries({ activeOnly: true, pageSize: 100 });
  const complimentaryOptions = complimentaryResult?.items ?? [];
  const { can: canPermission, isAdmin: isPermAdmin } = usePermissions();

  function toggleComplimentaryCollapse(id: string) {
    setCollapsedComplimentaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  const canCreateComplimentary = canPermission("complimentary", "create") || isPermAdmin;

  const [terms, setTerms] = useState<TermRow[]>(makeDefaultTerms);
  // Track COLLAPSED terms by uid (stable across drag-reorder) — default empty = semua kebuka
  const [collapsedTerms, setCollapsedTerms] = useState<Set<string>>(new Set());
  // Daftar pembayaran (opsional). Tiap entry menutup 1+ termin. Dikumpulin lokal —
  // booking belum punya DB id — lalu disimpan sebagai cash-in saat finalize.
  const [createPayments, setCreatePayments] = useState<CreatePaymentEntry[]>([]);
  // Guard: user has manually edited term amounts in step 3.
  // When true, allocatePrice will NOT override amounts[0] and [1] with the
  // BOOKING_FEE_DEFAULT / DP_DEFAULT constants — it preserves whatever the user typed.
  // Reset only when the package selection changes or the drawer is reset to clean.
  const [userHasCustomizedTerms, setUserHasCustomizedTerms] = useState(false);
  // When true: terms were loaded from a resumed draft — skip allocatePrice overwrite
  // and skip time auto-fill overwrite until the user explicitly changes session/type/package.
  // Reset to false on the first user interaction that would normally trigger those effects.
  const isResumedDraftRef = useRef(false);
  // Ref holding the most recent step-3 background save promise.
  // Before firing a new save we await the prior one (serialises saves, preventing
  // the deleteMany+create race that causes duplicate termOfPayment rows).
  const step3SaveInFlightRef = useRef<Promise<void> | null>(null);



  const form = useForm<BookingInput>({
    defaultValues: {
      eventDate: "", customerId: "", venueId: "", packageId: "",
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
    setBonuses([]); setComplimentaries([]); setCollapsedComplimentaries(new Set()); setComplimentaryMode("none"); setCreateNewComp({ name: "", price: 0, description: "", isShowPrice: false }); setIsCreatingComp(false); setTerms(makeDefaultTerms()); setCreatePayments([]);
    setCurrentStep(1); setSignatureSales(""); setSigningLocation(""); setUseDefaultSignature(false);
    setSpecialBonusName("Discount"); setSpecialBonusAmount(0);
    setContactNumbers([]); setContactEmailCpp(""); setContactEmailCpw(""); setContactNikCpp(""); setContactNikCpw(""); setContactIdTypeCpp("KTP"); setContactIdTypeCpw("KTP");
    setContactCppAddress(""); setContactCpwAddress(""); setContactBitrixId(""); setNoteDateEvent(""); setCustomerName(""); setSelectedLeadId("");
    setTakeoutPrices({}); setCategoryToggles({}); setTime("");
    setPackageInternalItems([]); setPackageVendorItems([]); setPackageItemsTab("internal");
    packageItemsDirtyRef.current = false;
    setDraftId(null);
    setPendingResumeDraftId(null);
    setHasPendingWriteError(false);
    setPendingWriteErrorMsg(null);
    retryWriteRef.current = null;
    // Reset term customisation guard so a fresh allocation runs on the next package pick.
    setUserHasCustomizedTerms(false);
    isResumedDraftRef.current = false;
    step3SaveInFlightRef.current = null;
    sigSalesRef.current?.clear();
    // Clear any leftover localStorage draft pointer
    clearWeddingDraftFromStorage();
    // Migrate any residual old-system localStorage artifacts
    clearLocalDraftArtifacts();
    setErrors({});
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validateField(field: BookingFieldKey, value: string) {
    const msg = validateBookingField(field, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) { next[field] = msg; } else { delete next[field]; }
      return next;
    });
  }

  function validateStep1(): boolean {
    const next: Record<string, string> = {};
    const cn_ = validateBookingField("customerName", customerName);
    if (cn_) next.customerName = cn_;
    const ec = validateBookingField("emailCpp", contactEmailCpp);
    if (ec) next.emailCpp = ec;
    const ew = validateBookingField("emailCpw", contactEmailCpw);
    if (ew) next.emailCpw = ew;
    const nc = validateIdNumber(contactIdTypeCpp, "CPP", contactNikCpp);
    if (nc) next.nikCpp = nc;
    const nw = validateIdNumber(contactIdTypeCpw, "CPW", contactNikCpw);
    if (nw) next.nikCpw = nw;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2(): boolean {
    const next: Record<string, string> = {};
    const v = validateBookingField("venueId", form.getValues("venueId") ?? "");
    if (v) next.venueId = v;
    const p = validateBookingField("packageId", form.getValues("packageId") ?? "");
    if (p) next.packageId = p;
    const d = validateBookingField("eventDate", form.getValues("eventDate") ?? "");
    if (d) next.eventDate = d;
    const s = validateBookingField("weddingSession", form.getValues("weddingSession") ?? "");
    if (s) next.weddingSession = s;
    const t = validateBookingField("weddingType", form.getValues("weddingType") ?? "");
    if (t) next.weddingType = t;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  useEffect(() => {
    if (open) {
      setComplimentaryMode("none");
      setShowResumePrompt(false);
      setHasPendingWriteError(false);
      setPendingWriteErrorMsg(null);
      setIsSubmitting(false);
      retryWriteRef.current = null;

      // Deal flow: initialDraftId injected — resume that draft, no resume prompt.
      // Prefill all steps from lead so the user can review from step 1 before proceeding.
      // Draft is already created by handleConfirmDeal in leads-table, so step 2 "Continue"
      // will update the existing draft (idempotency path) instead of creating a new one.
      if (initialDraftId) {
        resetToClean();
        setDraftId(initialDraftId);
        saveWeddingDraftToStorage(initialDraftId);
        // Prefill step 1 + step 2 form from lead
        if (prefillLead) {
          setCustomerName(prefillLead.name);
          setSelectedLeadId(prefillLead.leadId);
          form.setValue("customerId", "");
          const mappedNumbers = (prefillLead.contactNumbers ?? [])
            .map((e) => ({ name: e.label ?? "", number: e.number }))
            .filter((e) => e.number);
          setContactNumbers(mappedNumbers);
          setContactEmailCpp(prefillLead.email ?? "");
          setContactEmailCpw("");
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
          if (prefillLead.eventDate) form.setValue("eventDate", toDateOnly(new Date(prefillLead.eventDate)));

          // Prefill booking fee into terms[0] when the lead has received a booking fee.
          // Only override when bookingFeeAmount is provided (lead with isDateLocked=true);
          // otherwise keep makeDefaultTerms() default (5_000_000).
          if (prefillLead.bookingFeeAmount != null && prefillLead.bookingFeeAmount > 0) {
            setTerms((prev) => {
              const updated = [...prev];
              if (updated[0]) {
                updated[0] = {
                  ...updated[0],
                  amount: prefillLead.bookingFeeAmount!,
                  dueDate: prefillLead.bookingFeeDate ?? updated[0].dueDate,
                };
              }
              return updated;
            });
          }
        }
        // Start at step 1 so the user can review all data before proceeding.
        // The draft is already persisted, so step 2 "Continue" will update it
        // via the idempotency path in createDraftBooking.
        setCurrentStep(1);
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
        setContactEmailCpp(prefillLead.email ?? "");
        setContactEmailCpw("");
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
        if (prefillLead.eventDate) form.setValue("eventDate", toDateOnly(new Date(prefillLead.eventDate)));
        return;
      }

      // Resume from table: resumeDraftId injected by the table row click.
      // Bypass the in-drawer resume prompt — user already chose to resume.
      // Reuse the pendingResumeDraftId path so the existing resumeDraftDetail
      // useEffect does all the prefill + step navigation (data-driven, not forced).
      if (resumeDraftId) {
        resetToClean();
        setDraftId(resumeDraftId);
        saveWeddingDraftToStorage(resumeDraftId);
        setPendingResumeDraftId(resumeDraftId);
        return;
      }

      // Clean slate — check localStorage for a draft pointer from a previous session.
      // If found, it means the user had an active draft and refreshed the page.
      // We don't prefill form fields from localStorage (data stays in DB); we just
      // restore the draftId pointer so the resume prompt can offer to continue it.
      // The regular DB-based resume prompt (useUnfinishedDraft) will still fire and
      // is the authoritative source of truth — localStorage merely prevents the prompt
      // from disappearing when draftId is already set in state.
      resetToClean();
      const storedDraftId = readWeddingDraftFromStorage();
      if (storedDraftId) {
        // Set the draftId immediately so we skip re-creation on step 1 "Continue".
        // The resume prompt (showResumePrompt) will show via the unfinishedDraft effect.
        setDraftId(storedDraftId);
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show resume prompt when unfinished draft is found after drawer opens.
  // Also shows when localStorage restored a draftId (page refresh scenario) —
  // in that case draftId is already set but we still want to let the user choose
  // to continue or discard.
  // Skip if initialDraftId was injected by the Deal flow (that IS the draft to use
  // and the user already confirmed it from the Deal modal).
  // Also skip if resumeDraftId is set (user explicitly chose the draft from the table).
  useEffect(() => {
    if (open && !prefillLead && !initialDraftId && !resumeDraftId && unfinishedDraft) {
      setShowResumePrompt(true);
    }
  }, [open, prefillLead, initialDraftId, resumeDraftId, unfinishedDraft]);

  // Note: localStorage auto-save draft removed — DB-backed draft is created on Step 1 "Continue".
  // Draft ID is tracked in `draftId` state and updated per step.

  const getBasePrice = () => selectedPackagePrice;
  const getPriceAfterDiscount = () => Math.max(0, getBasePrice() - specialBonusAmount);
  const getTotalTerms = () => terms.reduce((s, t) => s + (t.amount || 0), 0);
  const getDifference = () => getTotalTerms() - getPriceAfterDiscount();

  // Booking Fee (index 0) and DP (index 1) start at their defaults; the
  // leftover (total − fee − dp) is split evenly across the remaining terms, with
  // the last term absorbing the rounding remainder.
  //
  // When `preserveFixed = true` (user has already customised term amounts in step 3),
  // amounts[0] and [1] are LEFT UNCHANGED — only the "rest" buckets are recalculated.
  // This prevents discount changes and step-2→3 transitions from overriding user edits.
  const allocatePrice = (price: number, discount: number, preserveFixed = false) => {
    const total = Math.max(0, price - discount);
    setTerms((prev) => {
      const n = prev.length || 1;
      // Fewer than 3 terms: no "rest" buckets — fall back to an even split
      // (only when not preserving, to avoid discarding the full total).
      if (n <= 2) {
        if (preserveFixed) return prev;
        const base = Math.floor(total / n);
        const remainder = total % n;
        return prev.map((t, i) => ({ ...t, amount: i === n - 1 ? base + remainder : base }));
      }
      // Determine the pinned amounts for Booking Fee and DP.
      // If preserving, keep whatever the user typed; otherwise apply the defaults
      // (capped so they never exceed the total).
      const fee = preserveFixed ? (prev[0]?.amount ?? BOOKING_FEE_DEFAULT) : Math.min(BOOKING_FEE_DEFAULT, total);
      const dp = preserveFixed ? (prev[1]?.amount ?? DP_DEFAULT) : Math.min(DP_DEFAULT, Math.max(0, total - fee));
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

  const [wVenueId, wPackageId, wBookingDate, wWeddingSession, wWeddingType, wSourceOfInformationId, wPaymentMethodId, wSalesId] = form.watch(["venueId", "packageId", "eventDate", "weddingSession", "weddingType", "sourceOfInformationId", "paymentMethodId", "salesId"]);
  // Name shown in the locked sales field — resolves from the current salesId.
  const lockedSalesName =
    salesUsers.find((s) => s.id === wSalesId)?.fullName ??
    (currentUserIsSales ? (user?.name ?? "—") : "—");
  const isBitrixSource = sourceOptions.find((o) => o.id === wSourceOfInformationId)?.name.toLowerCase().includes("bitrix") ?? false;
  // Step 1 complete: only client info fields (no venue/package)
  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0 && wSourceOfInformationId && (!isBitrixSource || contactBitrixId.trim()) && wSalesId);
  // Step 2 complete: venue + package + event date/session/type + time
  const isStep2Complete = !!(wVenueId && wPackageId && wBookingDate && wWeddingSession && wWeddingType && time.trim());

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

  // Step 3 complete: Item Paket — items are optional, so this step never blocks.
  const isStep3Complete = true;

  // Step 4 complete: takeout (at least one category must remain included)
  const isStep4Complete =
    visibleCategories.length === 0 ||
    visibleCategories.some((c) => !(categoryToggles[c.categoryName] ?? false));

  // Step 5 complete: term of payments — TOP is schedule-only (jadwal + discount).
  // Completeness judged on the balance/dueDate rules; payment recording moves to step 6.
  const isStep5Complete =
    getBasePrice() === 0 || (
      (terms[0]?.amount ?? 0) > 0 &&
      getDifference() === 0 &&
      terms.every((t) => !!t.dueDate)
    );
  // Step 6 complete: booking fee (termin pertama) sudah tertutup oleh salah satu
  // pembayaran yang dicatat (payment menunjuk ke uid termin pertama).
  const firstTermUid = terms[0]?.uid;
  const isStep6Complete =
    !!firstTermUid &&
    (terms[0]?.amount ?? 0) > 0 &&
    createPayments.some((p) => p.amount > 0 && !!p.paymentMethodId && p.termUids.includes(firstTermUid));
  // Step 7 complete: signing location (+ signature when user IS the sales)
  const isStep7Complete = !!signingLocation.trim() && (!currentUserIsSales || !!signatureSales);

  // Recalc term dates when event date changes
  useEffect(() => {
    if (wBookingDate) setTerms((prev) => recalcTermDates(prev, wBookingDate));
  }, [wBookingDate]);

  // Resolve package price once packages load for a prefilled package (price
  // starts at 0 because the lead only carries the package id, not its pricing).
  // GUARD: when resuming a draft, skip allocatePrice so draft terms are NOT overwritten.
  useEffect(() => {
    if (!selectedPackageId || selectedPackagePrice > 0 || packages.length === 0) return;
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (pkg) {
      const p = getPackagePrice(pkg);
      setSelectedPackagePrice(p);
      setOriginalPackagePrice(p);
      // Skip allocation when terms are already loaded from a resumed draft
      if (!isResumedDraftRef.current) {
        allocatePrice(p, specialBonusAmount);
        setLastAllocatedPrice(p);
      } else {
        // Still track lastAllocatedPrice so step 2→3 advance doesn't re-trigger allocation
        setLastAllocatedPrice(p);
      }
    }
  }, [packages, selectedPackageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill "Item Paket" step from the selected package template. Skips when the
  // user has already edited the items (dirty) or when resuming a draft (items are
  // restored from the draft instead). Runs on explicit package selection.
  useEffect(() => {
    if (!selectedPackageId || packages.length === 0) return;
    if (packageItemsDirtyRef.current || isResumedDraftRef.current) return;
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (!pkg) return;
    setPackageInternalItems(
      (pkg.internalItems ?? []).map((i) => ({
        uid: safeRandomUUID(),
        itemName: i.itemName,
        itemDescription: i.itemDescription,
      })),
    );
    setPackageVendorItems(
      (pkg.vendorItems ?? []).map((i) => ({
        uid: safeRandomUUID(),
        categoryId: i.categoryId ?? null,
        categoryName: i.categoryName,
        itemText: i.itemText,
      })),
    );
  }, [packages, selectedPackageId]);

  // Auto-fill time dari session + weddingType (weddings only, R/AR saja)
  // GUARD: when resuming a draft, time is already set from draft — skip auto-fill
  // so the draft's eventTime is not overwritten by the session+type combination.
  // The guard is cleared on explicit package/session/type changes by the user.
  useEffect(() => {
    if (isResumedDraftRef.current) return;
    const mappedType = mapWeddingTypeToEventType(wWeddingType ?? null);
    const autoTime = getWeddingTimeRange(
      (wWeddingSession as WeddingSession | "") ?? "",
      mappedType,
    );
    if (autoTime) {
      setTime(autoTime);
    }
  }, [wWeddingSession, wWeddingType]);

  // Force-assign the sales field to the logged-in sales user (covers salesUsers
  // loading after the open/draft reset, and re-applies if it gets cleared).
  useEffect(() => {
    if (open && currentUserIsSales && user?.profileId && wSalesId !== user.profileId) {
      form.setValue("salesId", user.profileId);
    }
  }, [open, currentUserIsSales, user?.profileId, wSalesId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When resumeDraftDetail arrives (user clicked "Lanjutkan"), prefill ALL fields
  // from the draft's stored data + Customer relation, then advance to step 2.
  // Sets isResumedDraftRef = true so allocatePrice and time auto-fill effects are
  // suppressed until the user makes a new intentional change.
  useEffect(() => {
    if (!resumeDraftDetail || !pendingResumeDraftId) return;

    // Mark as resumed BEFORE setting state so the guards in allocatePrice/time effects
    // are active when React processes those state updates.
    isResumedDraftRef.current = true;

    // Set draft ID so subsequent steps update the correct draft
    setDraftId(resumeDraftDetail.id);

    // ── Step 1 form fields ──
    if (resumeDraftDetail.venueId) {
      setSelectedVenueId(resumeDraftDetail.venueId);
      form.setValue("venueId", resumeDraftDetail.venueId);
    }
    if (resumeDraftDetail.packageId) {
      form.setValue("packageId", resumeDraftDetail.packageId);
      setSelectedPackageId(resumeDraftDetail.packageId);
    }
    if (resumeDraftDetail.weddingSession) {
      form.setValue("weddingSession", resumeDraftDetail.weddingSession as "morning" | "evening" | "fullday");
    }
    if (resumeDraftDetail.weddingType) {
      form.setValue("weddingType", resumeDraftDetail.weddingType);
    }
    if (resumeDraftDetail.sourceOfInformationId) {
      form.setValue("sourceOfInformationId", resumeDraftDetail.sourceOfInformationId);
    }
    // eventDate
    if (resumeDraftDetail.eventDate) {
      form.setValue("eventDate", resumeDraftDetail.eventDate);
    }
    // customerId
    if (resumeDraftDetail.customerId) {
      form.setValue("customerId", resumeDraftDetail.customerId);
    }
    // Sales: only prefill if current user is not a locked sales user
    if (!currentUserIsSales && resumeDraftDetail.salesId) {
      form.setValue("salesId", resumeDraftDetail.salesId);
    }
    // eventTime — set always (even empty string) to explicitly override auto-fill
    setTime(resumeDraftDetail.eventTime ?? "");
    // notes
    setNoteDateEvent(resumeDraftDetail.notes ?? "");
    // customerName
    if (resumeDraftDetail.customerName) {
      setCustomerName(resumeDraftDetail.customerName);
    }

    // ── Customer contact fields — set explicitly (even empty) for symmetry ──
    // Pattern: always set, never conditional on truthy, so CPW fields are
    // cleared to "" if they're null (form was reset to clean before this runs).
    setContactNumbers(resumeDraftDetail.contactNumbers);
    setContactEmailCpp(resumeDraftDetail.contactEmailCpp ?? "");
    setContactEmailCpw(resumeDraftDetail.contactEmailCpw ?? "");
    setContactNikCpp(resumeDraftDetail.contactNikCpp ?? "");
    setContactNikCpw(resumeDraftDetail.contactNikCpw ?? "");
    setContactIdTypeCpp((resumeDraftDetail.contactIdTypeCpp ?? "KTP") as "KTP" | "Paspor");
    setContactIdTypeCpw((resumeDraftDetail.contactIdTypeCpw ?? "KTP") as "KTP" | "Paspor");
    setContactCppAddress(resumeDraftDetail.contactCppAddress ?? "");
    setContactCpwAddress(resumeDraftDetail.contactCpwAddress ?? "");
    setContactBitrixId(resumeDraftDetail.contactBitrixId ?? "");

    // ── Step 3: discountName / discountAmount ──
    setSpecialBonusName(resumeDraftDetail.discountName ?? "Discount");
    setSpecialBonusAmount(resumeDraftDetail.discountAmount ?? 0);

    // ── Step 3: paymentMethodId ──
    if (resumeDraftDetail.paymentMethodId) {
      form.setValue("paymentMethodId", resumeDraftDetail.paymentMethodId);
    }

    // ── Step 3: term of payments from DB ──
    if (resumeDraftDetail.termOfPayments.length > 0) {
      setTerms(resumeDraftDetail.termOfPayments.map((t) => ({
        uid: safeRandomUUID(),
        name: t.name,
        amount: t.amount,
        dueDate: t.dueDate,
        sortOrder: t.sortOrder,
        termId: t.id,
      })));
      // Mark terms as user-customized so future allocatePrice calls use preserveFixed
      setUserHasCustomizedTerms(true);
    }

    // ── Step 2: categoryToggles + takeoutPrices from draft ──
    if (resumeDraftDetail.draftCategoryToggles.length > 0) {
      const toggleMap: Record<string, boolean> = {};
      const priceMap: Record<string, number> = {};
      for (const t of resumeDraftDetail.draftCategoryToggles) {
        toggleMap[t.categoryName] = t.isTakeout;
        if (t.isTakeout && t.takeoutNominal > 0) {
          priceMap[t.categoryName] = t.takeoutNominal;
        }
      }
      setCategoryToggles(toggleMap);
      setTakeoutPrices(priceMap);
    }

    // ── Step 2: complimentaries from draft ──
    if (resumeDraftDetail.draftComplimentaries.length > 0) {
      setComplimentaries(resumeDraftDetail.draftComplimentaries.map((c) => ({
        id: crypto.randomUUID(),
        complimentaryId: c.complimentaryId ?? null,
        name: c.name,
        price: c.price,
        isShowPrice: c.isShowPrice,
        description: c.description ?? "",
        qty: c.qty,
      })));
    }

    // ── Step 3: package items from draft (fall back to template prefill effect
    // when the draft carries none, e.g. an older draft created before this step). ──
    if (resumeDraftDetail.draftInternalItems.length > 0 || resumeDraftDetail.draftVendorItems.length > 0) {
      packageItemsDirtyRef.current = true;
      setPackageInternalItems(resumeDraftDetail.draftInternalItems.map((i) => ({
        uid: safeRandomUUID(),
        itemName: i.itemName,
        itemDescription: i.itemDescription,
      })));
      setPackageVendorItems(resumeDraftDetail.draftVendorItems.map((i) => ({
        uid: safeRandomUUID(),
        categoryId: i.categoryId ?? null,
        categoryName: i.categoryName,
        itemText: i.itemText,
      })));
    }

    // ── Step 6: signingLocation + withMaterai ──
    if (resumeDraftDetail.signingLocation) {
      setSigningLocation(resumeDraftDetail.signingLocation);
    }
    // withMaterai lives in the form
    form.setValue("withMaterai", resumeDraftDetail.withMaterai ?? false);

    // Clear pending flag so this effect doesn't run again on unrelated re-renders
    setPendingResumeDraftId(null);
    // If the draft already has a package, skip to step 3 (Takeout);
    // otherwise resume at step 2 (Venue & Paket) so user can complete it.
    setCurrentStep(resumeDraftDetail.packageId ? 3 : 2);
    toast.info("Draft dilanjutkan. Semua data berhasil dipulihkan.");
  }, [resumeDraftDetail]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Save succeeded — clear any previously recorded error
      setHasPendingWriteError(false);
      setPendingWriteErrorMsg(null);
      retryWriteRef.current = null;
    } catch {
      // First failure → retry once automatically
      try {
        await attempt();
        setHasPendingWriteError(false);
        setPendingWriteErrorMsg(null);
        retryWriteRef.current = null;
      } catch (err2) {
        // Both attempts failed — surface error and block continue
        const msg = err2 instanceof Error ? err2.message : errorLabel;
        setHasPendingWriteError(true);
        setPendingWriteErrorMsg(msg);
        // Store retry thunk so the user can re-trigger by clicking Continue again
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
        toast.error(`Gagal menyimpan: ${msg}. Perbaiki koneksi dan coba Continue lagi.`);
      }
    }
  }

  // Single source of truth for the step-2 draft payload (package/takeout data +
  // complimentaries + editable package items). Reused across step 2→3, 3→4, 4→5
  // background saves so package items are never dropped on any advance.
  const buildStep2Payload = () => ({
    packageId: form.getValues("packageId") || null,
    specialBonusName: specialBonusName || null,
    specialBonusAmount: specialBonusAmount || null,
    categoryToggles: allCategoryPrices.map((c) => ({
      categoryName: c.categoryName,
      isTakeout: c.isShow ? (categoryToggles[c.categoryName] ?? false) : false,
      takeoutNominal: c.isShow && (categoryToggles[c.categoryName] ?? false)
        ? (takeoutPrices[c.categoryName] ?? c.basePrice)
        : 0,
    })),
    draftComplimentaries: complimentaries.map((c) => ({
      complimentaryId: c.complimentaryId ?? null,
      name: c.name,
      price: c.price,
      isShowPrice: c.isShowPrice,
      description: c.description || null,
      qty: c.qty,
    })),
    draftInternalItems: packageInternalItems
      .filter((i) => i.itemName.trim())
      .map((i) => ({ itemName: i.itemName, itemDescription: i.itemDescription })),
    draftVendorItems: packageVendorItems
      .filter((i) => i.categoryName.trim() && i.itemText.trim())
      .map((i) => ({ categoryId: i.categoryId, categoryName: i.categoryName, itemText: i.itemText })),
  });

  const handleNext = async () => {
    // If a prior background save failed, clicking Continue fires the retry instead
    // of advancing. This ensures the blocked step resolves before we move on.
    if (hasPendingWriteError && retryWriteRef.current) {
      await retryWriteRef.current();
      return;
    }

    // ── Step 1 → 2: Client info only, no DB write yet ──
    if (currentStep === 1 && !isStep1Complete) {
      if (!wSalesId) { toast.error("Sales PIC wajib dipilih."); return; }
      if (!wSourceOfInformationId) { toast.error("Sumber informasi wajib diisi."); return; }
      if (isBitrixSource && !contactBitrixId.trim()) { toast.error("Bitrix ID wajib diisi jika sumber informasi adalah Bitrix."); return; }
      toast.error("Lengkapi field yang wajib diisi terlebih dahulu.");
      return;
    }

    if (currentStep === 1) {
      if (!validateStep1()) { toast.error("Perbaiki isian yang tidak valid."); return; }
      setCurrentStep(2);
      return;
    }

    // ── Step 2 → 3: Create DB draft (await — first DB write with full client+venue+package data) ──
    if (currentStep === 2 && !isStep2Complete) {
      if (!wVenueId) { toast.error("Venue wajib dipilih."); return; }
      if (!wPackageId) { toast.error("Paket wajib dipilih."); return; }
      if (!wBookingDate) { toast.error("Tanggal event wajib diisi."); return; }
      if (!wWeddingSession) { toast.error("Session event wajib dipilih."); return; }
      if (!wWeddingType) { toast.error("Event type wajib dipilih."); return; }
      if (!time.trim()) { toast.error("Waktu event wajib diisi."); return; }
      toast.error("Lengkapi field venue & paket terlebih dahulu.");
      return;
    }

    if (currentStep === 2 && !validateStep2()) { toast.error("Perbaiki isian yang tidak valid."); return; }

    if (currentStep === 2) {
      // Build the full payload combining client (step 1) + venue/package (step 2) data.
      // createDraftBooking is called here (first DB write) so the draft always has
      // both customer and package data when persisted.
      const pendingDraftId = draftId ?? safeRandomUUID();

      if (!isCreatingDraftRef.current) {
        isCreatingDraftRef.current = true;
        const draftPayload = {
          id: pendingDraftId,
          eventDate: form.getValues("eventDate"),
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
          contactEmailCpp,
          contactEmailCpw,
          contactNikCpp,
          contactNikCpw,
          contactIdTypeCpp,
          contactIdTypeCpw,
          contactCppAddress,
          contactCpwAddress,
          contactBitrixId: isBitrixSource ? contactBitrixId : "",
          eventTime: time || null,
          notes: noteDateEvent || null,
          specialBonusName: specialBonusName || null,
          specialBonusAmount: specialBonusAmount || null,
        };

        const result = await createDraftMut.mutateAsync(draftPayload).finally(() => {
          isCreatingDraftRef.current = false;
        });
        if (!result.success) { toast.error(result.error ?? "Gagal membuat draft."); return; }
        const confirmedDraftId = result.draftId ?? pendingDraftId;
        setDraftId(confirmedDraftId);
        saveWeddingDraftToStorage(confirmedDraftId);

        // Persist current step-2 data (complimentaries + prefilled package items) to
        // draft in background so nothing is lost if the user closes before finalize.
        void backgroundSave(
          () => updateStep2Mut.mutateAsync({ draftId: confirmedDraftId, data: buildStep2Payload() }),
          "Gagal menyimpan data paket",
        );
      }

      setCurrentStep(3);
      return;
    }

    // ── Step 3 → 4: Item Paket — persist edited package items, advance to takeout ──
    if (currentStep === 3) {
      // Advance immediately (optimistic) — items are optional.
      setCurrentStep(4);

      if (draftId) {
        const capturedDraftId = draftId;
        void backgroundSave(
          () => updateStep2Mut.mutateAsync({ draftId: capturedDraftId, data: buildStep2Payload() }),
          "Gagal menyimpan item paket",
        );
      }
      return;
    }

    // ── Step 4 → 5: Takeout — optimistic advance, save takeout data in background ──
    if (currentStep === 4 && !isStep4Complete) {
      toast.error("Minimal satu kategori harus tetap included.");
      return;
    }

    if (currentStep === 4) {
      setSelectedPackagePrice(step2Price);
      // Clear the resume guard: the user is now actively editing, so future
      // package/session changes should trigger allocatePrice normally.
      isResumedDraftRef.current = false;
      if (step2Price !== lastAllocatedPrice) {
        allocatePrice(step2Price, specialBonusAmount, userHasCustomizedTerms);
        setLastAllocatedPrice(step2Price);
      }

      // Ensure all terms have a dueDate before entering the TOP step.
      // allocatePrice above only updates amounts (spread ...t preserves dueDate).
      // The recalcTermDates effect fires when wBookingDate changes, but may not
      // have run yet if the user changed eventDate and the component hasn't re-rendered,
      // or if allocatePrice replaced the terms array before the effect could apply.
      // Calling recalcTermDates here guarantees every term with an empty dueDate
      // gets a date spread between today and the event date — force=false so any
      // date the user already set manually (or Booking Fee = today) is untouched.
      // Resume-draft terms already have dates in DB → they are not empty → also untouched.
      if (wBookingDate) {
        setTerms((prev) => recalcTermDates(prev, wBookingDate));
      }

      // Advance immediately (optimistic)
      setCurrentStep(5);

      if (draftId) {
        const capturedDraftId = draftId;
        void backgroundSave(
          () => updateStep2Mut.mutateAsync({ draftId: capturedDraftId, data: buildStep2Payload() }),
          "Gagal menyimpan data paket",
        );
      }

      return;
    }

    // ── Step 5 → 6: Term of Payments (jadwal murni) ──────────────────────────
    // TOP = jadwal + discount. Step-5 hanya validasi jadwal + simpan draft
    // (nama/nominal/tanggal). Pencatatan pembayaran (cash-in) dilakukan di step 6
    // (Payment) dan disimpan saat finalize.
    if (currentStep === 5) {
      const firstTerm = terms[0];
      if (!firstTerm || !firstTerm.amount || firstTerm.amount <= 0) {
        toast.error("Nominal term pertama (Booking Fee) wajib diisi dan harus lebih dari 0.");
        return;
      }
      const diff = getDifference();
      if (getBasePrice() > 0 && diff !== 0) {
        toast.error(`Total term (Rp${fmtRp(getTotalTerms())}) tidak sama dengan harga setelah discount (Rp${fmtRp(getPriceAfterDiscount())}). Selisih: Rp${fmtRp(Math.abs(diff))}`);
        return;
      }

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
          })),
        };
        const capturedDraftId = draftId;

        // Simpan step-3 di background — advance ke step-6 (Payment) tak perlu menunggu.
        const prev = step3SaveInFlightRef.current;
        const savePromise = backgroundSave(
          async () => {
            if (prev) await prev.catch(() => undefined);
            return updateStep3Mut.mutateAsync({ draftId: capturedDraftId, data: step3Payload });
          },
          "Gagal menyimpan term of payment",
        );
        step3SaveInFlightRef.current = savePromise;
      }

      setCurrentStep(6);
      return;
    }

    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      if (currentStep === 7) { sigSalesRef.current?.clear(); setSignatureSales(""); setUseDefaultSignature(false); }
      setCurrentStep(currentStep - 1);
    }
  };

  // Wrapper: blocks re-entry and keeps the submit button disabled across the
  // whole flow (mutation + evidence upload + close), not just while the
  // mutation isPending. On success the drawer closes; on failure we re-enable.
  async function onSubmit(values: BookingInput): Promise<void> {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await runSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runSubmit(values: BookingInput): Promise<void> {
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

      // Pembayaran (opsional) → cash-in yang tercatat saat booking dibuat. Tiap entry
      // menutup 1+ termin; nominal dialokasi greedy berurutan (termUids). Alokasi
      // dikirim by sortOrder (server resolve termId dari sortOrder). Bukti di-upload
      // dulu (kalau ada) — gagal upload non-fatal (lanjut tanpa bukti).
      const payments: {
        occurredAt: string;
        amount: number;
        paymentMethodId: string | null;
        discountProgramId: string | null;
        discountAmount: number;
        notes: string | null;
        allocations: { sortOrder: number; amount: number; showInPo: boolean }[];
        evidence: string | null;
      }[] = [];
      const termByUid = new Map(terms.map((t) => [t.uid, t]));
      for (const p of createPayments) {
        if (p.amount <= 0 || !p.paymentMethodId || p.termUids.length === 0) continue;
        let evidence: string | null = null;
        if (p.evidenceFile) {
          const fd = new FormData();
          fd.append("file", p.evidenceFile);
          // User sengaja melampirkan bukti — kalau upload gagal JANGAN diam-diam
          // lanjut tanpa bukti. Tampilkan alasannya (403 izin / 413 file kegedean /
          // 500 storage) lalu batalkan finalize biar tidak ada pembayaran tercatat
          // tanpa bukti yang dikira sukses.
          try {
            const up = await fetch("/api/upload/booking-fee-evidence", { method: "POST", body: fd });
            if (up.ok) {
              const d = (await up.json()) as { key?: string };
              evidence = d.key ?? null;
            } else {
              const d = (await up.json().catch(() => ({}))) as { error?: string };
              toast.error(d.error ?? `Gagal upload bukti (${up.status}).`);
              return;
            }
          } catch {
            toast.error("Gagal upload bukti — periksa koneksi lalu coba lagi.");
            return;
          }
        }
        // Greedy allocation over the selected terms (in selection order). Flag PO
        // per-alokasi dari poTermUids (termin yang di-toggle tampil di Summary PO).
        const allocations: { sortOrder: number; amount: number; showInPo: boolean }[] = [];
        let budget = p.amount;
        for (const uid of p.termUids) {
          if (budget <= 0) break;
          const t = termByUid.get(uid);
          if (!t) continue;
          const amt = Math.min(t.amount, budget);
          if (amt > 0) {
            allocations.push({ sortOrder: t.sortOrder, amount: amt, showInPo: p.poTermUids.includes(uid) });
            budget -= amt;
          }
        }
        payments.push({
          occurredAt: p.occurredAt,
          amount: p.amount,
          paymentMethodId: p.paymentMethodId || null,
          discountProgramId: p.programId ?? null,
          discountAmount: p.discountAmount,
          notes: p.notes.trim() || null,
          allocations,
          evidence,
        });
      }

      const finalizePayload = {
        draftId,
        signingLocation: signingLocation || null,
        signatureSales: signatureSales || null,
        withMaterai: values.withMaterai ?? false,
        leadId: selectedLeadId || null,
        payments,
        bonuses: bonuses.map((b) => ({
          vendorId: b.vendorId,
          vendorCategoryId: b.vendorCategoryId,
          vendorName: b.vendorName,
          description: b.description || null,
          qty: b.qty,
          nominal: b.nominal,
        })),
        complimentaries: complimentaries.map((c, i) => ({
          complimentaryId: c.complimentaryId ?? null,
          name: c.name,
          price: c.price,
          isShowPrice: c.isShowPrice,
          description: c.description || null,
          qty: c.qty,
          sortOrder: i,
        })),
        categoryToggles: allCategoryPrices.map((c) => {
          const isTakeout = c.isShow ? (categoryToggles[c.categoryName] ?? false) : false;
          return {
            categoryName: c.categoryName,
            basePrice: c.basePrice,
            sortOrder: c.sortOrder,
            isShow: c.isShow,
            isTakeout,
            takeoutNominal: isTakeout ? (takeoutPrices[c.categoryName] ?? c.basePrice) : 0,
          };
        }),
      };

      const result = await finalizeMut.mutateAsync(finalizePayload);
      if (!result.success) { toast.error(result.error ?? "Gagal memfinalisasi booking."); return; }

      clearLocalDraftArtifacts();
      clearWeddingDraftFromStorage();
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
      contactEmailCpp,
      contactEmailCpw,
      contactNikCpp,
      contactNikCpw,
      contactIdTypeCpp,
      contactIdTypeCpw,
      contactCppAddress,
      contactCpwAddress,
      contactBitrixId: isBitrixSource ? contactBitrixId : "",
      specialBonusName: specialBonusName || null,
      specialBonusAmount: specialBonusAmount || null,
      signingLocation: signingLocation || null,
      signatureSales: signatureSales || null,
      leadId: selectedLeadId || null,
      bonuses: bonuses.map((b) => ({ vendorId: b.vendorId, vendorCategoryId: b.vendorCategoryId, vendorName: b.vendorName, description: b.description || null, qty: b.qty, nominal: b.nominal })),
      complimentaries: complimentaries.map((c, i) => ({ complimentaryId: c.complimentaryId ?? null, name: c.name, price: c.price, isShowPrice: c.isShowPrice, description: c.description || null, qty: c.qty, sortOrder: i })),
      termOfPayments: terms.filter((t) => t.dueDate).map((t) => ({ name: t.name, amount: t.amount, dueDate: t.dueDate, sortOrder: t.sortOrder })),
      categoryToggles: allCategoryPrices.map((c) => {
        const isTakeout = c.isShow ? (categoryToggles[c.categoryName] ?? false) : false;
        return {
          categoryName: c.categoryName,
          basePrice: c.basePrice,
          sortOrder: c.sortOrder,
          isShow: c.isShow,
          isTakeout,
          takeoutNominal: isTakeout ? (takeoutPrices[c.categoryName] ?? c.basePrice) : 0,
        };
      }),
    };
    const result = await createMut.mutateAsync(payload);
    if (!result.success) { toast.error(result.error); return; }

    clearLocalDraftArtifacts();
    clearWeddingDraftFromStorage();
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

  // Continue is disabled if:
  // - The current step's required fields aren't complete (step 1/2/3/4 completeness checks)
  // - A mutation is in-flight (step 1 is await, finalize is await)
  // - hasPendingWriteError: a background save failed and hasn't been retried successfully.
  //   When this flag is set, clicking Continue fires the retry instead of advancing.
  const isContinueDisabled =
    (currentStep === 1 && !isStep1Complete) ||
    (currentStep === 2 && !isStep2Complete) ||
    (currentStep === 3 && !isStep3Complete) ||
    (currentStep === 4 && !isStep4Complete) ||
    (currentStep === 5 && !isStep5Complete) ||
    (currentStep === 6 && !isStep6Complete) ||
    (currentStep === 7 && !isStep7Complete) ||
    (currentStep === 2 && isDraftMutating) ||
    (currentStep === 7 && isDraftMutating) ||
    (currentStep === 7 && isSubmitting);

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
                  // Clear localStorage pointer and draftId so a new draft is created
                  clearWeddingDraftFromStorage();
                  setDraftId(null);
                  // Old draft stays in DB and will be cleaned up by cron
                }}
              >
                Mulai Baru
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowResumePrompt(false);
                  // Persist the draft pointer to localStorage so a page refresh keeps it
                  saveWeddingDraftToStorage(unfinishedDraft.id);
                  setDraftId(unfinishedDraft.id);
                  // Trigger full detail fetch via getDraftBookingDetail server action.
                  // useEffect on resumeDraftDetail will prefill ALL step 1 fields
                  // (including contactNumbers, email, NIK, address, bitrixId from Customer relation)
                  // once the query resolves, then advance to step 2.
                  setPendingResumeDraftId(unfinishedDraft.id);
                  toast.info("Memuat data draft...");
                }}
              >
                Lanjutkan
              </Button>
            </div>
          </div>
        )}

        <div className={cn('flex-1', 'overflow-y-auto', 'px-2', showResumePrompt ? 'hidden' : '')}>
          <Form {...form}>
            <form
              className="space-y-4"
              onKeyDown={(e) => {
                // Enter must NOT advance the wizard or submit — the user moves on
                // only by clicking Continue. We still block the browser's native
                // form submission (buttons default to type="submit"), so Enter is a
                // no-op here. Excluded: shift+Enter and Enter inside a textarea or a
                // combobox/select (role="option"/"listbox"), which need it themselves.
                if (e.key !== "Enter" || e.shiftKey) return;
                const target = e.target as HTMLElement;
                if (target.tagName === "TEXTAREA") return;
                if (target.closest("[role='listbox']") || target.closest("[role='option']")) return;
                e.preventDefault();
              }}
            >
              {/* ─── Step 1: Data Booking ─── */}
              {currentStep === 1 && (
                <div className="space-y-4">

                  {/* Card 1: Identitas Client */}
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Identitas Client</p>

                  {/* Customer / Lead selector */}
                  <div ref={customerDropdownRef}>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Customer Name <span className="text-destructive">*</span></FormLabel>
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
                          clearError("customerName");
                        }}
                        onBlur={() => validateField("customerName", customerName)}
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
                                    if (lead.email) { setContactEmailCpp(lead.email); setContactEmailCpw(""); }
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
                                  {lead.email && <p className="text-xs text-muted-foreground truncate">{lead.email}</p>}
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
                                    if (c.emailCpp) setContactEmailCpp(c.emailCpp);
                                    if (c.emailCpw) setContactEmailCpw(c.emailCpw);
                                    if (c.cppNik) setContactNikCpp(c.cppNik);
                                    if (c.cpwNik) setContactNikCpw(c.cpwNik);
                                    setContactIdTypeCpp((c.cppIdType as "KTP" | "Paspor") ?? "KTP");
                                    setContactIdTypeCpw((c.cpwIdType as "KTP" | "Paspor") ?? "KTP");
                                    setContactCppAddress(c.cppAddress ?? "");
                                    setContactCpwAddress(c.cpwAddress ?? "");
                                    if (c.bitrixId) setContactBitrixId(c.bitrixId);
                                    if (c.sourceOfInformationId) form.setValue("sourceOfInformationId", c.sourceOfInformationId);
                                    setCustomerDropdownOpen(false);
                                  }}
                                >
                                  <p className="font-medium">{c.name}</p>
                                  {(c.emailCpp ?? c.emailCpw) && <p className="text-xs text-muted-foreground truncate">{c.emailCpp ?? c.emailCpw}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {errors.customerName && <p className="mt-1 text-sm text-destructive">{errors.customerName}</p>}
                  </div>

                  {/* Contact Person */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Contact Person <span className="text-destructive">*</span></FormLabel>
                    <div className={cn('mt-1', 'rounded-lg', 'bg-muted', 'p-3', 'space-y-2')}>
                      {contactNumbers.map((entry, idx) => (
                        <div key={idx} className={cn('flex', 'items-center', 'gap-2', 'rounded-md', 'bg-background', 'border', 'px-3', 'py-2')}>
                          <div className={cn('flex-1', 'min-w-0')}>
                            {entry.name && <p className={cn('text-xs', 'text-muted-foreground')}>{entry.name}</p>}
                            <p className={cn('text-sm', 'font-medium')}>+{entry.number}</p>
                          </div>
                          <button type="button" className={cn('shrink-0', 'text-destructive', 'hover:bg-destructive/10', 'rounded-full', 'p-1')} onClick={() => setContactNumbers((prev) => prev.filter((_, i) => i !== idx))}>
                            <CloseCircle weight="BoldDuotone" className={cn('w-3.5', 'h-3.5')} />
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
                  </div>

                  {/* Card 2: Sales & Sumber */}
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Sales & Sumber</p>

                  {/* Sales PIC */}
                  {currentUserIsSales ? (
                    /* Logged-in user is a sales → locked to themselves */
                    <div>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Sales PIC <span className="text-destructive">*</span></FormLabel>
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
                        <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Sales PIC <span className="text-destructive">*</span></FormLabel>
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
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Sumber Informasi <span className="text-destructive">*</span></FormLabel>
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
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Bitrix ID <span className="text-destructive">*</span></FormLabel>
                      <BitrixDealSelect
                        value={contactBitrixId}
                        onChange={setContactBitrixId}
                      />
                    </div>
                  )}
                  </div>

                  {/* Card 3: Data CPP */}
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Data CPP</p>

                  {/* Email CPP */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Email CPP</FormLabel>
                    <Input placeholder="e.g. cpp@email.com" value={contactEmailCpp} onChange={(e) => { setContactEmailCpp(e.target.value); clearError("emailCpp"); }} onBlur={() => validateField("emailCpp", contactEmailCpp)} className="mt-1" />
                    {errors.emailCpp && <p className="mt-1 text-sm text-destructive">{errors.emailCpp}</p>}
                  </div>

                  {/* Tipe Identitas CPP + Nomor */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Tipe Identitas CPP</FormLabel>
                    <Select value={contactIdTypeCpp} onValueChange={(v) => { setContactIdTypeCpp(v as "KTP" | "Paspor"); setContactNikCpp(""); clearError("nikCpp"); }}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KTP">KTP</SelectItem>
                        <SelectItem value="Paspor">Paspor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>{contactIdTypeCpp === "KTP" ? "NIK CPP" : "No. Paspor CPP"}</FormLabel>
                    <Input
                      placeholder={contactIdTypeCpp === "KTP" ? "e.g. 3275010101010001" : "e.g. A1234567"}
                      value={contactNikCpp}
                      onChange={(e) => {
                        const v = contactIdTypeCpp === "KTP"
                          ? e.target.value.replace(/\D/g, "").slice(0, 16)
                          : e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 9).toUpperCase();
                        setContactNikCpp(v);
                        clearError("nikCpp");
                      }}
                      onBlur={() => { const err = validateIdNumber(contactIdTypeCpp, "CPP", contactNikCpp); if (err) setErrors((p) => ({ ...p, nikCpp: err })); else clearError("nikCpp"); }}
                      inputMode={contactIdTypeCpp === "KTP" ? "numeric" : "text"}
                      maxLength={contactIdTypeCpp === "KTP" ? 16 : 9}
                      className="mt-1"
                    />
                    {errors.nikCpp && <p className="mt-1 text-sm text-destructive">{errors.nikCpp}</p>}
                  </div>

                  {/* Alamat CPP */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Alamat CPP</FormLabel>
                    <Textarea placeholder="e.g. Jl. Melati No. 10, Jakarta Selatan" value={contactCppAddress} onChange={(e) => setContactCppAddress(e.target.value)} rows={3} className="mt-1" />
                  </div>
                  </div>

                  {/* Card 4: Data CPW */}
                  <div className="rounded-2xl border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-1">Data CPW</p>

                  {/* Email CPW */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Email CPW</FormLabel>
                    <Input placeholder="e.g. cpw@email.com" value={contactEmailCpw} onChange={(e) => { setContactEmailCpw(e.target.value); clearError("emailCpw"); }} onBlur={() => validateField("emailCpw", contactEmailCpw)} className="mt-1" />
                    {errors.emailCpw && <p className="mt-1 text-sm text-destructive">{errors.emailCpw}</p>}
                  </div>

                  {/* Tipe Identitas CPW + Nomor */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Tipe Identitas CPW</FormLabel>
                    <Select value={contactIdTypeCpw} onValueChange={(v) => { setContactIdTypeCpw(v as "KTP" | "Paspor"); setContactNikCpw(""); clearError("nikCpw"); }}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KTP">KTP</SelectItem>
                        <SelectItem value="Paspor">Paspor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>{contactIdTypeCpw === "KTP" ? "NIK CPW" : "No. Paspor CPW"}</FormLabel>
                    <Input
                      placeholder={contactIdTypeCpw === "KTP" ? "e.g. 3275010101010002" : "e.g. A1234567"}
                      value={contactNikCpw}
                      onChange={(e) => {
                        const v = contactIdTypeCpw === "KTP"
                          ? e.target.value.replace(/\D/g, "").slice(0, 16)
                          : e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 9).toUpperCase();
                        setContactNikCpw(v);
                        clearError("nikCpw");
                      }}
                      onBlur={() => { const err = validateIdNumber(contactIdTypeCpw, "CPW", contactNikCpw); if (err) setErrors((p) => ({ ...p, nikCpw: err })); else clearError("nikCpw"); }}
                      inputMode={contactIdTypeCpw === "KTP" ? "numeric" : "text"}
                      maxLength={contactIdTypeCpw === "KTP" ? 16 : 9}
                      className="mt-1"
                    />
                    {errors.nikCpw && <p className="mt-1 text-sm text-destructive">{errors.nikCpw}</p>}
                  </div>

                  {/* Alamat CPW */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Alamat CPW</FormLabel>
                    <Textarea placeholder="e.g. Jl. Melati No. 10, Jakarta Selatan" value={contactCpwAddress} onChange={(e) => setContactCpwAddress(e.target.value)} rows={3} className="mt-1" />
                  </div>
                  </div>

                </div>
              )}
              {/* ─── Step 2: Venue & Paket ─── */}
              {currentStep === 2 && (
                <div className="space-y-3">
                  {/* Venue */}
                  <FormField control={form.control} name="venueId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Venue <span className="text-destructive">*</span></FormLabel>
                      <SearchableSelect options={venues} value={field.value} onChange={(id) => { field.onChange(id); setSelectedVenueId(id); setSelectedPackageId(""); setSelectedPackagePrice(0); setOriginalPackagePrice(0); setCategoryToggles({}); setTakeoutPrices({}); form.setValue("packageId", ""); form.setValue("paymentMethodId", null); clearError("venueId"); }} placeholder="Pilih venue..." searchPlaceholder="Cari venue..." emptyText="Tidak ada venue" />
                      <FormMessage />
                      {errors.venueId && <p className="mt-1 text-sm text-destructive">{errors.venueId}</p>}
                    </FormItem>
                  )} />

                  {/* Pilih Paket */}
                  <FormField control={form.control} name="packageId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Pilih Paket <span className="text-destructive">*</span></FormLabel>
                      <SearchableSelect options={packages.map((p) => ({ id: p.id, name: `${p.packageName}${p.pax ? ` — ${p.pax} pax` : ""} — ${formatRupiah(getPackagePrice(p))}` }))} value={field.value} onChange={(id) => { field.onChange(id); setSelectedPackageId(id); setSelectedPackagePrice(0); setOriginalPackagePrice(0); setLastAllocatedPrice(0); setCategoryToggles({}); setTakeoutPrices({}); setUserHasCustomizedTerms(false); const pkg = packages.find((x: PackageData) => x.id === id); if (pkg) { const p = getPackagePrice(pkg); setSelectedPackagePrice(p); setOriginalPackagePrice(p); allocatePrice(p, specialBonusAmount); setLastAllocatedPrice(p); /* Re-prefill Item Paket from the newly chosen package template. */ packageItemsDirtyRef.current = false; setPackageInternalItems((pkg.internalItems ?? []).map((it) => ({ uid: safeRandomUUID(), itemName: it.itemName, itemDescription: it.itemDescription }))); setPackageVendorItems((pkg.vendorItems ?? []).map((it) => ({ uid: safeRandomUUID(), categoryId: it.categoryId ?? null, categoryName: it.categoryName, itemText: it.itemText }))); } clearError("packageId"); }} placeholder={!selectedVenueId ? "Pilih venue dulu" : packagesLoading ? "Memuat paket..." : packagesError ? "Gagal memuat paket" : "Pilih paket..."} disabled={!selectedVenueId || packagesLoading} searchPlaceholder="Cari paket..." emptyText="Tidak ada paket" />
                      {packagesError && <p className="text-xs text-destructive mt-1">Gagal memuat paket. Coba pilih venue ulang.</p>}
                      <FormMessage />
                      {errors.packageId && <p className="mt-1 text-sm text-destructive">{errors.packageId}</p>}
                    </FormItem>
                  )} />

                  {/* Event Type */}
                  <FormField control={form.control} name="weddingType" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Event Type <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={[
                            { id: "R", name: "Resepsi" },
                            { id: "AR", name: "Akad & Resepsi" },
                            { id: "TR", name: "Teapai & Resepsi" },
                            { id: "PR", name: "Pemberkatan Resepsi" },
                            { id: "VO", name: "Venue Only" },
                          ]}
                          value={field.value ?? ""}
                          onChange={(v) => {
                            // User explicitly changed event type → re-enable time auto-fill
                            isResumedDraftRef.current = false;
                            field.onChange(v || null);
                            clearError("weddingType");
                          }}
                          placeholder="Pilih type"
                          searchPlaceholder="Cari event type..."
                          emptyText="Tidak ada event type"
                        />
                      </FormControl>
                      <FormMessage />
                      {errors.weddingType && <p className="mt-1 text-sm text-destructive">{errors.weddingType}</p>}
                    </FormItem>
                  )} />

                  {/* Event Date */}
                  <FormField control={form.control} name="eventDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Event Date <span className="text-destructive">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger render={
                          <Button
                            variant="outline"
                            disabled={!selectedVenueId}
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            <CalendarIcon weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4')} />
                            {selectedVenueId
                              ? (field.value ? format(parseDateOnly(field.value), "PPP") : "Pilih tanggal event")
                              : "Pilih venue terlebih dahulu"}
                          </Button>
                        } />
                        <PopoverContent className={cn('w-auto', 'p-0')} align="start">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            selected={field.value ? parseDateOnly(field.value) : undefined}
                            onSelect={(date) => { field.onChange(date ? toDateOnly(date) : ""); form.setValue("weddingSession", null); clearError("eventDate"); }}
                            disabled={(d) => getDateStatus(d) === "unavailable"}
                            startMonth={new Date(new Date().getFullYear() - 10, 0)}
                            endMonth={new Date(new Date().getFullYear() + 10, 11)}
                            defaultMonth={field.value ? parseDateOnly(field.value) : new Date()}
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
                      {errors.eventDate && <p className="mt-1 text-sm text-destructive">{errors.eventDate}</p>}
                    </FormItem>
                  )} />

                  {/* Event Session */}
                  <FormField control={form.control} name="weddingSession" render={({ field }) => {
                    // wBookingDate is stored as "yyyy-MM-dd" — use it directly as the key.
                    const dateStr = wBookingDate || null;
                    const sessions = dateStr ? getAvailableSessions(dateStr) : ["morning", "evening", "fullday"];
                    const SESSION_LABELS: Record<string, string> = { morning: "Pagi", evening: "Malam", fullday: "Fullday" };
                    return (
                      <FormItem>
                        <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Event Session <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={sessions.map((s) => ({ id: s, name: SESSION_LABELS[s] }))}
                            value={field.value ?? ""}
                            onChange={(v) => {
                              // User explicitly changed session → re-enable time auto-fill
                              isResumedDraftRef.current = false;
                              field.onChange(v || null);
                              clearError("weddingSession");
                            }}
                            placeholder={!wBookingDate ? "Pilih tanggal dulu" : "Pilih session"}
                            searchPlaceholder="Cari session..."
                            emptyText="Tidak ada session tersedia"
                            disabled={!wBookingDate}
                          />
                        </FormControl>
                        <FormMessage />
                        {errors.weddingSession && <p className="mt-1 text-sm text-destructive">{errors.weddingSession}</p>}
                      </FormItem>
                    );
                  }} />

                  {/* Time */}
                  <div className="flex flex-col gap-1">
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>
                      Time <span className="text-destructive">*</span>
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

                  {/* ─── Complimentary (Bonus) ─── */}
                  <div className="space-y-2">
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Complimentary (Bonus)</FormLabel>

                    {/* Pilih dari daftar (dropdown inline) — "Tambah" muncul di dalam dropdown saat search tidak exact-match */}
                    {complimentaryMode !== "create-new" && (
                      <ComplimentarySelect
                        options={complimentaryOptions
                          .filter((opt) => !complimentaries.some((c) => c.complimentaryId === opt.id))
                          .map((opt) => ({ id: opt.id, name: opt.name, badge: formatRupiah(opt.price), description: opt.description ?? undefined }))}
                        value=""
                        onChange={(selectedId) => {
                          const found = complimentaryOptions.find((x) => x.id === selectedId);
                          if (found) {
                            setComplimentaries((prev) => [...prev, {
                              id: crypto.randomUUID(),
                              complimentaryId: found.id,
                              name: found.name,
                              price: found.price,
                              isShowPrice: found.isShowPrice,
                              description: found.description ?? "",
                              qty: 1,
                            }]);
                          }
                        }}
                        onAddTrigger={canCreateComplimentary ? (text) => {
                          setComplimentaryMode("create-new");
                          setCreateNewComp({ name: text, price: 0, description: "", isShowPrice: false });
                        } : undefined}
                        placeholder="Pilih dari daftar complimentary..."
                        searchPlaceholder="Cari complimentary..."
                        emptyText="Tidak ada complimentary"
                      />
                    )}

                    {/* Mode: buat baru */}
                    {complimentaryMode === "create-new" && (
                      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Tambah complimentary baru ke master</p>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setComplimentaryMode("none")}
                          >
                            Batal
                          </button>
                        </div>

                        {/* Nama */}
                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">Nama <span className="text-destructive">*</span></label>
                          <Input
                            value={createNewComp.name}
                            onChange={(e) => setCreateNewComp((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Nama complimentary..."
                            className="h-8 text-sm"
                          />
                        </div>

                        {/* Harga + Tampil harga */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background"
                              placeholder="Harga (opsional)"
                              value={createNewComp.price ? fmtRp(createNewComp.price) : ""}
                              onChange={(e) => {
                                const n = Number(e.target.value.replace(/\D/g, ""));
                                setCreateNewComp((p) => ({ ...p, price: n }));
                              }}
                            />
                          </div>
                          <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                            <Switch
                              checked={createNewComp.isShowPrice}
                              onCheckedChange={(v) => setCreateNewComp((p) => ({ ...p, isShowPrice: v }))}
                            />
                            <span className="text-xs text-muted-foreground">Tampil harga</span>
                          </label>
                        </div>

                        {/* Deskripsi */}
                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">Deskripsi</label>
                          <Textarea
                            value={createNewComp.description}
                            onChange={(e) => setCreateNewComp((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Keterangan complimentary (opsional)..."
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>

                        {/* Tombol simpan */}
                        <Button
                          type="button"
                          className="w-full rounded-xl"
                          disabled={!createNewComp.name.trim() || isCreatingComp}
                          onClick={async () => {
                            if (!createNewComp.name.trim() || isCreatingComp) return;
                            setIsCreatingComp(true);
                            try {
                              const result = await createComplimentary({
                                name: createNewComp.name.trim(),
                                price: createNewComp.price,
                                description: createNewComp.description.trim() || null,
                                isShowPrice: createNewComp.isShowPrice,
                                isActive: true,
                              });
                              if (result.success && result.item) {
                                setComplimentaries((prev) => [...prev, {
                                  id: crypto.randomUUID(),
                                  complimentaryId: result.item!.id,
                                  name: result.item!.name,
                                  price: result.item!.price,
                                  isShowPrice: result.item!.isShowPrice,
                                  description: result.item!.description ?? "",
                                  qty: 1,
                                }]);
                                setComplimentaryMode("none");
                                toast.success(`"${result.item.name}" berhasil ditambahkan`);
                              } else {
                                toast.error(result.error ?? "Gagal menambahkan complimentary");
                              }
                            } finally {
                              setIsCreatingComp(false);
                            }
                          }}
                        >
                          {isCreatingComp ? "Menyimpan..." : "Simpan & Tambahkan"}
                        </Button>
                      </div>
                    )}

                    {/* List complimentary yang sudah ditambahkan — collapsible rows */}
                    {complimentaries.map((c) => {
                      const isOpen = !collapsedComplimentaries.has(c.id);
                      return (
                        <Collapsible
                          key={c.id}
                          open={isOpen}
                          onOpenChange={() => toggleComplimentaryCollapse(c.id)}
                          className="rounded-xl border border-border bg-muted/30 overflow-hidden"
                        >
                          {/* Header */}
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
                                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                                {!isOpen && (
                                  <p className="text-xs text-muted-foreground tabular-nums">
                                    {c.isShowPrice && c.price ? `Rp${fmtRp(c.price)}` : "Harga tidak ditampilkan"}
                                  </p>
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <button
                              type="button"
                              className="shrink-0 p-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setComplimentaries((prev) => prev.filter((x) => x.id !== c.id));
                                setCollapsedComplimentaries((prev) => {
                                  const next = new Set(prev);
                                  next.delete(c.id);
                                  return next;
                                });
                              }}
                              aria-label="Hapus complimentary"
                            >
                              <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Body */}
                          <CollapsibleContent>
                            <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                              <div>
                                <label className="text-xs font-medium text-foreground block mb-1">Nama <span className="text-destructive">*</span></label>
                                <Input
                                  value={c.name}
                                  onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))}
                                  placeholder="Nama complimentary..."
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background"
                                    placeholder="Harga"
                                    value={c.price ? fmtRp(c.price) : ""}
                                    onChange={(e) => {
                                      const n = Number(e.target.value.replace(/\D/g, ""));
                                      setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, price: n } : x));
                                    }}
                                  />
                                </div>
                                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                                  <Switch
                                    checked={c.isShowPrice}
                                    onCheckedChange={(v) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, isShowPrice: v } : x))}
                                  />
                                  <span className="text-xs text-muted-foreground">Tampil harga</span>
                                </label>
                              </div>
                              <Textarea
                                value={c.description}
                                onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, description: e.target.value } : x))}
                                placeholder="Keterangan complimentary..."
                                rows={2}
                                className="resize-none text-sm"
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                    {complimentaries.length === 0 && complimentaryMode === "none" && (
                      <p className="text-xs text-muted-foreground italic text-center py-1">Belum ada complimentary</p>
                    )}
                  </div>
                </div>
              )}
              {/* ─── Step 3: Item Paket (Internal & Vendor items) ─── */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <p className={cn('text-sm', 'font-medium', 'text-foreground')}>Item Paket</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Item internal & vendor yang tampil di PO booking. Diisi otomatis dari template paket — boleh diubah, ditambah, atau dihapus tanpa mengubah template asli.
                    </p>
                  </div>
                  <PackageItemsEditor
                    internalItems={packageInternalItems}
                    vendorItems={packageVendorItems}
                    onInternalChange={(items) => { packageItemsDirtyRef.current = true; setPackageInternalItems(items); }}
                    onVendorChange={(items) => { packageItemsDirtyRef.current = true; setPackageVendorItems(items); }}
                    activeTab={packageItemsTab}
                    onTabChange={setPackageItemsTab}
                  />
                </div>
              )}
              {/* ─── Step 4: Takeout (Package Prices) ─── */}
              {currentStep === 4 && (
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
              {/* ─── Step 5: Term of Payments (jadwal murni) ─── */}
              {currentStep === 5 && (
                <CreatePaymentStep
                  terms={terms}
                  setTerms={(updater) => {
                    setTerms((prev) => {
                      const next = typeof updater === "function" ? updater(prev) : updater;
                      // Mark that the user has manually edited terms so allocatePrice
                      // won't override amounts on discount changes.
                      setUserHasCustomizedTerms(true);
                      return next;
                    });
                  }}
                  collapsedTerms={collapsedTerms}
                  setCollapsedTerms={setCollapsedTerms}
                  specialBonusName={specialBonusName}
                  setSpecialBonusName={setSpecialBonusName}
                  specialBonusAmount={specialBonusAmount}
                  setSpecialBonusAmount={setSpecialBonusAmount}
                  onAddTerm={() => {
                    setTerms((prev) =>
                      recalcTermDates(
                        [
                          ...prev,
                          {
                            uid: safeRandomUUID(),
                            name: "",
                            amount: 0,
                            dueDate: "",
                            sortOrder: prev.length,
                          },
                        ],
                        wBookingDate,
                      ),
                    );
                  }}
                  packagePrice={getBasePrice()}
                />
              )}
              {/* ─── Step 6: Payment (pencatatan cash-in) ─── */}
              {currentStep === 6 && (
                <CreatePaymentRecordStep
                  terms={terms}
                  payments={createPayments}
                  setPayments={setCreatePayments}
                  defaultPaymentMethodId={wPaymentMethodId ?? ""}
                  bookingFeeRecorded={isStep6Complete}
                />
              )}
              {/* ─── Step 7: Signature ─── */}
              {currentStep === 7 && (
                <div className="space-y-6">
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground', 'mb-2', 'block')}>Lokasi Tanda Tangan <span className="text-destructive">*</span></FormLabel>
                    <Input placeholder="Contoh: Jakarta, Bandung, Surabaya..." value={signingLocation} onChange={(e) => setSigningLocation(e.target.value)} />
                  </div>
                  {/* Sales signature — only when the logged-in user IS the assigned
                      sales. When a manager/admin assigns to another sales, that sales
                      signs later via the approval page, so we skip the pad here. */}
                  {currentUserIsSales ? (
                    <div className="space-y-3">
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground', 'mb-2', 'block')}>Tanda Tangan Sales <span className="text-destructive">*</span></FormLabel>

                      {/* Toggle: Gunakan Tanda Tangan Default */}
                      <div className={cn("flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3")}>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">Gunakan Tanda Tangan Default Saya</p>
                          {!myDefaultSignature && (
                            <p className="text-xs text-muted-foreground">Atur dulu di Profil &rsaquo; Tanda Tangan Default</p>
                          )}
                        </div>
                        <Switch
                          checked={useDefaultSignature}
                          disabled={!myDefaultSignature}
                          onCheckedChange={(checked) => {
                            setUseDefaultSignature(checked);
                            if (checked && myDefaultSignature) {
                              setSignatureSales(myDefaultSignature);
                              sigSalesRef.current?.clear();
                            } else {
                              setSignatureSales("");
                              sigSalesRef.current?.clear();
                            }
                          }}
                        />
                      </div>

                      {/* Manual pad — hanya tampil kalau toggle OFF */}
                      {!useDefaultSignature && (
                        <>
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
                        </>
                      )}

                      {/* Preview default signature kalau toggle ON */}
                      {useDefaultSignature && myDefaultSignature && (
                        <div className={cn("rounded-xl border border-border bg-white p-3 flex items-center justify-center")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={myDefaultSignature} alt="Tanda tangan default" className="max-h-28 max-w-full object-contain" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Tanda tangan sales akan diisi oleh sales yang ditugaskan ({lockedSalesName}) melalui halaman approval setelah booking dibuat.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </form>
          </Form>
        </div>
        {/* Footer — hidden when showing resume prompt */}
        <div className={cn('bg-background', 'sticky', 'bottom-0', 'z-10', showResumePrompt ? 'hidden' : '')}>
          {/* Mini price summary (step 5) lives inside CreatePaymentStep — no duplicate here. */}
          {/* Background-save error banner — shown when a step save failed after retry */}
          {hasPendingWriteError && pendingWriteErrorMsg && (
            <div className="mb-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              <span className="font-semibold">Simpan gagal:</span> {pendingWriteErrorMsg}
              {" "}Perbaiki koneksi lalu klik <span className="font-semibold">Coba Lagi</span>.
            </div>
          )}
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
              {hasPendingWriteError
                ? "Coba Lagi"
                : currentStep < totalSteps
                  ? (isDraftMutating ? "Menyimpan..." : "Continue")
                  : (isDraftMutating ? "Membuat Booking..." : "Create New Booking")}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
