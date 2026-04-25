"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { CalendarIcon, FileText, Plus, Trash2, X } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import { AutocompleteInput } from "@/components/shared/AutocompleteInput";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { cn } from "@/lib/utils";
import { useCreateBooking } from "@/hooks/use-bookings";
import type { BookingInput } from "@/lib/validations/booking";

interface BookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Option = { id: string; name: string };
interface CustomerOption { id: string; name: string; mobileNumber: string; email: string; nikNumber: string | null; ktpAddress: string | null }
interface PackageData { id: string; packageName: string; variants: { id: string; variantName: string; pax: number; price: number }[] }
interface VendorCategoryData { id: string; name: string; vendors: { id: string; name: string; categoryId: string }[] }
interface PaymentMethodData { id: string; bankName: string; bankAccountNumber: string; bankRecipient: string; venueId: string | null }
interface BonusRow { vendorId: string; vendorCategoryId: string; vendorName: string; description: string; qty: number; nominal: number }
interface TermRow { name: string; amount: number; dueDate: string; sortOrder: number; paymentEvidence?: File | null }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

const DAY = 24 * 60 * 60 * 1000;

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

function makeDefaultTerms(): TermRow[] {
  const now = new Date();
  return [
    { name: "Booking Fee", amount: 0, dueDate: toLocalISO(now), sortOrder: 0 },
    { name: "DP", amount: 0, dueDate: toLocalISO(new Date(now.getTime() + 14 * DAY)), sortOrder: 1 },
    { name: "Angsuran 1", amount: 0, dueDate: toLocalISO(new Date(now.getTime() + 44 * DAY)), sortOrder: 2 },
    { name: "Angsuran 2", amount: 0, dueDate: toLocalISO(new Date(now.getTime() + 74 * DAY)), sortOrder: 3 },
    { name: "Pelunasan 1", amount: 0, dueDate: toLocalISO(new Date(now.getTime() + 104 * DAY)), sortOrder: 4 },
    { name: "Pelunasan 2", amount: 0, dueDate: toLocalISO(new Date(now.getTime() + 134 * DAY)), sortOrder: 5 },
    { name: "Final", amount: 0, dueDate: toLocalISO(new Date(now.getTime() + 164 * DAY)), sortOrder: 6 },
  ];
}

const DRAFT_KEY = "booking_draft";

