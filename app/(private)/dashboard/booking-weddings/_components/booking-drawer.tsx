"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { Calendar as CalendarIcon, FileText, TrashBinTrash, CloseCircle } from "@solar-icons/react";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import { AutocompleteInput } from "@/components/shared/AutocompleteInput";
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
import { cn } from "@/lib/utils";
import { useCreateBooking } from "@/hooks/use-bookings";
import type { BookingInput } from "@/lib/validations/booking";
import type { MobileNumberEntry } from "@/lib/validations/customer";

interface BookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Option = { id: string; name: string };
interface CustomerOption { id: string; name: string; mobileNumber: string; email: string; nikNumber: string | null; ktpAddress: string | null; sourceOfInformationId: string | null; bitrixId: string | null }
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
  variants: {
    id: string;
    variantName: string;
    pax: number;
    margin: number;
    sellingPrice: number;
    categoryPrices: CategoryPriceEntry[];
  }[];
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
  const [prev, setPrev] = useState(file);
  const [url, setUrl] = useState<string | null>(() => file.type.startsWith("image/") ? URL.createObjectURL(file) : null);

  if (prev !== file) {
    if (url) URL.revokeObjectURL(url);
    setUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setPrev(file);
  }

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="relative z-10 h-10 w-10 object-cover rounded border shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpen(); }} />;
}

function getVariantPrice(v: PackageData["variants"][number]) {
  if (v.sellingPrice > 0) return v.sellingPrice;
  const base = (v.categoryPrices ?? []).reduce((s, c) => s + Number(c.basePrice), 0);
  return base + Math.round(base * ((v.margin ?? 0) / 100));
}


function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

function makeDefaultTerms(): TermRow[] {
  return [
    { name: "Booking Fee", amount: 0, dueDate: toLocalISO(new Date()), sortOrder: 0, paymentStatus: "unpaid" },
    { name: "DP", amount: 0, dueDate: "", sortOrder: 1, paymentStatus: "unpaid" },
    { name: "Angsuran 1", amount: 0, dueDate: "", sortOrder: 2, paymentStatus: "unpaid" },
    { name: "Angsuran 2", amount: 0, dueDate: "", sortOrder: 3, paymentStatus: "unpaid" },
    { name: "Pelunasan 1", amount: 0, dueDate: "", sortOrder: 4, paymentStatus: "unpaid" },
    { name: "Pelunasan 2", amount: 0, dueDate: "", sortOrder: 5, paymentStatus: "unpaid" },
    { name: "Final", amount: 0, dueDate: "", sortOrder: 6, paymentStatus: "unpaid" },
  ];
}

function recalcTermDates(terms: TermRow[], eventDate: string): TermRow[] {
  if (!eventDate || terms.length === 0) return terms;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const totalMs = event.getTime() - now.getTime();
  if (totalMs <= 0) return terms;
  const n = terms.length;
  return terms.map((t, i) => ({
    ...t,
    dueDate: toLocalISO(new Date(now.getTime() + Math.round((totalMs * i) / (n - 1 || 1)))),
  }));
}

const DRAFT_KEY = "booking_draft";

interface BookingDraft {
  currentStep: number;
  customerName: string;
  contactNumbers: MobileNumberEntry[];
  contactEmail: string;
  contactNik: string;
  contactKtpAddress: string;
  contactBitrixId: string;
  noteDateEvent: string;
  signingLocation: string;
  specialBonusName: string;
  specialBonusAmount: number;
  selectedVenueId: string;
  selectedPackageId: string;
  selectedVariantPrice: number;
  bonuses: BonusRow[];
  terms: TermRow[];
  formValues: Record<string, unknown>;
  takeoutPrices?: Record<string, number>;
  categoryToggles?: Record<string, boolean>;
}

function saveDraft(d: BookingDraft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* noop */ }
}
function loadDraft(): BookingDraft | null {
  try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
}

