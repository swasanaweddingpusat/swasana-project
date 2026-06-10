"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { Calendar as CalendarIcon, TrashBinTrash, CloseCircle, AddCircle, AltArrowDown, FileText, UploadMinimalistic, Pen } from "@solar-icons/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { ContactEntry, parseStoredPhone } from "@/components/shared/PhoneInput";
import { cn } from "@/lib/utils";
import { editBooking, updateBookingClientInfo } from "@/actions/booking";
import { createComplimentary } from "@/actions/complimentary";
import { computeFullPrice } from "@/lib/package-prices";
import { useComplimentaries } from "@/hooks/use-complimentaries";
import { usePermissions } from "@/hooks/use-permissions";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { BookingListItem } from "@/lib/queries/bookings";
import type { MobileNumberEntry } from "@/lib/validations/customer";

interface Props {
  booking: BookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VenueOption { id: string; name: string }
interface CategoryPriceEntry { id: string; categoryName: string; basePrice: number; sortOrder: number; isShow: boolean }
interface PackageOption { id: string; packageName: string; pax: number; margin: number; sellingPrice: number; categoryPrices: CategoryPriceEntry[] }
interface BonusRow { vendorId: string; vendorCategoryId: string; vendorName: string; description: string; qty: number; nominal: number }
interface ComplimentaryRow { id: string; complimentaryId: string | null; name: string; price: number; isShowPrice: boolean; description: string; qty: number }
type TermPaymentStatus = "unpaid" | "paid" | "partial" | "refund";
interface TermRow { id?: string; name: string; amount: number; dueDate: string; sortOrder: number; paymentStatus: TermPaymentStatus; ackStatus?: string; paymentEvidence?: string | null }

/** A locked term cannot have its amount/name redistributed or overwritten.
 *  Matches the server-side guard in actions/booking.ts. */
function isLockedTerm(t: Pick<TermRow, "paymentStatus" | "ackStatus">): boolean {
  return (
    t.paymentStatus === "paid" ||
    t.paymentStatus === "refund" ||
    t.ackStatus === "acknowledged"
  );
}

const PAYMENT_STATUS_LABELS: Record<TermPaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  partial: "Partial",
  refund: "Refund",
};

const STEP_LABELS: Record<number, string> = {
  1: "Client",
  2: "Venue & Paket",
  3: "Takeout",
  4: "TOP",
  5: "Signing",
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function getPackagePrice(p: PackageOption) {
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
    if (!force && t.dueDate) return t;
    return {
      ...t,
      dueDate: toLocalISO(new Date(now.getTime() + Math.round((totalMs * i) / (n - 1 || 1)))),
    };
  });
}

const LBL = "text-sm font-medium text-foreground";