interface BookingDraft {
  currentStep: number;
  customerName: string;
  contactNumbers: string[];
  contactEmail: string;
  contactNik: string;
  contactKtpAddress: string;
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
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const sigSalesRef = useRef<SignatureCanvas>(null);
  const [signatureSales, setSignatureSales] = useState("");
  const [signingLocation, setSigningLocation] = useState("");
  const [specialBonusName, setSpecialBonusName] = useState("Discount");
  const [specialBonusAmount, setSpecialBonusAmount] = useState(0);
  const [contactNumbers, setContactNumbers] = useState<string[]>([]);
  const [contactEmail, setContactEmail] = useState("");
  const [contactNik, setContactNik] = useState("");
  const [contactKtpAddress, setContactKtpAddress] = useState("");
  const [noteDateEvent, setNoteDateEvent] = useState("");
  const [customerName, setCustomerName] = useState("");
  const contactInputRef = useRef<HTMLInputElement>(null);

  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => fetchJson<CustomerOption[]>("/api/customers"), staleTime: 5 * 60_000 });
  const { data: venues = [] } = useQuery({ queryKey: ["venues"], queryFn: () => fetchJson<Option[]>("/api/venues"), staleTime: 5 * 60_000 });
  const { data: sourceOptions = [] } = useQuery({ queryKey: ["source-of-informations"], queryFn: () => fetchJson<Option[]>("/api/source-of-informations"), staleTime: 5 * 60_000 });
  const { data: vendorCategories = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchJson<VendorCategoryData[]>("/api/vendors"), staleTime: 5 * 60_000 });

  const [selectedVenueId, setSelectedVenueId] = useState("");
  const { data: packages = [] } = useQuery({ queryKey: ["packages", selectedVenueId], queryFn: () => fetchJson<PackageData[]>(`/api/packages?venueId=${selectedVenueId}`), enabled: !!selectedVenueId, staleTime: 5 * 60_000 });
  const { data: paymentMethods = [] } = useQuery({ queryKey: ["payment-methods"], queryFn: () => fetchJson<PaymentMethodData[]>("/api/payment-methods"), staleTime: 5 * 60_000 });
  const venuePaymentMethods = paymentMethods.filter((pm) => pm.venueId === selectedVenueId);

  const [selectedPackageId, setSelectedPackageId] = useState("");
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const variants = selectedPackage?.variants ?? [];
  const [selectedVariantPrice, setSelectedVariantPrice] = useState(0);

  // Venue availability
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [availLoading, setAvailLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!selectedVenueId) { setAvailability({}); return; }
    setAvailLoading(true);
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    fetch(`/api/venues/${selectedVenueId}/availability?month=${month}`)
      .then((r) => r.json())
      .then((data: Record<string, DayAvail>) => setAvailability(data))
      .catch(() => setAvailability({}))
      .finally(() => setAvailLoading(false));
  }, [selectedVenueId, visibleMonth]);

  function getDateStatus(d: Date): "available" | "partial" | "unavailable" {
    const key = format(d, "yyyy-MM-dd");
    const a = availability[key];
    if (!a) return "available";
    const count = [a.morning, a.evening, a.fullday].filter(Boolean).length;
    if (count === 0) return "unavailable";
    if (count === 3) return "available";
    return "partial";
  }

  function getAvailableSessions(dateStr: string): string[] {
    const a = availability[dateStr];
    if (!a) return ["morning", "evening", "fullday"];
    return (["morning", "evening", "fullday"] as const).filter((s) => a[s]);
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
        setNoteDateEvent(draft.noteDateEvent);
        setSigningLocation(draft.signingLocation);
        setSpecialBonusName(draft.specialBonusName);
        setSpecialBonusAmount(draft.specialBonusAmount);
        setSelectedVenueId(draft.selectedVenueId);
        setSelectedPackageId(draft.selectedPackageId);
        setSelectedVariantPrice(draft.selectedVariantPrice);
        setBonuses(draft.bonuses);
        setTerms(draft.terms.some((t) => t.dueDate) ? draft.terms : makeDefaultTerms());
        form.reset(draft.formValues as BookingInput);
      } else {
        form.reset();
        setSelectedVenueId(""); setSelectedPackageId(""); setSelectedVariantPrice(0);
        setBonuses([]); setTerms(makeDefaultTerms());
        setCurrentStep(1); setSignatureSales(""); setSigningLocation("");
        setSpecialBonusName("Discount"); setSpecialBonusAmount(0);
        setContactNumbers([]); setContactEmail(""); setContactNik(""); setContactKtpAddress(""); setNoteDateEvent(""); setCustomerName("");
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
        contactKtpAddress, noteDateEvent, signingLocation, specialBonusName,
        specialBonusAmount, selectedVenueId, selectedPackageId, selectedVariantPrice,
        bonuses, terms, formValues: form.getValues(),
      });
    }, 500);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [open, currentStep, customerName, contactNumbers, contactEmail, contactNik, contactKtpAddress, noteDateEvent, signingLocation, specialBonusName, specialBonusAmount, selectedVenueId, selectedPackageId, selectedVariantPrice, bonuses, terms]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const w = form.watch();
  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0 && w.venueId && w.packageId && w.bookingDate && w.weddingSession && w.weddingType);
  const isStep2Complete = getBasePrice() === 0 || getDifference() === 0;
  const isStep3Complete = !!signatureSales && !!signingLocation.trim();

  const handleNext = () => {
    if (currentStep === 1 && !isStep1Complete) { toast.error("Lengkapi field yang wajib diisi terlebih dahulu."); return; }
    if (currentStep === 2) {
      const diff = getDifference();
      if (getBasePrice() > 0 && diff !== 0) {
        toast.error(`Total term (Rp${fmtRp(getTotalTerms())}) tidak sama dengan harga setelah discount (Rp${fmtRp(getPriceAfterDiscount())}). Selisih: Rp${fmtRp(Math.abs(diff))}`);
        return;
      }
    }
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  async function onSubmit(values: BookingInput) {
    const payload: BookingInput = {
      ...values,
      customerId: values.customerId || "",
      customerName: customerName || "",
      contactNumbers: contactNumbers.join(","),
      contactEmail,
      contactNik,
      contactKtpAddress,
      specialBonusName: specialBonusName || null,
      specialBonusAmount: specialBonusAmount || null,
      signingLocation: signingLocation || null,
      signatureSales: signatureSales || null,
      bonuses: bonuses.map((b) => ({ vendorId: b.vendorId, vendorCategoryId: b.vendorCategoryId, vendorName: b.vendorName, description: b.description || null, qty: b.qty, nominal: b.nominal })),
      termOfPayments: terms.filter((t) => t.dueDate).map((t) => ({ name: t.name, amount: t.amount, dueDate: t.dueDate, sortOrder: t.sortOrder })),
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

  const isContinueDisabled = (currentStep === 1 && !isStep1Complete) || (currentStep === 2 && !isStep2Complete) || (currentStep === 3 && !isStep3Complete) || createMut.isPending;

  return (
    <Drawer isOpen={open} onClose={() => onOpenChange(false)} title="New Booking" maxWidth="sm:max-w-xl" steps={currentStep} totalSteps={totalSteps} isCloseButton={false}>
      <div className="flex flex-col justify-between h-full">
        <div className="flex-1 overflow-y-auto px-2">
          <Form {...form}>
            <form className="space-y-4">
              {/* ─── Step 1: Data Booking ─── */}
              {currentStep === 1 && (
                <div className="space-y-3">
                  {/* Customer */}
                  {/* Customer */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700">Customer Name *</FormLabel>
                    <AutocompleteInput
                      options={customers.map((c) => ({ id: c.id, name: c.name }))}
                      value={customerName}
                      onChange={(val) => {
                        setCustomerName(val);
                        form.setValue("customerId", "");
                      }}
                      onSelect={(opt) => {
                        setCustomerName(opt.name);
                        form.setValue("customerId", opt.id);
                        const c = customers.find((x) => x.id === opt.id);
                        if (c) {
                          if (c.mobileNumber) setContactNumbers(c.mobileNumber.split(",").map((n) => n.trim()).filter(Boolean));
                          if (c.email) setContactEmail(c.email);
                          if (c.nikNumber) setContactNik(c.nikNumber);
                          if (c.ktpAddress) setContactKtpAddress(c.ktpAddress);
                        }
                      }}
                      placeholder="e.g. John Doe & Jane Doe"
                      className="mt-1"
                    />
                  </div>

                  {/* Contact Person — chip input */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700">Contact Person *</FormLabel>
                    <div className="flex flex-wrap gap-2 bg-white border border-gray-300 rounded-lg px-2 py-2 mt-1">
                      {contactNumbers.map((num, idx) => (
                        <span key={idx} className="flex items-center bg-[#FAFAFA] border rounded-lg px-3 text-sm font-normal text-black gap-2">
                          {num}
                          <button type="button" className="ml-1 text-red-600 hover:bg-red-100 rounded-full p-1" onClick={() => setContactNumbers((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                      <input
                        ref={contactInputRef}
                        type="text"
                        inputMode="numeric"
                        className="flex-1 min-w-30 border-none outline-none bg-transparent text-sm px-2"
                        placeholder="e.g. 081234567890"
                        onKeyDown={(e) => {
                          const val = e.currentTarget.value.trim();
                          if ((e.key === "Enter" || e.key === ",") && val) {
                            e.preventDefault();
                            if (!contactNumbers.includes(val)) setContactNumbers((prev) => [...prev, val]);
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Sumber Informasi */}
                  <FormField control={form.control} name="sourceOfInformationId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Sumber Informasi</FormLabel>
                      <SearchableSelect options={sourceOptions} value={field.value ?? ""} onChange={field.onChange} placeholder="Pilih sumber informasi" searchPlaceholder="Cari sumber..." emptyText="Tidak ada data" />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Email */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
                    <Input placeholder="e.g. nama@email.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1" />
                  </div>

                  {/* NIK */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700">NIK Number</FormLabel>
                    <Input placeholder="e.g. 3275010101010001" value={contactNik} onChange={(e) => setContactNik(e.target.value.replace(/\D/g, "").slice(0, 16))} inputMode="numeric" maxLength={16} className="mt-1" />
                  </div>

                  {/* Alamat KTP */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700">Alamat (sesuai KTP)</FormLabel>
                    <Textarea placeholder="e.g. Jl. Melati No. 10, Jakarta Selatan" value={contactKtpAddress} onChange={(e) => setContactKtpAddress(e.target.value)} rows={3} className="mt-1" />
                  </div>

                  {/* Venue */}
                  <FormField control={form.control} name="venueId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Venue *</FormLabel>
                      <SearchableSelect options={venues} value={field.value} onChange={(id) => { field.onChange(id); setSelectedVenueId(id); setSelectedPackageId(""); setSelectedVariantPrice(0); form.setValue("packageId", ""); form.setValue("packageVariantId", null); form.setValue("paymentMethodId", null); }} placeholder="Pilih venue..." searchPlaceholder="Cari venue..." emptyText="Tidak ada venue" />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Pilih Paket */}
                  <FormField control={form.control} name="packageId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Pilih Paket *</FormLabel>
                      <SearchableSelect options={packages.map((p) => ({ id: p.id, name: p.packageName }))} value={field.value} onChange={(id) => { field.onChange(id); setSelectedPackageId(id); setSelectedVariantPrice(0); form.setValue("packageVariantId", null); }} placeholder={selectedVenueId ? "Pilih paket..." : "Pilih venue dulu"} disabled={!selectedVenueId} searchPlaceholder="Cari paket..." emptyText="Tidak ada paket" />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Pilih Tipe Paket */}
                  {variants.length > 0 && (
                    <FormField control={form.control} name="packageVariantId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">Pilih Tipe Paket *</FormLabel>
                        <SearchableSelect options={variants.map((v) => ({ id: v.id, name: `${v.variantName} · ${v.pax} PAX · Rp ${fmtRp(v.price)}` }))} value={field.value ?? ""} onChange={(id) => { field.onChange(id); const v = variants.find((x) => x.id === id); if (v) { setSelectedVariantPrice(v.price); allocatePrice(v.price, specialBonusAmount); } }} placeholder="Pilih tipe paket..." searchPlaceholder="Cari..." emptyText="Tidak ada variant" />
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Event Date */}
                  <FormField control={form.control} name="bookingDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Event Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger render={
                          <Button
                            variant="outline"
                            disabled={!selectedVenueId}
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-gray-400")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedVenueId
                              ? (field.value ? format(new Date(field.value), "PPP") : "Pilih tanggal event")
                              : "Pilih venue terlebih dahulu"}
                          </Button>
                        } />
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => { field.onChange(date ? date.toISOString() : ""); form.setValue("weddingSession", null); }}
                            disabled={(d) => {
                              if (d < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                              return getDateStatus(d) === "unavailable";
                            }}
                            fromDate={new Date(new Date().setHours(0, 0, 0, 0))}
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
                      {availLoading && <p className="text-xs text-muted-foreground mt-1">Mengecek ketersediaan...</p>}
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Event Session */}
                  <FormField control={form.control} name="weddingSession" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Event Session *</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Pilih session" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(() => {
                            const dateStr = w.bookingDate ? format(new Date(w.bookingDate), "yyyy-MM-dd") : null;
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
                      <FormLabel className="text-sm font-medium text-gray-700">Event Type *</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Pilih type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="resepsi">Resepsi</SelectItem>
                          <SelectItem value="akad">Akad & Resepsi</SelectItem>
                          <SelectItem value="wedding">Pemberkatan Resepsi</SelectItem>
                          <SelectItem value="engagement">Teapai</SelectItem>
                          <SelectItem value="other">Venue Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Note Date Event */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700">Note Date Event</FormLabel>
                    <Textarea placeholder="Add note for date event" value={noteDateEvent} onChange={(e) => setNoteDateEvent(e.target.value)} rows={3} className="mt-1" />
                  </div>

                  {/* Complimentary (Bonus) */}
                  <div className="space-y-2">
                    <FormLabel className="text-sm font-medium text-gray-700">Complimentary (Bonus)</FormLabel>
                    <SearchableSelect
                      options={availableVendorsForBonus.map((v) => ({ id: v.id, name: v.name }))}
                      value=""
                      onChange={(vendorId) => { const v = allVendors.find((x) => x.id === vendorId); if (v) setBonuses((prev) => [...prev, { vendorId: v.id, vendorCategoryId: v.categoryId, vendorName: v.name, description: "", qty: 1, nominal: 0 }]); }}
                      placeholder="Pilih vendor..."
                      searchPlaceholder="Cari vendor..."
                      emptyText="Tidak ada vendor"
                    />
                    {bonuses.map((b, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
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
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 shrink-0" onClick={() => setBonuses((prev) => prev.filter((_, i) => i !== idx))}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white"
                            placeholder="Nominal"
                            value={b.nominal ? new Intl.NumberFormat("id-ID").format(b.nominal) : ""}
                            onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, nominal: n } : x)); }}
                          />
                        </div>
                        <SimpleEditor value={b.description} onChange={(html) => setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, description: html } : x))} placeholder="Keterangan bonus..." className="min-h-15" />
                      </div>
                    ))}
                    {bonuses.length === 0 && <p className="text-xs text-gray-400 italic text-center py-1">Belum ada complimentary</p>}
                  </div>
                </div>
              )}
              {/* ─── Step 2: Term of Payments ─── */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {/* Package price */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700">Total Harga Package</FormLabel>
                    <Input disabled value={`Rp${fmtRp(getPriceAfterDiscount())}`} className="mt-1" />
                  </div>

                  {/* Discount / Special Bonus */}
                  <div className="flex flex-col gap-2 border-y py-4">
                    <Input
                      placeholder="Nama bonus (e.g. Discount)"
                      value={specialBonusName}
                      onChange={(e) => setSpecialBonusName(e.target.value)}
                      className="border-0 p-0 text-sm font-medium text-gray-700 bg-transparent shadow-none focus-visible:ring-0 h-auto"
                    />
                    <Input
                      placeholder="IDR. 0"
                      value={specialBonusAmount ? fmtRp(specialBonusAmount) : ""}
                      onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setSpecialBonusAmount(num); allocatePrice(getBasePrice(), num); }}
                      inputMode="numeric"
                      className="rounded-none"
                    />
                    <p className="text-xs text-gray-500">Input ini akan ditampilkan di dokumen PO. Terms otomatis di-recalculate saat discount diubah.</p>
                  </div>

                  {/* Payment Method */}
                  <FormField control={form.control} name="paymentMethodId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Pembayaran Melalui</FormLabel>
                      <BankAccountSelect value={field.value ?? ""} onChange={field.onChange} placeholder={selectedVenueId ? "Pilih metode pembayaran" : "Pilih venue dulu"} disabled={!selectedVenueId} venueId={selectedVenueId} />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Term of Payments */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700 mb-2 block">Term of Payments</FormLabel>
                    <div className="space-y-4">
                      {terms.map((t, idx) => (
                        <div key={idx} className="space-y-2">
                          {/* Term name — inline editable */}
                          <div className="flex items-center gap-2">
                            <Input
                              value={t.name}
                              onChange={(e) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                              placeholder="Term name"
                              className="border-0 p-0 text-sm font-medium text-gray-700 bg-transparent shadow-none focus-visible:ring-0 h-auto"
                            />
                            {terms.length > 1 && (
                              <button type="button" onClick={() => setTerms((prev) => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {/* Amount + Date row */}
                          <div className="flex gap-3 items-center">
                            <div className="flex-[2]">
                              <Input
                                value={t.amount ? fmtRp(t.amount) : ""}
                                onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, amount: num } : x)); }}
                                placeholder="Amount"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="flex-1">
                              <Popover>
                                <PopoverTrigger render={
                                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !t.dueDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {t.dueDate ? format(new Date(t.dueDate), "dd MMM yyyy") : "Select Date"}
                                  </Button>
                                } />
                                <PopoverContent className="w-auto p-0" align="start">
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
                          {/* Upload bukti pembayaran */}
                          <div className="relative flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/30 text-muted-foreground cursor-pointer hover:bg-muted/50 text-xs">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="flex-1 truncate">{t.paymentEvidence ? t.paymentEvidence.name : "Upload bukti pembayaran"}</span>
                            {t.paymentEvidence && (
                              <button type="button" className="shrink-0 hover:text-destructive" onClick={() => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentEvidence: null } : x))}>
                                <X className="h-3 w-3" />
                              </button>
                            )}
                            <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const f = e.target.files?.[0]; if (f) setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, paymentEvidence: f } : x)); e.target.value = ""; }} />
                          </div>
                          {/* Divider between terms */}
                          {idx < terms.length - 1 && <div className="border-b border-gray-100 pt-1" />}
                        </div>
                      ))}
                    </div>

                    {/* Add button */}
                    <div className="flex gap-2 mt-4">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setTerms((prev) => [...prev, { name: "", amount: 0, dueDate: "", sortOrder: prev.length }])}>
                        Tambah Payment
                      </Button>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Harga Paket:</span>
                      <span className="text-sm font-medium text-gray-700">Rp{fmtRp(getBasePrice())}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-red-600">{specialBonusName || "Discount"}:</span>
                      <span className="text-sm font-medium text-red-600">- Rp{fmtRp(specialBonusAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2 border-t pt-2">
                      <span className="text-sm font-medium text-gray-700">Harga Setelah Discount:</span>
                      <span className="text-sm font-medium text-gray-700">Rp{fmtRp(getPriceAfterDiscount())}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Total Input User:</span>
                      <span className="text-sm font-medium text-gray-700">Rp{fmtRp(getTotalTerms())}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Selisih:</span>
                      <span className={cn("text-sm font-medium", getDifference() !== 0 ? "text-red-600" : "text-gray-700")}>
                        Rp{fmtRp(Math.abs(getDifference()))}{getDifference() < 0 ? " (Kurang)" : getDifference() > 0 ? " (Lebih)" : " (Sesuai)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* ─── Step 3: Signature ─── */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700 mb-2 block">Lokasi Tanda Tangan *</FormLabel>
                    <Input placeholder="Contoh: Jakarta, Bandung, Surabaya..." value={signingLocation} onChange={(e) => setSigningLocation(e.target.value)} />
                  </div>
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700 mb-2 block">Tanda Tangan Sales *</FormLabel>
                    <div className={cn("border-2 border-dashed rounded-xl overflow-hidden bg-gray-50", !signatureSales ? "border-red-300" : "border-gray-300")}>
                      <SignatureCanvas
                        ref={sigSalesRef}
                        penColor="black"
                        canvasProps={{ className: "w-full", style: { width: "100%", height: 200, touchAction: "none" } }}
                        onEnd={() => { if (sigSalesRef.current) setSignatureSales(sigSalesRef.current.toDataURL("image/png")); }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      {!signatureSales && <p className="text-xs text-red-500">Tanda tangan sales wajib diisi</p>}
                      <button type="button" onClick={() => { sigSalesRef.current?.clear(); setSignatureSales(""); }} className="text-xs text-red-500 hover:text-red-700 underline ml-auto">Hapus tanda tangan</button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </div>
        {/* Footer */}
        <div className="bg-white sticky bottom-0 z-10">
          <div className="flex py-4 gap-2">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? () => onOpenChange(false) : handlePrevious}
              disabled={createMut.isPending}
              className={cn(
                "flex-[40%] cursor-pointer",
                currentStep === 1 ? "text-red-600 border-red-600 hover:bg-red-50" : "border-black text-black hover:bg-gray-100"
              )}
            >
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={currentStep < totalSteps ? handleNext : form.handleSubmit(onSubmit)}
              disabled={isContinueDisabled}
              className={cn("flex-[60%] bg-black text-white hover:bg-gray-800 cursor-pointer", isContinueDisabled && "opacity-50 cursor-not-allowed")}
            >
              {currentStep < totalSteps ? "Continue" : createMut.isPending ? "Creating..." : "Create New Booking"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