export function BookingDrawer({ open, onOpenChange }: BookingDrawerProps) {
  const createMut = useCreateBooking();
  const qc = useQueryClient();
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
  const [contactNik, setContactNik] = useState("");
  const [contactKtpAddress, setContactKtpAddress] = useState("");
  const [contactBitrixId, setContactBitrixId] = useState("");
  const [noteDateEvent, setNoteDateEvent] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(customerSearch), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const { data: customersResult } = useQuery({
    queryKey: ["customers", debouncedSearch],
    queryFn: () => fetchJson<{ data: CustomerOption[] }>(`/api/customers?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30_000,
  });
  const customers = customersResult?.data ?? [];
  const { data: venues = [] } = useQuery({ queryKey: ["venues"], queryFn: () => fetchJson<Option[]>("/api/venues"), staleTime: 5 * 60_000 });
  const { data: sourceOptions = [] } = useQuery({ queryKey: ["source-of-informations"], queryFn: () => fetchJson<Option[]>("/api/source-of-informations"), staleTime: 5 * 60_000 });
  const { data: vendorCategories = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchJson<VendorCategoryData[]>("/api/vendors"), staleTime: 5 * 60_000 });

  const [selectedVenueId, setSelectedVenueId] = useState("");
  const { data: packages = [], isLoading: packagesLoading } = useQuery({ queryKey: ["packages", selectedVenueId, "booking"], queryFn: () => fetchJson<PackageData[]>(`/api/packages?venueId=${selectedVenueId}&forBooking=true`), enabled: !!selectedVenueId, staleTime: 5 * 60_000 });

  const [selectedPackageId, setSelectedPackageId] = useState("");
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const variants = selectedPackage?.variants ?? [];
  const [selectedVariantPrice, setSelectedVariantPrice] = useState(0);
  const [categoryToggles, setCategoryToggles] = useState<Record<string, boolean>>({}); // categoryName -> isTakeout
  const [takeoutPrices, setTakeoutPrices] = useState<Record<string, number>>({}); // categoryName -> editable takeout nominal

  // Venue availability
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [availLoading, setAvailLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [selectedVariantId, setSelectedVariantId] = useState("");

  useEffect(() => {
    if (!selectedVenueId) { setAvailability({}); return; }
    setAvailLoading(true);
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    // Availability is per-venue — do NOT pass packageId/variantId.
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
  const allVendors = vendorCategories.flatMap((c) => c.vendors.map((v) => ({ ...v, categoryId: c.id, categoryName: c.name })));
  const availableVendorsForBonus = allVendors.filter((v) => !bonuses.some((b) => b.vendorId === v.id));

  const [terms, setTerms] = useState<TermRow[]>(makeDefaultTerms);

  const form = useForm<BookingInput>({
    defaultValues: {
      bookingDate: "", customerId: "", venueId: "", packageId: "",
      packageVariantId: null, paymentMethodId: null, sourceOfInformationId: null,
      weddingSession: null, weddingType: null, bonuses: [], termOfPayments: [],
      specialBonusName: null, specialBonusAmount: null,
      signingLocation: null, signatureSales: null,
      withMaterai: false,
    },
  });

  useEffect(() => {
    if (open) {
      const draft = loadDraft();
      if (draft) {
        setCurrentStep(draft.currentStep);
        setCustomerName(draft.customerName);
        setContactNumbers(draft.contactNumbers);
        setContactEmail(draft.contactEmail);
        setContactNik(draft.contactNik);
        setContactKtpAddress(draft.contactKtpAddress);
        setContactBitrixId(draft.contactBitrixId ?? "");
        setNoteDateEvent(draft.noteDateEvent);
        setSigningLocation(draft.signingLocation);
        setSpecialBonusName(draft.specialBonusName);
        setSpecialBonusAmount(draft.specialBonusAmount);
        setSelectedVenueId(draft.selectedVenueId);
        setSelectedPackageId(draft.selectedPackageId);
        setSelectedVariantPrice(draft.selectedVariantPrice);
        setBonuses(draft.bonuses);
        setTerms(draft.terms.some((t) => t.dueDate) ? draft.terms : makeDefaultTerms());
        if (draft.takeoutPrices) setTakeoutPrices(draft.takeoutPrices);
        if (draft.categoryToggles) setCategoryToggles(draft.categoryToggles);
        form.reset(draft.formValues as BookingInput);
      } else {
        form.reset();
        setSelectedVenueId(""); setSelectedPackageId(""); setSelectedVariantPrice(0);
        setBonuses([]); setTerms(makeDefaultTerms());
        setCurrentStep(1); setSignatureSales(""); setSigningLocation("");
        setSpecialBonusName("Discount"); setSpecialBonusAmount(0);
        setContactNumbers([]); setContactEmail(""); setContactNik(""); setContactKtpAddress(""); setContactBitrixId(""); setNoteDateEvent(""); setCustomerName("");
        setTakeoutPrices({});
        setCategoryToggles({});
        sigSalesRef.current?.clear();
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft (debounced)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft({
        currentStep, customerName, contactNumbers, contactEmail, contactNik,
        contactKtpAddress,
      contactBitrixId, noteDateEvent, signingLocation, specialBonusName,
        specialBonusAmount, selectedVenueId, selectedPackageId, selectedVariantPrice,
        bonuses, terms, formValues: form.getValues(), takeoutPrices, categoryToggles,
      });
    }, 500);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [open, currentStep, customerName, contactNumbers, contactEmail, contactNik, contactKtpAddress, contactBitrixId, noteDateEvent, signingLocation, specialBonusName, specialBonusAmount, selectedVenueId, selectedPackageId, selectedVariantPrice, bonuses, terms, takeoutPrices, categoryToggles]); // eslint-disable-line react-hooks/exhaustive-deps

  const getBasePrice = () => selectedVariantPrice;
  const getPriceAfterDiscount = () => Math.max(0, getBasePrice() - specialBonusAmount);
  const getTotalTerms = () => terms.reduce((s, t) => s + (t.amount || 0), 0);
  const getDifference = () => getTotalTerms() - getPriceAfterDiscount();

  const allocatePrice = (price: number, discount: number) => {
    const total = Math.max(0, price - discount);
    const n = terms.length || 1;
    const base = Math.floor(total / n);
    const remainder = total % n;
    setTerms((prev) => prev.map((t, i) => ({ ...t, amount: i === n - 1 ? base + remainder : base })));
  };

  const [wVenueId, wPackageId, wBookingDate, wWeddingSession, wWeddingType, wVariantId, wSourceOfInformationId, wPaymentMethodId] = form.watch(["venueId", "packageId", "bookingDate", "weddingSession", "weddingType", "packageVariantId", "sourceOfInformationId", "paymentMethodId"]);
  const isBitrixSource = sourceOptions.find((o) => o.id === wSourceOfInformationId)?.name.toLowerCase().includes("bitrix") ?? false;
  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0 && wVenueId && wPackageId && wBookingDate && wWeddingSession && wWeddingType && (variants.length === 0 || wVariantId) && wSourceOfInformationId && (!isBitrixSource || contactBitrixId.trim()));

  const selectedVariantData = packages
    .flatMap((p: PackageData) => p.variants)
    .find((v) => v.id === wVariantId);

  const allCategoryPrices = selectedVariantData?.categoryPrices ?? [];
  const visibleCategories = allCategoryPrices.filter((c) => c.isShow);
  const hiddenCategoriesBase = allCategoryPrices
    .filter((c) => !c.isShow)
    .reduce((sum, c) => sum + c.basePrice, 0);
  const margin = selectedVariantData?.margin ?? 0;

  const step2Price = (() => {
    const hasTakeout = visibleCategories.some((c) => categoryToggles[c.categoryName]);
    if (!hasTakeout && selectedVariantData?.sellingPrice && selectedVariantData.sellingPrice > 0) {
      return selectedVariantData.sellingPrice;
    }
    const visibleBase = visibleCategories.reduce(
      (sum, c) => sum + (categoryToggles[c.categoryName] ? 0 : c.basePrice),
      0,
    );
    const base = visibleBase + hiddenCategoriesBase;
    return base + Math.round(base * (margin / 100));
  })();

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

  const handleNext = () => {
    if (currentStep === 1 && !isStep1Complete) {
      if (!wSourceOfInformationId) { toast.error("Sumber informasi wajib diisi."); return; }
      if (isBitrixSource && !contactBitrixId.trim()) { toast.error("Bitrix ID wajib diisi jika sumber informasi adalah Bitrix."); return; }
      toast.error("Lengkapi field yang wajib diisi terlebih dahulu.");
      return;
    }
    if (currentStep === 2 && !isStep2Complete) {
      toast.error("Minimal satu kategori harus tetap included.");
      return;
    }
    // When advancing from Step 2 to Step 3, sync price with takeout selection
    if (currentStep === 2) {
      setSelectedVariantPrice(step2Price);
      allocatePrice(step2Price, specialBonusAmount);
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
    const payload: BookingInput = {
      ...values,
      customerId: values.customerId || "",
      customerName: customerName || "",
      contactNumbers: JSON.stringify(contactNumbers),
      contactEmail,
      contactNik,
      contactKtpAddress,
      contactBitrixId: isBitrixSource ? contactBitrixId : "",
      specialBonusName: specialBonusName || null,
      specialBonusAmount: specialBonusAmount || null,
      signingLocation: signingLocation || null,
      signatureSales: signatureSales || null,
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

    // Upload payment evidence per term jika ada
    const termsWithEvidence = terms.filter((t) => t.dueDate && t.paymentEvidence);
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

    clearDraft();
    toast.success("Booking berhasil dibuat.");
    onOpenChange(false);
  }

  const isContinueDisabled =
    (currentStep === 1 && !isStep1Complete) ||
    (currentStep === 2 && !isStep2Complete) ||
    (currentStep === 3 && !isStep3Complete) ||
    (currentStep === 4 && !isStep4Complete) ||
    createMut.isPending;

  return (
    <Drawer isOpen={open} onClose={() => onOpenChange(false)} title="New Booking" maxWidth="sm:max-w-xl" steps={currentStep} totalSteps={totalSteps} isCloseButton={false}>
      <div className={cn('flex', 'flex-col', 'justify-between', 'h-full')}>
        <div className={cn('flex-1', 'overflow-y-auto', 'px-2')}>
          <Form {...form}>
            <form className="space-y-4">
              {/* ─── Step 1: Data Booking ─── */}
              {currentStep === 1 && (
                <div className="space-y-3">
                  {/* Customer */}
                  {/* Customer */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Customer Name *</FormLabel>
                    <AutocompleteInput
                      options={customers.map((c) => ({ id: c.id, name: c.name }))}
                      value={customerName}
                      onChange={(val) => {
                        setCustomerName(val);
                        setCustomerSearch(val);
                        form.setValue("customerId", "");
                      }}
                      onSelect={(opt) => {
                        setCustomerName(opt.name);
                        form.setValue("customerId", opt.id);
                        const c = customers.find((x) => x.id === opt.id);
                        if (c) {
                          if (c.mobileNumber) {
                            const entries = Array.isArray(c.mobileNumber)
                              ? (c.mobileNumber as MobileNumberEntry[])
                              : String(c.mobileNumber).split(",").map((n) => ({ name: "", number: n.trim() })).filter((e) => e.number);
                            setContactNumbers(entries);
                          }
                          if (c.email) setContactEmail(c.email);
                          if (c.nikNumber) setContactNik(c.nikNumber);
                          if (c.ktpAddress) setContactKtpAddress(c.ktpAddress);
                          if (c.bitrixId) setContactBitrixId(c.bitrixId);
                          if (c.sourceOfInformationId) form.setValue("sourceOfInformationId", c.sourceOfInformationId);
                        }
                      }}
                      placeholder="e.g. John Doe & Jane Doe"
                      className="mt-1"
                    />
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

                  {/* NIK */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>NIK Number</FormLabel>
                    <Input placeholder="e.g. 3275010101010001" value={contactNik} onChange={(e) => setContactNik(e.target.value.replace(/\D/g, "").slice(0, 16))} inputMode="numeric" maxLength={16} className="mt-1" />
                  </div>

                  {/* Alamat KTP */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Alamat (sesuai KTP)</FormLabel>
                    <Textarea placeholder="e.g. Jl. Melati No. 10, Jakarta Selatan" value={contactKtpAddress} onChange={(e) => setContactKtpAddress(e.target.value)} rows={3} className="mt-1" />
                  </div>

                  {/* Venue */}
                  <FormField control={form.control} name="venueId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Venue *</FormLabel>
                      <SearchableSelect options={venues} value={field.value} onChange={(id) => { field.onChange(id); setSelectedVenueId(id); setSelectedPackageId(""); setSelectedVariantId(""); setSelectedVariantPrice(0); setCategoryToggles({}); setTakeoutPrices({}); form.setValue("packageId", ""); form.setValue("packageVariantId", null); form.setValue("paymentMethodId", null); }} placeholder="Pilih venue..." searchPlaceholder="Cari venue..." emptyText="Tidak ada venue" />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Pilih Paket */}
                  <FormField control={form.control} name="packageId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Pilih Paket *</FormLabel>
                      <SearchableSelect options={packages.map((p) => ({ id: p.id, name: p.packageName }))} value={field.value} onChange={(id) => { field.onChange(id); setSelectedPackageId(id); setSelectedVariantId(""); setSelectedVariantPrice(0); setCategoryToggles({}); setTakeoutPrices({}); form.setValue("packageVariantId", null); }} placeholder={!selectedVenueId ? "Pilih venue dulu" : packagesLoading ? "Memuat paket..." : "Pilih paket..."} disabled={!selectedVenueId || packagesLoading} searchPlaceholder="Cari paket..." emptyText="Tidak ada paket" />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Pilih Tipe Paket */}
                  {variants.length > 0 && (
                    <FormField control={form.control} name="packageVariantId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Pilih Tipe Paket *</FormLabel>
                        <SearchableSelect options={variants.map((v) => ({ id: v.id, name: `${v.variantName} · ${v.pax} PAX · Rp ${fmtRp(getVariantPrice(v))}` }))} value={field.value ?? ""} onChange={(id) => { field.onChange(id); setSelectedVariantId(id); setCategoryToggles({}); setTakeoutPrices({}); const v = variants.find((x) => x.id === id); if (v) { const p = getVariantPrice(v); setSelectedVariantPrice(p); allocatePrice(p, specialBonusAmount); } }} placeholder="Pilih tipe paket..." searchPlaceholder="Cari..." emptyText="Tidak ada variant" />
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

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
                            toYear={new Date().getFullYear() + 5}
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

                  {/* Note Date Event */}
                  <div>
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Note Date Event</FormLabel>
                    <Textarea placeholder="Add note for date event" value={noteDateEvent} onChange={(e) => setNoteDateEvent(e.target.value)} rows={3} className="mt-1" />
                  </div>

                  {/* Complimentary (Bonus) */}
                  <div className="space-y-2">
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground')}>Complimentary (Bonus)</FormLabel>
                    <SearchableSelect
                      options={availableVendorsForBonus.map((v) => ({ id: v.id, name: v.name }))}
                      value=""
                      onChange={(vendorId) => { const v = allVendors.find((x) => x.id === vendorId); if (v) setBonuses((prev) => [...prev, { vendorId: v.id, vendorCategoryId: v.categoryId, vendorName: v.name, description: "", qty: 1, nominal: 0 }]); }}
                      placeholder="Pilih vendor..."
                      searchPlaceholder="Cari vendor..."
                      emptyText="Tidak ada vendor"
                    />
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
                  <div>
                    <p className={cn('text-sm', 'font-medium', 'text-foreground')}>Kategori Harga Package</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Tandai kategori sebagai takeout jika klien menyediakan sendiri. Harga otomatis berkurang.
                    </p>
                  </div>
                  {visibleCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Tidak ada kategori harga untuk variant ini.
                    </p>
                  )}
                  <div className="space-y-2">
                    {visibleCategories.map((cat) => {
                      const isTakeout = categoryToggles[cat.categoryName] ?? false;
                      const takeoutNominal = takeoutPrices[cat.categoryName] ?? cat.basePrice;
                      return (
                        <div
                          key={cat.categoryName}
                          className={cn('rounded-lg', 'border', 'p-3', isTakeout && 'border-destructive/30 bg-destructive/5')}
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
                  {/* Price summary */}
                  <div className={cn('rounded-lg', 'bg-muted/30', 'p-3', 'space-y-1')}>
                    <div className={cn('flex', 'justify-between', 'text-sm')}>
                      <span className="text-muted-foreground">Harga setelah takeout</span>
                      <span className="font-semibold">Rp{fmtRp(step2Price)}</span>
                    </div>
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
                      onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setSpecialBonusAmount(num); allocatePrice(getBasePrice(), num); }}
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
                    <FormLabel className={cn('text-sm', 'font-medium', 'text-foreground', 'mb-2', 'block')}>Term of Payments</FormLabel>
                    <div className="space-y-4">
                      {terms.map((t, idx) => {
                        const isFirstTerm = idx === 0;
                        const isFirstInvalid = isFirstTerm && (!t.amount || t.amount <= 0);
                        return (
                        <div key={idx} className="space-y-2">
                          {/* Term name — inline editable */}
                          <div className={cn('flex', 'items-center', 'gap-2')}>
                            <div className="flex items-center gap-0.5 flex-1">
                              <Input
                                value={t.name}
                                onChange={(e) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                                placeholder="Term name"
                                className={cn('border-0', 'p-0', 'text-sm', 'font-medium', 'text-foreground', 'bg-transparent', 'shadow-none', 'focus-visible:ring-0', 'h-auto')}
                              />
                              {isFirstTerm && <span className="text-destructive text-xs font-medium shrink-0">*</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Select value={t.paymentStatus ?? "unpaid"} onValueChange={(v) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentStatus: v as TermRow["paymentStatus"] } : x))}>
                                <SelectTrigger className="w-24 h-7">
                                  <span className={cn("text-xs font-semibold", (t.paymentStatus ?? "unpaid") === "paid" ? "text-foreground" : "text-muted-foreground")}>
                                    {((t.paymentStatus ?? "unpaid").charAt(0).toUpperCase() + (t.paymentStatus ?? "unpaid").slice(1))}
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_STATUS.map((s) => (
                                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {terms.length > 1 && (
                                <button type="button" onClick={() => setTerms((prev) => recalcTermDates(prev.filter((_, i) => i !== idx), wBookingDate))} className={cn('text-destructive', 'hover:text-destructive', 'shrink-0')}>
                                  <TrashBinTrash weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Amount + Date row */}
                          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'gap-3', 'sm:items-center')}>
                            <div className="sm:flex-2">
                              <Input
                                value={t.amount ? fmtRp(t.amount) : ""}
                                onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, amount: num } : x)); }}
                                placeholder="Amount"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="sm:flex-1">
                              <Popover>
                                <PopoverTrigger render={
                                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !t.dueDate && "text-muted-foreground")}>
                                    <CalendarIcon weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4')} />
                                    {t.dueDate ? format(new Date(t.dueDate), "dd MMM yyyy") : "Select Date"}
                                  </Button>
                                } />
                                <PopoverContent className={cn('w-auto', 'p-0')} align="start">
                                  <Calendar
                              mode="single"
                              captionLayout="dropdown"
                              selected={t.dueDate ? new Date(t.dueDate) : undefined}
                              onSelect={(date) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, dueDate: date ? date.toISOString() : "" } : x))}
                              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                              fromDate={new Date(new Date().setHours(0, 0, 0, 0))}
                            />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          {/* Upload bukti pembayaran — semua term yang statusnya paid */}
                          {(t.paymentStatus ?? "unpaid") === "paid" && (
                            <div>
                              <div className={cn('relative', 'flex', 'items-center', 'gap-2', 'px-3', 'py-2', 'border', 'rounded-md', 'bg-muted/30', 'text-muted-foreground', 'cursor-pointer', 'hover:bg-muted/50', 'text-xs')}>
                                {t.paymentEvidence instanceof File && t.paymentEvidence.type.startsWith("image/") ? (
                                  <FilePreview file={t.paymentEvidence} onOpen={() => { const url = URL.createObjectURL(t.paymentEvidence!); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); }} />
                                ) : (
                                  <FileText weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'shrink-0')} />
                                )}
                                {t.paymentEvidence ? (
                                  <button type="button" className="relative z-10 flex-1 truncate text-left hover:underline" onClick={(e) => { e.stopPropagation(); const url = URL.createObjectURL(t.paymentEvidence!); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); }}>
                                    {t.paymentEvidence.name}
                                  </button>
                                ) : (
                                  <span className="flex-1 truncate">Upload bukti pembayaran</span>
                                )}
                                {t.paymentEvidence && (
                                  <button type="button" className={cn('shrink-0', 'hover:text-destructive', 'z-10', 'relative')} onClick={(e) => { e.stopPropagation(); setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentEvidence: null } : x)); }}>
                                    <CloseCircle weight="BoldDuotone" className={cn('h-3', 'w-3')} />
                                  </button>
                                )}
                                <input type="file" accept="image/*,application/pdf" className={cn('absolute', 'inset-0', 'opacity-0', 'cursor-pointer')} onChange={(e) => { const f = e.target.files?.[0]; if (f) setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentEvidence: f } : x)); e.target.value = ""; }} />
                              </div>
                              <p className={cn('mt-1', 'text-xs', 'text-muted-foreground')}>
                                Bukti pembayaran wajib diupload untuk melanjutkan ke langkah berikutnya.
                              </p>
                            </div>
                          )}
                          {/* Divider between terms */}
                          {idx < terms.length - 1 && <div className={cn('border-b', 'border-border', 'pt-1')} />}
                          {isFirstInvalid && (
                            <p className="text-xs text-destructive">Nominal Booking Fee wajib diisi</p>
                          )}
                        </div>
                        );
                      })}
                    </div>

                    {/* Add button */}
                    <div className={cn('flex', 'gap-2', 'mt-4')}>
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setTerms((prev) => recalcTermDates([...prev, { name: "", amount: 0, dueDate: "", sortOrder: prev.length, paymentStatus: "unpaid" }], wBookingDate))}>
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
                  <FormField
                    control={form.control}
                    name="withMaterai"
                    render={({ field }) => (
                      <FormItem className="rounded-lg border p-3 space-y-2">
                        <div className="flex flex-row items-center justify-between gap-3">
                          <FormLabel className="text-sm font-medium">E-Meterai <span className="font-normal text-muted-foreground">(opsional)</span></FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Bubuhkan e-meterai resmi (Peruri) pada dokumen PO booking ini.
                        </p>
                        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
                          <p className="font-medium text-foreground">Yang akan terjadi saat booking dibuat:</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>Sistem akan menghubungi Peruri untuk menghasilkan Serial Number e-meterai</li>
                            <li>QR code e-meterai akan tampil di dokumen PO sebelah kiri area tanda tangan</li>
                            <li>Proses ini membutuhkan waktu beberapa detik ekstra</li>
                            <li className="text-destructive font-medium">Kuota e-meterai akan berkurang — pastikan saldo mencukupi</li>
                          </ul>
                        </div>
                      </FormItem>
                    )}
                  />
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
        {/* Footer */}
        <div className={cn('bg-background', 'sticky', 'bottom-0', 'z-10')}>
          <div className={cn('flex', 'py-4', 'gap-2')}>
            <Button
              variant="outline"
              onClick={currentStep === 1 ? () => onOpenChange(false) : handlePrevious}
              disabled={createMut.isPending}
              className="flex-[40%] cursor-pointer"
            >
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={currentStep < totalSteps ? handleNext : form.handleSubmit(onSubmit)}
              disabled={isContinueDisabled}
              className={cn("flex-[60%] cursor-pointer", isContinueDisabled && "opacity-50 cursor-not-allowed")}
            >
              {currentStep < totalSteps ? "Continue" : createMut.isPending ? "Creating..." : "Create New Booking"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