export function EditBookingDrawer({ booking, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { users: salesUsers } = useSalesUsers();
  const { user: currentUser } = useCurrentUser();

  // Sales PIC = current user IS the specific sales assigned to THIS booking (not just any sales).
  // This controls whether step 5 (Signing) is shown. If not Sales PIC, the drawer
  // has 4 effective steps; the Sales step in the approval flow stays pending until
  // the Sales PIC signs via the approve modal.
  // booking.salesId is a scalar field returned by Prisma `include` — no cast needed.
  const isSalesPIC = !!currentUser?.profileId && !!booking?.salesId &&
    currentUser.profileId === booking.salesId;

  const totalSteps = isSalesPIC ? 5 : 4;
  const [currentStep, setCurrentStep] = useState(1);

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
  const [selectedPackagePrice, setSelectedPackagePrice] = useState(0);
  const [bookingDate, setBookingDate] = useState("");
  const [weddingSession, setWeddingSession] = useState("");
  const [weddingType, setWeddingType] = useState("");
  // Vendor bonus UI sudah di-deprecate (diganti Complimentary). State ini hanya
  // mempreserve snapBonuses lama agar data tidak hilang saat booking lama di-edit.
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const [complimentaries, setComplimentaries] = useState<ComplimentaryRow[]>([]);
  const [complimentaryMode, setComplimentaryMode] = useState<"none" | "picker" | "create-new">("none");
  const [collapsedComplimentaries, setCollapsedComplimentaries] = useState<Set<string>>(new Set());
  const [createNewComp, setCreateNewComp] = useState({ name: "", price: 0, description: "", isShowPrice: false });
  const [isCreatingComp, setIsCreatingComp] = useState(false);

  // ── Step 3: Takeout ──
  const [categoryToggles, setCategoryToggles] = useState<Record<string, boolean>>({});
  const [takeoutPrices, setTakeoutPrices] = useState<Record<string, number>>({});

  // ── Step 4: Term of Payment ──
  const [specialBonusName, setSpecialBonusName] = useState("Discount");
  const [specialBonusAmount, setSpecialBonusAmount] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [lastAllocatedPrice, setLastAllocatedPrice] = useState(0);
  const [collapsedTerms, setCollapsedTerms] = useState<Set<number>>(new Set());
  const [unlockedTerms, setUnlockedTerms] = useState<Set<number>>(new Set());
  const [uploadingEvidenceId, setUploadingEvidenceId] = useState<string | null>(null);

  // ── Step 5: Signing ──
  const [signingLocation, setSigningLocation] = useState("");
  const [signatureSales, setSignatureSales] = useState("");
  const sigSalesRef = useRef<SignatureCanvas>(null);

  // ── Change detection ──
  const [originalVenueId, setOriginalVenueId] = useState("");
  const [originalPackageId, setOriginalPackageId] = useState("");
  const [originalBookingDate, setOriginalBookingDate] = useState("");
  const [originalDiscountName, setOriginalDiscountName] = useState<string | null>(null);
  const [originalDiscountAmount, setOriginalDiscountAmount] = useState(0);
  // Serialized initial category toggles for takeout change detection (JSON string)
  const [originalToggles, setOriginalToggles] = useState("");
  // Serialized initial terms for TOP change detection (JSON string) — mirrors server logic
  const [originalTermsKey, setOriginalTermsKey] = useState("");
  // Venue availability
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  // ── Save Step 1 mutation ──
  const [isSavingClientInfo, setIsSavingClientInfo] = useState(false);

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

  const { data: complimentaryData } = useComplimentaries({ activeOnly: true });
  const complimentaryOptions = complimentaryData?.items ?? [];
  const { can: canPermission, isAdmin: isPermAdmin } = usePermissions();
  const canCreateComplimentary = canPermission("settings-complimentary", "create") || isPermAdmin;

  const isBitrixSource = sources.find((o) => o.id === sourceOfInformationId)?.name.toLowerCase().includes("bitrix") ?? false;

  function toggleComplimentaryCollapse(id: string) {
    setCollapsedComplimentaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleTerm(idx: number) {
    setCollapsedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  }

  const selectedPkg = packages.find((p) => p.id === packageId);
  const allCategoryPrices = selectedPkg?.categoryPrices ?? [];
  const visibleCategories = allCategoryPrices.filter((c) => c.isShow);
  const variantMargin = selectedPkg?.margin ?? 0;

  const fullPrice = computeFullPrice(allCategoryPrices, variantMargin, selectedPkg?.sellingPrice);
  const totalTakeoutNominal = visibleCategories
    .filter((c) => categoryToggles[c.categoryName])
    .reduce((sum, c) => sum + (takeoutPrices[c.categoryName] ?? c.basePrice), 0);
  const step3Price = Math.max(0, fullPrice - totalTakeoutNominal);

  // ── Initialize state from booking ──
  useEffect(() => {
    if (!open || !booking) return;
    setCurrentStep(1);
    setCustomerName(booking.snapCustomer?.name ?? "");
    const raw = booking.snapCustomer?.mobileNumber ?? "";
    if (raw.trim()) {
      const parsed: MobileNumberEntry[] = raw.split(",").map((segment) => {
        const s = segment.trim();
        const colonIdx = s.indexOf(": ");
        if (colonIdx > 0) {
          return { name: s.slice(0, colonIdx).trim(), number: s.slice(colonIdx + 2).trim() };
        }
        return { name: "", number: s };
      }).filter((e) => e.number.trim() !== "");
      setContactNumbers(parsed);
    } else {
      setContactNumbers([]);
    }
    setVenueId(booking.venueId ?? "");
    setPackageId(booking.packageId ?? "");
    setOriginalVenueId(booking.venueId ?? "");
    setOriginalPackageId(booking.packageId ?? "");
    const initialBookingDate = booking.bookingDate ? new Date(booking.bookingDate).toISOString() : "";
    setBookingDate(initialBookingDate);
    setOriginalBookingDate(initialBookingDate);
    setOriginalDiscountName(booking.discountName ?? "Discount");
    setOriginalDiscountAmount(Number(booking.discountAmount) || 0);
    setWeddingSession(booking.weddingSession ?? "");
    setWeddingType(booking.weddingType ?? "");
    setSourceOfInformationId(booking.sourceOfInformationId ?? "");
    setSalesId(booking.salesId ?? null);
    setPaymentMethodId(booking.paymentMethodId ?? "");
    setSigningLocation(booking.signingLocation ?? "");
    setSpecialBonusName(booking.discountName ?? "Discount");
    setSpecialBonusAmount(Number(booking.discountAmount) || 0);
    setSignatureSales("");
    sigSalesRef.current?.clear();
    setCategoryToggles({});
    setTakeoutPrices({});
    setComplimentaries([]);
    setComplimentaryMode("none");
    setCollapsedComplimentaries(new Set());
    setCreateNewComp({ name: "", price: 0, description: "", isShowPrice: false });
    setIsCreatingComp(false);
    setBonuses([]);

    const bTerms = (booking.termOfPayments ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      amount: Number(t.amount),
      dueDate: new Date(t.dueDate).toISOString(),
      sortOrder: t.sortOrder,
      paymentStatus: (t.paymentStatus ?? "unpaid") as TermPaymentStatus,
      ackStatus: (t as Record<string, unknown>).ackStatus as string | undefined ?? undefined,
      paymentEvidence: (t as Record<string, unknown>).paymentEvidence as string | null ?? null,
    }));
    const defaultTerms: TermRow[] = [
      { name: "Booking Fee", amount: 5_000_000, dueDate: toLocalISO(new Date()), sortOrder: 0, paymentStatus: "paid" },
      { name: "DP", amount: 10_000_000, dueDate: "", sortOrder: 1, paymentStatus: "unpaid" },
    ];
    const initialTerms = bTerms.length > 0 ? bTerms : defaultTerms;
    setTerms(initialTerms);
    // Snapshot for TOP change detection — mirrors server: count, name, amount, sortOrder
    setOriginalTermsKey(JSON.stringify(initialTerms.map((t) => ({ name: t.name, amount: t.amount, sortOrder: t.sortOrder }))));
    setLastAllocatedPrice(0);
    setCollapsedTerms(new Set());
    setUnlockedTerms(new Set());
    setSelectedPackagePrice(Number(booking.snapPackagePricing?.price ?? 0));
  }, [open, booking]);

  // ── Init detail fields (email, NIK, address, bitrix, bonuses, complimentaries) ──
  useEffect(() => {
    if (!detail) return;
    const emailCpp = detail.snapCustomer?.emailCpp ?? detail.customer?.emailCpp ?? "";
    const emailCpw = detail.snapCustomer?.emailCpw ?? detail.customer?.emailCpw ?? "";
    const nikCpp = detail.snapCustomer?.cppNik ?? detail.customer?.cppNik ?? "";
    const nikCpw = detail.snapCustomer?.cpwNik ?? detail.customer?.cpwNik ?? "";
    const cppAddress = detail.snapCustomer?.cppAddress ?? detail.customer?.cppAddress ?? "";
    const cpwAddress = detail.snapCustomer?.cpwAddress ?? detail.customer?.cpwAddress ?? "";
    const bitrixId = detail.customer?.bitrixId ?? "";

    // salesId from booking record
    if (detail.salesId && !salesId) {
      setSalesId(detail.salesId as string);
    }

    // Preserve legacy snapBonuses so old data is not lost on edit — vendor bonus UI is deprecated.
    const mappedBonuses: BonusRow[] = (detail.snapBonuses ?? []).map((b: Record<string, unknown>) => ({
      vendorId: b.vendorId as string,
      vendorCategoryId: b.vendorCategoryId as string,
      vendorName: b.vendorName as string,
      description: (b.description as string) ?? "",
      qty: Number(b.qty) || 1,
      nominal: Number(b.nominal) || 0,
    }));

    setContactEmailCpp(emailCpp);
    setContactEmailCpw(emailCpw);
    setContactNikCpp(nikCpp);
    setContactNikCpw(nikCpw);
    setContactCppAddress(cppAddress);
    setContactCpwAddress(cpwAddress);
    setContactBitrixId(bitrixId);
    if (mappedBonuses.length && bonuses.length === 0) {
      setBonuses(mappedBonuses);
    }

    const mappedComplimentaries: ComplimentaryRow[] = (detail.snapComplimentaries ?? []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      complimentaryId: (c.complimentaryId as string | null) ?? null,
      name: c.name as string,
      price: Number(c.price) || 0,
      isShowPrice: Boolean(c.isShowPrice),
      description: (c.description as string) ?? "",
      qty: Number(c.qty) || 1,
    }));
    if (mappedComplimentaries.length && complimentaries.length === 0) {
      setComplimentaries(mappedComplimentaries);
    }

    if (detail.snapPackageCategoryPrices?.length) {
      const toggleMap: Record<string, boolean> = {};
      const nominalMap: Record<string, number> = {};
      for (const cp of detail.snapPackageCategoryPrices as Array<{ categoryName: string; isTakeout: boolean; isShow: boolean; basePrice: number; takeoutNominal?: number }>) {
        if (cp.isShow) {
          toggleMap[cp.categoryName] = cp.isTakeout;
          if (cp.isTakeout) nominalMap[cp.categoryName] = Number(cp.takeoutNominal) || Number(cp.basePrice);
        }
      }
      setCategoryToggles(toggleMap);
      setTakeoutPrices(nominalMap);
      // Snapshot initial toggles for change detection
      const toggleKey = (t: Record<string, boolean>, p: Record<string, number>) =>
        JSON.stringify({ t, p });
      setOriginalToggles(toggleKey(toggleMap, nominalMap));
    }
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Package price from loaded packages ──
  useEffect(() => {
    if (!packageId || !packages.length) return;
    const pkg = packages.find((x) => x.id === packageId);
    if (pkg) setSelectedPackagePrice(getPackagePrice(pkg));
  }, [packageId, packages]);

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

  // ── Recalc term dates on event date change ──
  useEffect(() => {
    if (bookingDate) setTerms((prev) => recalcTermDates(prev, bookingDate));
  }, [bookingDate]);

  function getAvailableSessions(dateStr: string): string[] {
    const a = availability[dateStr];
    if (!a) return ["morning", "evening", "fullday"];
    const sessions: string[] = [];
    if (a.morning) sessions.push("morning");
    if (a.evening) sessions.push("evening");
    if (a.fullday && a.morning && a.evening) sessions.push("fullday");
    return sessions;
  }

  function getDateStatus(d: Date): "available" | "partial" | "unavailable" | null {
    const key = format(d, "yyyy-MM-dd");
    const a = availability[key];
    if (!a) return null;
    const count = [a.morning, a.evening, a.fullday].filter(Boolean).length;
    if (count === 0) return "unavailable";
    if (count === 3) return "available";
    return "partial";
  }

  // ── Price helpers ──
  const getBasePrice = () => selectedPackagePrice;
  const getPriceAfterDiscount = () => Math.max(0, getBasePrice() - specialBonusAmount);
  const getTotalTerms = () => terms.reduce((s, t) => s + (t.amount || 0), 0);
  const getLockedTotal = () => terms.reduce((s, t) => s + (isLockedTerm(t) ? (t.amount || 0) : 0), 0);
  const getPoolTotal = () => terms.reduce((s, t) => s + (!isLockedTerm(t) ? (t.amount || 0) : 0), 0);
  const getPoolTarget = () => Math.max(0, getPriceAfterDiscount() - getLockedTotal());
  const getDifference = () => getPoolTotal() - getPoolTarget();

  const allocatePrice = (price: number, discount: number) => {
    const total = Math.max(0, price - discount);
    setTerms((prev) => {
      const lockedTotal = prev.reduce((s, t) => s + (isLockedTerm(t) ? (t.amount || 0) : 0), 0);
      const poolTotal = Math.max(0, total - lockedTotal);
      const poolTerms = prev.filter((t) => !isLockedTerm(t));
      const n = poolTerms.length || 1;
      const base = Math.floor(poolTotal / n);
      const remainder = poolTotal % n;
      let poolIdx = 0;
      return prev.map((t) => {
        if (isLockedTerm(t)) return t;
        const amount = poolIdx === poolTerms.length - 1 ? base + remainder : base;
        poolIdx++;
        return { ...t, amount };
      });
    });
  };

  // ── Change detection — mirrors server-side hasMaterialChange ──
  const eventDateChanged =
    bookingDate && originalBookingDate
      ? new Date(bookingDate).toISOString().split("T")[0] !== new Date(originalBookingDate).toISOString().split("T")[0]
      : false;
  const discountChanged =
    specialBonusName !== originalDiscountName ||
    specialBonusAmount !== originalDiscountAmount;
  const currentTogglesKey = JSON.stringify({
    t: categoryToggles,
    p: takeoutPrices,
  });
  const takeoutChanged = originalToggles !== "" && currentTogglesKey !== originalToggles;
  // TOP change detection — mirrors server: count, name, amount, sortOrder per index
  const currentTermsKey = JSON.stringify(terms.map((t) => ({ name: t.name, amount: t.amount, sortOrder: t.sortOrder })));
  const topChanged = originalTermsKey !== "" && currentTermsKey !== originalTermsKey;
  const hasSignificantChange =
    venueId !== originalVenueId ||
    packageId !== originalPackageId ||
    eventDateChanged ||
    discountChanged ||
    takeoutChanged ||
    topChanged;

  // ── Completeness per step ──
  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0);
  const isStep2Complete = !!(venueId && packageId && bookingDate && weddingSession && weddingType);
  const isStep3Complete =
    visibleCategories.length === 0 ||
    visibleCategories.some((c) => !(categoryToggles[c.categoryName] ?? false));
  const isStep4Complete = getBasePrice() === 0 || getDifference() === 0;
  const isStep5Complete = !!signatureSales && !!signingLocation.trim();

  // ── Save Step 1: client info only (no approval trigger) ──
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
      toast.success("Informasi client berhasil disimpan.");
    } finally {
      setIsSavingClientInfo(false);
    }
  }

  // ── Navigation ──
  function handleGoToStep(step: number) {
    if (step === currentStep) return;
    // When going back from step 5, clear signature
    if (currentStep === 5 && step < 5) {
      sigSalesRef.current?.clear();
      setSignatureSales("");
    }
    setCurrentStep(step);
  }

  function handleNext() {
    if (currentStep === 2 && !isStep2Complete) {
      toast.error("Lengkapi field venue & paket terlebih dahulu.");
      return;
    }
    if (currentStep === 3 && !isStep3Complete) {
      toast.error("Minimal satu kategori harus tetap included.");
      return;
    }
    if (currentStep === 3) {
      setSelectedPackagePrice(step3Price);
      if (step3Price !== lastAllocatedPrice) {
        allocatePrice(step3Price, specialBonusAmount);
        setLastAllocatedPrice(step3Price);
      }
    }
    if (currentStep === 4) {
      // DP = index 1 (sorted by sortOrder: 0=Booking Fee, 1=DP).
      // Guard: only validate if at least 2 terms exist.
      const dpTerm = terms.length >= 2 ? terms[1] : null;
      if (dpTerm && (!dpTerm.amount || dpTerm.amount <= 0)) {
        toast.error("Nominal DP wajib diisi dan harus lebih dari 0.");
        return;
      }
      if (getBasePrice() > 0 && getDifference() !== 0) {
        toast.error(`Selisih: Rp${fmtRp(Math.abs(getDifference()))}`);
        return;
      }
    }
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  }

  function handlePrevious() {
    if (currentStep > 1) {
      if (currentStep === 5) { sigSalesRef.current?.clear(); setSignatureSales(""); }
      setCurrentStep(currentStep - 1);
    }
  }

  // ── Full submit (steps 2-5: approval may trigger) ──
  const mut = useMutation({
    mutationFn: (data: Parameters<typeof editBooking>[0]) => editBooking(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-approvals"] });
    },
  });

  async function handleUploadEvidence(termId: string, file: File) {
    if (!termId || termId.startsWith("new-")) return;
    setUploadingEvidenceId(termId);
    const fd = new FormData();
    fd.set("termId", termId);
    fd.set("file", file);
    try {
      const res = await fetch("/api/bookings/upload-evidence", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const { filePath } = await res.json() as { filePath: string };
      setTerms((prev) => prev.map((x) => x.id === termId ? { ...x, paymentEvidence: filePath } : x));
      toast.success("Bukti pembayaran berhasil diupload");
    } catch {
      toast.error("Gagal upload bukti pembayaran");
    } finally {
      setUploadingEvidenceId(null);
    }
  }

  async function handleSubmit() {
    if (!booking) return;
    const r = await mut.mutateAsync({
      id: booking.id,
      bookingDate: bookingDate ? format(new Date(bookingDate), "yyyy-MM-dd") : "",
      venueId, packageId,
      paymentMethodId: paymentMethodId || null,
      sourceOfInformationId: sourceOfInformationId || null,
      weddingSession: (weddingSession as "morning" | "evening" | "fullday") || null,
      weddingType: weddingType || null,
      signingLocation: signingLocation || null,
      customerName,
      contactNumbers: JSON.stringify(contactNumbers),
      contactEmailCpp, contactEmailCpw, contactNikCpp, contactNikCpw, contactCppAddress, contactCpwAddress, contactBitrixId,
      bonuses: bonuses.map((b) => ({ vendorId: b.vendorId, vendorCategoryId: b.vendorCategoryId, vendorName: b.vendorName, description: b.description || null, qty: b.qty, nominal: b.nominal })),
      complimentaries: complimentaries.map((c, i) => ({ complimentaryId: c.complimentaryId ?? null, name: c.name, price: c.price, isShowPrice: c.isShowPrice, description: c.description || null, qty: c.qty, sortOrder: i })),
      // Always send material-change fields so server can detect ALL material changes
      // (discount, takeout, TOP) — not just venue/package.
      termOfPayments: terms.filter((t) => t.dueDate).map((t) => ({ id: t.id, name: t.name, amount: t.amount, dueDate: t.dueDate, sortOrder: t.sortOrder, paymentStatus: t.paymentStatus, ackStatus: t.ackStatus })),
      specialBonusName: specialBonusName || null,
      specialBonusAmount: specialBonusAmount || null,
      // signatureSales: only include when current user IS the Sales PIC (step 5 shown)
      signatureSales: isSalesPIC ? (signatureSales || null) : null,
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
    });
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Booking berhasil diupdate.");
    onOpenChange(false);
  }

  const isContinueDisabled =
    (currentStep === 2 && !isStep2Complete) ||
    (currentStep === 3 && !isStep3Complete) ||
    (currentStep === 4 && !isStep4Complete) ||
    (currentStep === 5 && isSalesPIC && !isStep5Complete) ||
    mut.isPending;

  const sessionLabels: Record<string, string> = { morning: "Pagi", evening: "Malam", fullday: "Fullday" };

  // ── Lockedname for sales ──
  const lockedSalesName =
    salesUsers.find((s) => s.id === salesId)?.fullName ??
    (isSalesPIC ? (currentUser?.name ?? "—") : "—");

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Edit Booking"
      maxWidth="sm:max-w-xl"
      isCloseButton
      headerActions={
        <span className="text-sm text-muted-foreground">
          Step {currentStep} / {totalSteps}
        </span>
      }
    >
      <div className={cn("flex", "flex-col", "justify-between", "h-full")}>
        {/* ─── Tab/Step Navigator ─── */}
        <div className="mb-3 shrink-0 overflow-x-auto border-b scrollbar-none">
          <div className="flex w-max min-w-full gap-1">
            {([1, 2, 3, 4] as number[]).concat(isSalesPIC ? [5] : []).map((step) => (
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

              {/* Bitrix ID — conditional star kalau source=Bitrix */}
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

          {/* ─── Step 2: Venue / Package / Event Date / Session / Time / Note / Complimentary ─── */}
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
                    setSelectedPackagePrice(0);
                    setPaymentMethodId("");
                    setCategoryToggles({});
                    setTakeoutPrices({});
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
                  onChange={(id) => {
                    setPackageId(id);
                    setCategoryToggles({});
                    setTakeoutPrices({});
                    setLastAllocatedPrice(0);
                    const pkg = packages.find((x) => x.id === id);
                    if (pkg) {
                      const p = getPackagePrice(pkg);
                      setSelectedPackagePrice(p);
                      allocatePrice(p, specialBonusAmount);
                      setLastAllocatedPrice(p);
                    }
                  }}
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
                      {bookingDate ? format(new Date(bookingDate), "PPP") : "Pilih tanggal event"}
                    </Button>
                  } />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={bookingDate ? new Date(bookingDate) : undefined}
                      onSelect={(date) => { setBookingDate(date ? date.toISOString() : ""); setWeddingSession(""); }}
                      fromYear={new Date().getFullYear() - 10}
                      toYear={new Date().getFullYear() + 10}
                      defaultMonth={bookingDate ? new Date(bookingDate) : new Date()}
                      onMonthChange={setVisibleMonth}
                      disabled={(d) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isExistingDate = bookingDate && format(d, "yyyy-MM-dd") === format(new Date(bookingDate), "yyyy-MM-dd");
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
                    {(() => {
                      const dateStr = bookingDate ? format(new Date(bookingDate), "yyyy-MM-dd") : null;
                      return (dateStr ? getAvailableSessions(dateStr) : ["morning", "evening", "fullday"]).map((s) => (
                        <SelectItem key={s} value={s}>{sessionLabels[s] ?? s}</SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>

              {/* Complimentary */}
              <div className="space-y-2">
                <label className={LBL}>Complimentary</label>

                {complimentaryMode === "none" && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 rounded-xl border-dashed text-sm" onClick={() => setComplimentaryMode("picker")}>
                      <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
                      Pilih dari Daftar
                    </Button>
                    {canCreateComplimentary && (
                      <Button type="button" variant="outline" className="flex-1 rounded-xl border-dashed text-sm" onClick={() => { setComplimentaryMode("create-new"); setCreateNewComp({ name: "", price: 0, description: "", isShowPrice: false }); }}>
                        <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
                        Buat Baru
                      </Button>
                    )}
                  </div>
                )}

                {complimentaryMode === "picker" && (
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Pilih dari daftar master</p>
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setComplimentaryMode("none")}>Batal</button>
                    </div>
                    <SearchableSelect
                      options={complimentaryOptions
                        .filter((opt) => !complimentaries.some((c) => c.complimentaryId === opt.id))
                        .map((opt) => ({ id: opt.id, name: opt.name }))}
                      value=""
                      onChange={(cId) => {
                        const opt = complimentaryOptions.find((c) => c.id === cId);
                        if (opt) {
                          setComplimentaries((prev) => [...prev, { id: `new-${Date.now()}`, complimentaryId: opt.id, name: opt.name, price: opt.price, isShowPrice: opt.isShowPrice, description: "", qty: 1 }]);
                          setComplimentaryMode("none");
                        }
                      }}
                      placeholder="Cari complimentary..."
                      searchPlaceholder="Cari complimentary..."
                      emptyText="Tidak ada complimentary"
                    />
                  </div>
                )}

                {complimentaryMode === "create-new" && (
                  <div className="rounded-xl border border-border bg-card p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Tambah complimentary baru ke master</p>
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setComplimentaryMode("none")}>Batal</button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">Nama <span className="text-destructive">*</span></label>
                      <Input value={createNewComp.name} onChange={(e) => setCreateNewComp((p) => ({ ...p, name: e.target.value }))} placeholder="Nama complimentary..." className="h-8 text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                        <input
                          type="text" inputMode="numeric"
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background"
                          placeholder="Harga (opsional)"
                          value={createNewComp.price ? fmtRp(createNewComp.price) : ""}
                          onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setCreateNewComp((p) => ({ ...p, price: n })); }}
                        />
                      </div>
                      <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                        <Switch checked={createNewComp.isShowPrice} onCheckedChange={(v) => setCreateNewComp((p) => ({ ...p, isShowPrice: v }))} />
                        <span className="text-xs text-muted-foreground">Tampil harga</span>
                      </label>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">Deskripsi</label>
                      <Textarea value={createNewComp.description} onChange={(e) => setCreateNewComp((p) => ({ ...p, description: e.target.value }))} placeholder="Keterangan complimentary (opsional)..." rows={2} className="resize-none text-sm" />
                    </div>
                    <Button
                      type="button"
                      className="w-full rounded-xl"
                      disabled={!createNewComp.name.trim() || isCreatingComp}
                      onClick={async () => {
                        if (!createNewComp.name.trim() || isCreatingComp) return;
                        setIsCreatingComp(true);
                        try {
                          const result = await createComplimentary({ name: createNewComp.name.trim(), price: createNewComp.price, description: createNewComp.description.trim() || null, isShowPrice: createNewComp.isShowPrice, isActive: true });
                          if (result.success && result.item) {
                            setComplimentaries((prev) => [...prev, { id: `new-${Date.now()}`, complimentaryId: result.item!.id, name: result.item!.name, price: result.item!.price, isShowPrice: result.item!.isShowPrice, description: result.item!.description ?? "", qty: 1 }]);
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

                {complimentaries.map((c) => {
                  const isOpen = !collapsedComplimentaries.has(c.id);
                  return (
                    <Collapsible key={c.id} open={isOpen} onOpenChange={() => toggleComplimentaryCollapse(c.id)} className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                      <div className="flex items-center gap-1 px-3 py-2.5">
                        <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
                          <AltArrowDown weight="BoldDuotone" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                            {!isOpen && <p className="text-xs text-muted-foreground tabular-nums">{c.isShowPrice && c.price ? `Rp${fmtRp(c.price)}` : "Harga tidak ditampilkan"}</p>}
                          </div>
                        </CollapsibleTrigger>
                        <button type="button" className="shrink-0 p-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" onClick={(e) => { e.stopPropagation(); setComplimentaries((prev) => prev.filter((x) => x.id !== c.id)); setCollapsedComplimentaries((prev) => { const next = new Set(prev); next.delete(c.id); return next; }); }} aria-label="Hapus complimentary">
                          <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                              <input type="text" inputMode="numeric" className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background" placeholder="Harga" value={c.price ? fmtRp(c.price) : ""} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, price: n } : x)); }} />
                            </div>
                            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                              <Switch checked={c.isShowPrice} onCheckedChange={(v) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, isShowPrice: v } : x))} />
                              <span className="text-xs text-muted-foreground">Tampil harga</span>
                            </label>
                          </div>
                          <Textarea value={c.description} onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, description: e.target.value } : x))} placeholder="Keterangan complimentary..." rows={2} className="resize-none text-sm" />
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

          {/* ─── Step 3: Takeout ─── */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {/* Sticky price summary */}
              <div className="sticky top-0 z-10 bg-background pb-2">
                <div className="rounded-2xl border bg-card shadow-sm p-4">
                  <p className="text-xs text-muted-foreground mb-1">Harga setelah takeout</p>
                  <p className="text-xl font-semibold font-heading text-foreground">Rp{fmtRp(step3Price)}</p>
                  {totalTakeoutNominal > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="line-through">Rp{fmtRp(fullPrice)}</span>
                      <span className="ml-2 text-destructive font-medium">-Rp{fmtRp(totalTakeoutNominal)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">Kategori Harga Package</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Tandai kategori sebagai takeout jika klien menyediakan sendiri. Harga otomatis berkurang.</p>
              </div>
              {visibleCategories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Tidak ada kategori harga untuk variant ini.</p>
              )}
              <div className="space-y-2">
                {visibleCategories.map((cat) => {
                  const isTakeout = categoryToggles[cat.categoryName] ?? false;
                  const takeoutNominal = takeoutPrices[cat.categoryName] ?? cat.basePrice;
                  return (
                    <div key={cat.categoryName} className={cn("rounded-lg", "border", "p-3", isTakeout && "border-destructive/30 bg-destructive/5")}>
                      <div className={cn("flex", "items-center", "justify-between")}>
                        <div>
                          <p className={cn("text-sm font-medium", isTakeout && "line-through text-muted-foreground")}>{cat.categoryName}</p>
                          <p className={cn("text-xs text-muted-foreground", isTakeout && "line-through")}>Rp{fmtRp(cat.basePrice)}</p>
                        </div>
                        <div className={cn("flex", "items-center", "gap-2")}>
                          <span className={cn("text-xs", isTakeout ? "text-destructive font-medium" : "text-muted-foreground")}>Takeout</span>
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
                              type="text" inputMode="numeric"
                              className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                              value={takeoutNominal ? fmtRp(takeoutNominal) : ""}
                              onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setTakeoutPrices((prev) => ({ ...prev, [cat.categoryName]: num })); }}
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

          {/* ─── Step 4: Term of Payments ─── */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <label className={LBL}>Total Harga Package</label>
                <Input disabled value={`Rp${fmtRp(getPriceAfterDiscount())}`} className="mt-1" />
              </div>

              {/* Discount / Special Bonus */}
              <div className={cn("flex", "flex-col", "gap-2", "border-y", "py-4")}>
                <Input
                  placeholder="Nama bonus (e.g. Discount)"
                  value={specialBonusName}
                  onChange={(e) => setSpecialBonusName(e.target.value)}
                  className="border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto"
                />
                <Input
                  placeholder="IDR. 0"
                  value={specialBonusAmount ? fmtRp(specialBonusAmount) : ""}
                  onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setSpecialBonusAmount(num); allocatePrice(getBasePrice(), num); }}
                  inputMode="numeric"
                  className="rounded-none"
                />
                <p className={cn("text-xs", "text-muted-foreground")}>Input ini akan ditampilkan di dokumen PO. Terms otomatis di-recalculate saat discount diubah.</p>
              </div>

              {/* Payment Method */}
              <div>
                <label className={LBL}>Pembayaran Melalui <span className="text-destructive">*</span></label>
                <BankAccountSelect value={paymentMethodId} onChange={setPaymentMethodId} placeholder={venueId ? "Pilih metode pembayaran" : "Pilih venue dulu"} disabled={!venueId} venueId={venueId} />
              </div>

              {/* Term of Payments */}
              <div>
                <label className={cn(LBL, "mb-2 block")}>Term of Payments</label>
                <div className="space-y-2">
                  {terms.map((t, idx) => {
                    const isPaid = isLockedTerm(t);
                    const isEditable = isPaid && unlockedTerms.has(idx);
                    const isInputDisabled = isPaid && !isEditable;
                    const isOpen = !collapsedTerms.has(idx);
                    const statusLabel = PAYMENT_STATUS_LABELS[t.paymentStatus] ?? t.paymentStatus;
                    return (
                      <Collapsible key={t.id ?? idx} open={isOpen} onOpenChange={() => toggleTerm(idx)} className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                        <div className="flex items-center gap-1 px-3 py-2.5">
                          <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
                            <AltArrowDown weight="BoldDuotone" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", t.name ? "text-foreground" : "text-muted-foreground italic")}>
                                {t.name || "Term tanpa nama"}
                                {isPaid && <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">{statusLabel}</span>}
                              </p>
                              {!isOpen && (
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  <span className={cn(isPaid ? "text-foreground" : "text-muted-foreground")}>{statusLabel}</span>
                                  {t.amount ? ` · Rp${fmtRp(t.amount)}` : ""}
                                  {t.dueDate ? ` · ${format(new Date(t.dueDate), "dd MMM yyyy")}` : ""}
                                </p>
                              )}
                            </div>
                          </CollapsibleTrigger>
                          {/* Pencil button — locked terms only */}
                          {isPaid && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUnlockedTerms((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
                                  return next;
                                });
                              }}
                              aria-label={isEditable ? "Kunci term" : "Edit term"}
                              className={cn("shrink-0 p-1 rounded-lg transition-colors", isEditable ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
                            >
                              <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* Delete button — non-paid terms only, if >1 term */}
                          {terms.length > 1 && !isPaid && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTerms((prev) => recalcTermDates(prev.filter((_, i) => i !== idx), bookingDate));
                                setCollapsedTerms((prev) => { const next = new Set<number>(); prev.forEach((n) => { if (n < idx) { next.add(n); } else if (n > idx) { next.add(n - 1); } }); return next; });
                                setUnlockedTerms((prev) => { const next = new Set<number>(); prev.forEach((n) => { if (n < idx) { next.add(n); } else if (n > idx) { next.add(n - 1); } }); return next; });
                              }}
                              aria-label="Hapus term"
                              className="shrink-0 p-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-3 border-t border-border/60">
                            <div className="pt-2 flex items-center gap-2">
                              <div className="flex flex-1 min-w-0 items-center gap-1">
                                <Input
                                  value={t.name}
                                  onChange={(e) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                                  placeholder="Nama term (mis. Booking Fee)"
                                  disabled={isInputDisabled}
                                  className={cn("border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto", isInputDisabled && "opacity-60 cursor-not-allowed")}
                                />
                              </div>
                              {isPaid ? (
                                <span className="shrink-0 inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-semibold bg-primary/10 text-primary">{statusLabel}</span>
                              ) : (
                                <Select
                                  value={t.paymentStatus}
                                  onValueChange={(v) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentStatus: v as TermPaymentStatus } : x))}
                                >
                                  <SelectTrigger className="w-32 h-8 bg-background shrink-0">
                                    <span className="text-xs font-semibold text-muted-foreground">{statusLabel}</span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(["unpaid", "paid"] as TermPaymentStatus[]).map((s) => (
                                      <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                                    ))}
                                    {t.paymentStatus === "partial" && (
                                      <SelectItem value="partial" disabled>{PAYMENT_STATUS_LABELS.partial}</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                              <div className="sm:flex-[2]">
                                <Input
                                  value={t.amount ? fmtRp(t.amount) : ""}
                                  onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, amount: num } : x)); }}
                                  placeholder="Amount"
                                  inputMode="numeric"
                                  disabled={isInputDisabled}
                                  className={cn("bg-background", isInputDisabled && "opacity-60 cursor-not-allowed")}
                                />
                              </div>
                              <div className="sm:flex-1">
                                {isInputDisabled ? (
                                  <div className={cn("flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/40 text-xs text-muted-foreground cursor-not-allowed")}>
                                    <CalendarIcon weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                                    <span>{t.dueDate ? format(new Date(t.dueDate), "dd MMM yyyy") : "—"}</span>
                                  </div>
                                ) : (
                                  <Popover>
                                    <PopoverTrigger render={
                                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs bg-background", !t.dueDate && "text-muted-foreground")}>
                                        <CalendarIcon weight="BoldDuotone" className="mr-2 h-3.5 w-3.5" />
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
                                )}
                              </div>
                            </div>

                            {/* Bukti pembayaran */}
                            {isPaid && (
                              <div>
                                {t.paymentEvidence ? (
                                  <div className="flex items-center gap-2">
                                    <a href={t.paymentEvidence} target="_blank" rel="noopener noreferrer" className={cn("flex flex-1 items-center gap-2 px-3 py-2 rounded-xl border border-border", "bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50 transition-colors min-w-0")}>
                                      <FileText weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                                      <span className="flex-1 truncate">Lihat bukti pembayaran</span>
                                    </a>
                                    {t.id && !t.id.startsWith("new-") && (
                                      <label className={cn("relative shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border border-border", "bg-background text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors", uploadingEvidenceId === t.id && "pointer-events-none opacity-50")}>
                                        <UploadMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5" />
                                        <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const file = e.target.files?.[0]; if (file && t.id) { void handleUploadEvidence(t.id, file); } e.target.value = ""; }} />
                                      </label>
                                    )}
                                  </div>
                                ) : (
                                  t.id && !t.id.startsWith("new-") ? (
                                    <label className={cn("relative flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border", "bg-muted/20 text-xs text-muted-foreground hover:bg-muted/40 cursor-pointer transition-colors", uploadingEvidenceId === t.id && "pointer-events-none opacity-50")}>
                                      <UploadMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                                      <span className="flex-1 truncate">{uploadingEvidenceId === t.id ? "Mengupload..." : "Upload bukti pembayaran"}</span>
                                      <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const file = e.target.files?.[0]; if (file && t.id) { void handleUploadEvidence(t.id, file); } e.target.value = ""; }} />
                                    </label>
                                  ) : null
                                )}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <Button type="button" variant="outline" className="w-full border-dashed gap-1.5 text-muted-foreground rounded-xl" onClick={() => { setTerms((prev) => recalcTermDates([...prev, { name: "", amount: 0, dueDate: "", sortOrder: prev.length, paymentStatus: "unpaid" }], bookingDate)); }}>
                    <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                    Tambah Payment
                  </Button>
                </div>
              </div>

              {/* Summary */}
              <div className={cn("p-3", "bg-muted", "rounded-lg")}>
                <div className={cn("flex", "justify-between", "items-center", "mb-2")}><span className="text-sm font-medium text-foreground">Harga Paket:</span><span className="text-sm font-medium text-foreground">Rp{fmtRp(getBasePrice())}</span></div>
                <div className={cn("flex", "justify-between", "items-center", "mb-2")}><span className="text-sm font-medium text-destructive">{specialBonusName || "Discount"}:</span><span className="text-sm font-medium text-destructive">- Rp{fmtRp(specialBonusAmount)}</span></div>
                <div className={cn("flex", "justify-between", "items-center", "mb-2", "border-t", "pt-2")}><span className="text-sm font-medium text-foreground">Harga Setelah Discount:</span><span className="text-sm font-medium text-foreground">Rp{fmtRp(getPriceAfterDiscount())}</span></div>
                {getLockedTotal() > 0 && (
                  <div className={cn("flex", "justify-between", "items-center", "mb-2")}>
                    <span className="text-sm text-muted-foreground">Sudah Terkunci (Paid):</span>
                    <span className="text-sm text-muted-foreground">Rp{fmtRp(getLockedTotal())}</span>
                  </div>
                )}
                <div className={cn("flex", "justify-between", "items-center", "mb-2")}><span className="text-sm font-medium text-foreground">Total Input User:</span><span className="text-sm font-medium text-foreground">Rp{fmtRp(getTotalTerms())}</span></div>
                <div className={cn("flex", "justify-between", "items-center")}><span className="text-sm font-medium text-foreground">Selisih:</span><span className={cn("text-sm font-medium", getDifference() !== 0 ? "text-destructive" : "text-foreground")}>Rp{fmtRp(Math.abs(getDifference()))}{getDifference() < 0 ? " (Kurang)" : getDifference() > 0 ? " (Lebih)" : " (Sesuai)"}</span></div>
              </div>
            </div>
          )}

          {/* ─── Step 5: Signing (Sales PIC only) ─── */}
          {currentStep === 5 && isSalesPIC && (
            <div className="space-y-6">
              <div>
                <label className={cn(LBL, "mb-2 block")}>Lokasi Tanda Tangan <span className="text-destructive">*</span></label>
                <Input placeholder="Contoh: Jakarta, Bandung..." value={signingLocation} onChange={(e) => setSigningLocation(e.target.value)} />
              </div>
              <div>
                <label className={cn(LBL, "mb-2 block")}>Tanda Tangan Sales <span className="text-destructive">*</span></label>
                <div className={cn("border-2 border-dashed rounded-xl overflow-hidden bg-muted", !signatureSales ? "border-destructive/40" : "border-border")}>
                  <SignatureCanvas ref={sigSalesRef} penColor="black" canvasProps={{ className: "w-full", style: { width: "100%", height: 200, touchAction: "none" } }} onEnd={() => { if (sigSalesRef.current) setSignatureSales(sigSalesRef.current.toDataURL("image/png")); }} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  {!signatureSales && <p className="text-xs text-destructive">Tanda tangan sales wajib diisi</p>}
                  <button type="button" onClick={() => { sigSalesRef.current?.clear(); setSignatureSales(""); }} className="text-xs text-destructive hover:text-destructive underline ml-auto">Hapus tanda tangan</button>
                </div>
              </div>
              {hasSignificantChange && (
                <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 space-y-1">
                  <p className="text-xs font-semibold text-destructive">Perhatian</p>
                  <p className="text-xs text-destructive/80">Menyimpan perubahan ini akan mereset seluruh approval. Manager dan Client harus menandatangani ulang PO ini.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="bg-background sticky bottom-0 z-10">
          <div className="flex py-4 gap-2">
            {currentStep === 1 ? (
              /* Step 1: Save & Publish (no Cancel, no Previous) */
              <Button
                onClick={handleSaveClientInfo}
                disabled={isSavingClientInfo || !isStep1Complete}
                className={cn("w-full cursor-pointer", (isSavingClientInfo || !isStep1Complete) && "opacity-50 cursor-not-allowed")}
              >
                {isSavingClientInfo ? "Menyimpan..." : "Save & Publish"}
              </Button>
            ) : (
              /* Steps 2-5: Previous + Continue/Update */
              <>
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={mut.isPending}
                  className="flex-[40%] cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  onClick={currentStep < totalSteps ? handleNext : handleSubmit}
                  disabled={isContinueDisabled}
                  className={cn("flex-[60%] cursor-pointer", isContinueDisabled && "opacity-50 cursor-not-allowed")}
                >
                  {currentStep < totalSteps
                    ? "Continue"
                    : mut.isPending
                      ? "Updating..."
                      : hasSignificantChange
                        ? "Update Booking"
                        : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
