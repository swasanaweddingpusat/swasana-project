"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { CalendarIcon, Trash2, X } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { cn } from "@/lib/utils";
import { editBooking } from "@/actions/booking";
import type { BookingListItem } from "@/lib/queries/bookings";
import type { MobileNumberEntry } from "@/lib/validations/customer";

interface Props {
  booking: BookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VenueOption { id: string; name: string }
interface PackageVariant { id: string; variantName: string; pax: number; margin: number; categoryPrices: { basePrice: number }[] }
interface PackageOption { id: string; packageName: string; variants: PackageVariant[] }
interface VendorCategoryData { id: string; name: string; vendors: { id: string; name: string; categoryId: string }[] }
interface BonusRow { vendorId: string; vendorCategoryId: string; vendorName: string; description: string; qty: number; nominal: number }
interface TermRow { id?: string; name: string; amount: number; dueDate: string; sortOrder: number }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function getVariantPrice(v: PackageVariant) {
  const base = (v.categoryPrices ?? []).reduce((s, c) => s + Number(c.basePrice), 0);
  return base + Math.round(base * ((v.margin ?? 0) / 100));
}

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
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

const LBL = "text-sm font-medium text-gray-700";

export function EditBookingDrawer({ booking, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);


  // Step 1 state
  const [customerName, setCustomerName] = useState("");
  const [contactNumbers, setContactNumbers] = useState<MobileNumberEntry[]>([]);
  const [contactInput, setContactInput] = useState({ name: "", number: "" });
  const [contactEmail, setContactEmail] = useState("");
  const [contactNik, setContactNik] = useState("");
  const [contactKtpAddress, setContactKtpAddress] = useState("");
  const [contactBitrixId, setContactBitrixId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [selectedVariantPrice, setSelectedVariantPrice] = useState(0);
  const [bookingDate, setBookingDate] = useState("");
  const [weddingSession, setWeddingSession] = useState("");
  const [weddingType, setWeddingType] = useState("");
  const [sourceOfInformationId, setSourceOfInformationId] = useState("");
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);

  // Step 2 state
  const [specialBonusName, setSpecialBonusName] = useState("Discount");
  const [specialBonusAmount, setSpecialBonusAmount] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [terms, setTerms] = useState<TermRow[]>([]);

  // Step 3 state
  const [signingLocation, setSigningLocation] = useState("");
  const [signatureSales, setSignatureSales] = useState("");
  const sigSalesRef = useRef<SignatureCanvas>(null);

  // Track original values to detect significant changes
  const [originalVenueId, setOriginalVenueId] = useState("");
  const [originalPackageId, setOriginalPackageId] = useState("");
  const [originalVariantId, setOriginalVariantId] = useState("");

  // Venue availability
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  // Fetch detail for email/nik/ktp/bitrix
  const { data: detail } = useQuery({
    queryKey: ["bookings", booking?.id],
    queryFn: async () => { const res = await fetch(`/api/bookings/${booking!.id}`); return res.ok ? res.json() : null; },
    enabled: !!booking?.id && open,
    staleTime: 2 * 60_000,
  });

  // Data queries
  const { data: venues = [] } = useQuery<VenueOption[]>({ queryKey: ["venues"], queryFn: () => fetchJson("/api/venues"), staleTime: 5 * 60_000 });
  const { data: packages = [] } = useQuery<PackageOption[]>({ queryKey: ["packages", venueId, "booking"], queryFn: () => fetchJson(`/api/packages?venueId=${venueId}&forBooking=true`), enabled: !!venueId, staleTime: 5 * 60_000 });
  const { data: sources = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["source-of-informations"], queryFn: () => fetchJson("/api/source-of-informations"), staleTime: 10 * 60_000 });
  const { data: vendorCategories = [] } = useQuery<VendorCategoryData[]>({ queryKey: ["vendors"], queryFn: () => fetchJson("/api/vendors"), staleTime: 5 * 60_000 });

  const allVendors = vendorCategories.flatMap((c) => c.vendors.map((v) => ({ ...v, categoryId: c.id })));
  const selectedPkg = packages.find((p) => p.id === packageId);
  const variants = useMemo(() => selectedPkg?.variants ?? [], [selectedPkg]);

  // Initialize state from booking
  useEffect(() => {
    if (!open || !booking) return;
    setCurrentStep(1);
    setCustomerName(booking.snapCustomer?.name ?? "");
    const raw = booking.snapCustomer?.mobileNumber ?? "";
    try { const arr = JSON.parse(raw); if (Array.isArray(arr)) setContactNumbers(arr); else throw 0; } catch { setContactNumbers(raw.split(",").map((s) => s.trim()).filter(Boolean).map((n) => ({ name: "", number: n }))); }
    setVenueId(booking.venueId ?? "");
    setPackageId(booking.packageId ?? "");
    setVariantId(booking.packageVariantId ?? "");
    setOriginalVenueId(booking.venueId ?? "");
    setOriginalPackageId(booking.packageId ?? "");
    setOriginalVariantId(booking.packageVariantId ?? "");
    setBookingDate(booking.bookingDate ? new Date(booking.bookingDate).toISOString() : "");
    setWeddingSession(booking.weddingSession ?? "");
    setWeddingType(booking.weddingType ?? "");
    setSourceOfInformationId(booking.sourceOfInformationId ?? "");
    setPaymentMethodId(booking.paymentMethodId ?? "");
    setSigningLocation(booking.signingLocation ?? "");
    setSpecialBonusName((booking as Record<string, unknown>).discountName as string ?? "Discount");
    setSpecialBonusAmount(Number((booking as Record<string, unknown>).discountAmount) || 0);
    setSignatureSales("");
    sigSalesRef.current?.clear();
    // Terms from booking
    const bTerms = (booking.termOfPayments ?? []).map((t) => ({ id: t.id, name: t.name, amount: Number(t.amount), dueDate: new Date(t.dueDate).toISOString(), sortOrder: t.sortOrder }));
    setTerms(bTerms.length > 0 ? bTerms : [{ name: "Booking Fee", amount: 0, dueDate: toLocalISO(new Date()), sortOrder: 0 }]);
    // Variant price
    setSelectedVariantPrice(Number(booking.snapPackageVariant?.price ?? 0));
  }, [open, booking]);  

  // Init detail fields
  useEffect(() => {
    if (!detail) return;
    setContactEmail(detail.snapCustomer?.email ?? "");
    setContactNik(detail.snapCustomer?.nikNumber ?? "");
    setContactKtpAddress(detail.snapCustomer?.ktpAddress ?? "");
    setContactBitrixId(detail.customer?.bitrixId ?? "");
    if (detail.snapBonuses?.length && bonuses.length === 0) {
      setBonuses(detail.snapBonuses.map((b: Record<string, unknown>) => ({ vendorId: b.vendorId as string, vendorCategoryId: b.vendorCategoryId as string, vendorName: b.vendorName as string, description: (b.description as string) ?? "", qty: Number(b.qty) || 1, nominal: Number(b.nominal) || 0 })));
    }
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update variant price when variant changes via packages data
  useEffect(() => {
    if (!variantId || !variants.length) return;
    const v = variants.find((x) => x.id === variantId);
    if (v) setSelectedVariantPrice(getVariantPrice(v));
  }, [variantId, variants]);

  // Venue availability
  useEffect(() => {
    if (!venueId) { setAvailability({}); return; }
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    const bookingId = booking?.id ?? "";
    const params = new URLSearchParams({ month, exclude: bookingId });
    if (packageId) params.set("packageId", packageId);
    if (variantId) params.set("variantId", variantId);
    fetch(`/api/venues/${venueId}/availability?${params}`).then((r) => r.json()).then(setAvailability).catch(() => setAvailability({}));
  }, [venueId, visibleMonth, booking?.id, packageId, variantId]);

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

  // Recalc term dates when event date changes
  useEffect(() => {
    if (bookingDate) setTerms((prev) => recalcTermDates(prev, bookingDate));
  }, [bookingDate]);  

  // Price helpers
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

  // Detect significant changes
  const hasSignificantChange = venueId !== originalVenueId || packageId !== originalPackageId || variantId !== originalVariantId;
  const hasAnyChange = !booking ? false : (
    hasSignificantChange ||
    customerName !== (booking.snapCustomer?.name ?? "") ||
    JSON.stringify(contactNumbers) !== (() => { try { const arr = JSON.parse(booking.snapCustomer?.mobileNumber ?? ""); return JSON.stringify(Array.isArray(arr) ? arr : []); } catch { return "[]"; } })() ||
    (bookingDate ? format(new Date(bookingDate), "yyyy-MM-dd") : "") !== (booking.bookingDate ? format(new Date(booking.bookingDate), "yyyy-MM-dd") : "") ||
    weddingSession !== (booking.weddingSession ?? "") ||
    weddingType !== (booking.weddingType ?? "") ||
    sourceOfInformationId !== (booking.sourceOfInformationId ?? "") ||
    paymentMethodId !== (booking.paymentMethodId ?? "") ||
    signingLocation !== (booking.signingLocation ?? "")
  );
  const totalSteps = hasSignificantChange ? 3 : 1;

  // Validation
  const isStep1Complete = !!(customerName.trim() && contactNumbers.length > 0 && venueId && packageId && bookingDate && weddingSession && weddingType && (variants.length === 0 || variantId));
  const isStep2Complete = getBasePrice() === 0 || getDifference() === 0;
  const isStep3Complete = !!signatureSales && !!signingLocation.trim();

  const handleNext = () => {
    if (currentStep === 1 && !isStep1Complete) { toast.error("Lengkapi field yang wajib diisi."); return; }
    if (currentStep === 2 && getBasePrice() > 0 && getDifference() !== 0) { toast.error(`Selisih: Rp${fmtRp(Math.abs(getDifference()))}`); return; }
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };
  const handlePrevious = () => { if (currentStep > 1) { if (currentStep === 3) { sigSalesRef.current?.clear(); setSignatureSales(""); } setCurrentStep(currentStep - 1); } };

  const mut = useMutation({
    mutationFn: (data: Parameters<typeof editBooking>[0]) => editBooking(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bookings"] }); qc.invalidateQueries({ queryKey: ["booking-approvals"] }); },
  });

  async function handleSubmit() {
    if (!booking) return;
    const r = await mut.mutateAsync({
      id: booking.id,
      bookingDate: bookingDate ? format(new Date(bookingDate), "yyyy-MM-dd") : "",
      venueId, packageId,
      packageVariantId: variantId || null,
      paymentMethodId: paymentMethodId || null,
      sourceOfInformationId: sourceOfInformationId || null,
      weddingSession: (weddingSession as "morning" | "evening" | "fullday") || null,
      weddingType: weddingType || null,
      signingLocation: signingLocation || null,
      customerName, contactNumbers: JSON.stringify(contactNumbers), contactEmail, contactNik, contactKtpAddress, contactBitrixId,
      bonuses: bonuses.map((b) => ({ vendorId: b.vendorId, vendorCategoryId: b.vendorCategoryId, vendorName: b.vendorName, description: b.description || null, qty: b.qty, nominal: b.nominal })),
      // Only include TOP + signature if significant change (step 2 & 3 were shown)
      ...(hasSignificantChange ? {
        termOfPayments: terms.filter((t) => t.dueDate).map((t) => ({ id: t.id, name: t.name, amount: t.amount, dueDate: t.dueDate, sortOrder: t.sortOrder })),
        specialBonusName: specialBonusName || null,
        specialBonusAmount: specialBonusAmount || null,
        signatureSales: signatureSales || null,
      } : {}),
    });
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Booking berhasil diupdate.");
    onOpenChange(false);
  }

  const isContinueDisabled = (currentStep === 1 && !isStep1Complete) || (currentStep === 1 && !hasSignificantChange && !hasAnyChange) || (hasSignificantChange && currentStep === 2 && !isStep2Complete) || (hasSignificantChange && currentStep === 3 && !isStep3Complete) || mut.isPending;

  const sessionLabels: Record<string, string> = { morning: "Pagi", evening: "Malam", fullday: "Fullday" };

  return (
    <Drawer isOpen={open} onClose={() => onOpenChange(false)} title="Edit Booking" maxWidth="sm:max-w-xl" steps={currentStep} totalSteps={totalSteps} isCloseButton={false}>
      <div className={cn('flex', 'flex-col', 'justify-between', 'h-full')}>
        <div className={cn('flex-1', 'overflow-y-auto', 'px-2')}>
          {/* ─── Step 1: Data Booking ─── */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <div><label className={LBL}>Customer Name *</label><Input className="mt-1" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" /></div>

              {/* Contact Person */}
              <div>
                <label className={LBL}>Contact Person *</label>
                <div className="mt-1 rounded-lg bg-muted p-3 space-y-2">
                  {contactNumbers.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md bg-white border px-3 py-2">
                      <div className="flex-1 min-w-0">{entry.name && <p className="text-xs text-muted-foreground">{entry.name}</p>}<p className="text-sm font-medium">{entry.number}</p></div>
                      <button type="button" className="shrink-0 text-destructive hover:bg-destructive/10 rounded-full p-1" onClick={() => setContactNumbers((p) => p.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={contactInput.name} onChange={(e) => setContactInput((p) => ({ ...p, name: e.target.value }))} placeholder="Label (opsional)" className="flex-1 bg-white" />
                    <Input value={contactInput.number} onChange={(e) => setContactInput((p) => ({ ...p, number: e.target.value.replace(/\D/g, "") }))} placeholder="081234567890" inputMode="numeric" className="flex-1 bg-white"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const num = contactInput.number.trim(); if (!num || contactNumbers.some((c) => c.number === num)) return; setContactNumbers((prev) => [...prev, { name: contactInput.name.trim(), number: num }]); setContactInput({ name: "", number: "" }); } }} />
                    <Button type="button" variant="outline" className="shrink-0 bg-white" onClick={() => { const num = contactInput.number.trim(); if (!num || contactNumbers.some((c) => c.number === num)) return; setContactNumbers((prev) => [...prev, { name: contactInput.name.trim(), number: num }]); setContactInput({ name: "", number: "" }); }}>Tambah</Button>
                  </div>
                </div>
              </div>

              <div><label className={LBL}>Sumber Informasi</label><SearchableSelect options={sources} value={sourceOfInformationId} onChange={setSourceOfInformationId} placeholder="Pilih sumber informasi" searchPlaceholder="Cari sumber..." emptyText="Tidak ada data" /></div>
              <div><label className={LBL}>Email</label><Input className="mt-1" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" /></div>
              <div><label className={LBL}>NIK Number</label><Input className="mt-1" value={contactNik} onChange={(e) => setContactNik(e.target.value.replace(/\D/g, "").slice(0, 16))} inputMode="numeric" maxLength={16} placeholder="NIK" /></div>
              <div><label className={LBL}>Alamat (sesuai KTP)</label><Textarea className="mt-1" rows={3} value={contactKtpAddress} onChange={(e) => setContactKtpAddress(e.target.value)} placeholder="Alamat KTP" /></div>
              <div><label className={LBL}>Bitrix ID</label><Input className="mt-1" value={contactBitrixId} onChange={(e) => setContactBitrixId(e.target.value)} placeholder="Bitrix ID" /></div>

              {/* Venue */}
              <div><label className={LBL}>Venue *</label><SearchableSelect options={venues} value={venueId} onChange={(id) => { setVenueId(id); setPackageId(""); setVariantId(""); setSelectedVariantPrice(0); setPaymentMethodId(""); }} placeholder="Pilih venue..." searchPlaceholder="Cari venue..." emptyText="Tidak ada venue" /></div>

              {/* Package */}
              <div><label className={LBL}>Pilih Paket *</label><SearchableSelect options={packages.map((p) => ({ id: p.id, name: p.packageName }))} value={packageId} onChange={(id) => { setPackageId(id); setVariantId(""); setSelectedVariantPrice(0); }} placeholder={venueId ? "Pilih paket..." : "Pilih venue dulu"} disabled={!venueId} searchPlaceholder="Cari paket..." emptyText="Tidak ada paket" /></div>

              {/* Variant */}
              {variants.length > 0 && (
                <div><label className={LBL}>Pilih Tipe Paket *</label><SearchableSelect options={variants.map((v) => ({ id: v.id, name: `${v.variantName} · ${v.pax} PAX · Rp ${fmtRp(getVariantPrice(v))}` }))} value={variantId} onChange={(id) => { setVariantId(id); const v = variants.find((x) => x.id === id); if (v) { const p = getVariantPrice(v); setSelectedVariantPrice(p); allocatePrice(p, specialBonusAmount); } }} placeholder="Pilih tipe paket..." searchPlaceholder="Cari..." emptyText="Tidak ada variant" /></div>
              )}

              {/* Event Date */}
              <div>
                <label className={LBL}>Event Date *</label>
                <Popover>
                  <PopoverTrigger render={<Button variant="outline" disabled={!venueId} className={cn("w-full mt-1 justify-start text-left font-normal", !bookingDate && "text-gray-400")}><CalendarIcon className="mr-2 h-4 w-4" />{bookingDate ? format(new Date(bookingDate), "PPP") : "Pilih tanggal event"}</Button>} />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" captionLayout="dropdown" selected={bookingDate ? new Date(bookingDate) : undefined} onSelect={(date) => { setBookingDate(date ? date.toISOString() : ""); setWeddingSession(""); }} fromYear={new Date().getFullYear() - 10} toYear={new Date().getFullYear() + 5} defaultMonth={bookingDate ? new Date(bookingDate) : new Date()} onMonthChange={setVisibleMonth} disabled={(d) => !!venueId && getDateStatus(d) === "unavailable"} modifiers={{ available: (d) => !!venueId && getDateStatus(d) === "available", partial: (d) => !!venueId && getDateStatus(d) === "partial", unavailable: (d) => !!venueId && getDateStatus(d) === "unavailable" }} modifiersClassNames={{ available: "day-available", partial: "day-partial", unavailable: "day-unavailable" }} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Session + Type */}
              <div>
                <label className={LBL}>Event Session *</label>
                <Select value={weddingSession} onValueChange={setWeddingSession}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih session" /></SelectTrigger>
                  <SelectContent>{(() => { const dateStr = bookingDate ? format(new Date(bookingDate), "yyyy-MM-dd") : null; return (dateStr ? getAvailableSessions(dateStr) : ["morning", "evening", "fullday"]).map((s) => <SelectItem key={s} value={s}>{sessionLabels[s] ?? s}</SelectItem>); })()}</SelectContent>
                </Select>
              </div>
              <div>
                <label className={LBL}>Event Type *</label>
                <Select value={weddingType} onValueChange={setWeddingType}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R">Resepsi</SelectItem><SelectItem value="AR">Akad & Resepsi</SelectItem><SelectItem value="TR">Teapai & Resepsi</SelectItem><SelectItem value="PR">Pemberkatan Resepsi</SelectItem><SelectItem value="VO">Venue Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Complimentary */}
              <div className="space-y-2">
                <label className={LBL}>Complimentary (Bonus)</label>
                <SearchableSelect options={allVendors.filter((v) => !bonuses.some((b) => b.vendorId === v.id)).map((v) => ({ id: v.id, name: v.name }))} value="" onChange={(vendorId) => { const v = allVendors.find((x) => x.id === vendorId); if (v) setBonuses((prev) => [...prev, { vendorId: v.id, vendorCategoryId: v.categoryId, vendorName: v.name, description: "", qty: 1, nominal: 0 }]); }} placeholder="Pilih vendor..." searchPlaceholder="Cari vendor..." emptyText="Tidak ada vendor" />
                {bonuses.map((b, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><SearchableSelect options={allVendors.filter((v) => !bonuses.some((x, i) => i !== idx && x.vendorId === v.id)).map((v) => ({ id: v.id, name: v.name }))} value={b.vendorId} onChange={(vendorId) => { const v = allVendors.find((x) => x.id === vendorId); if (v) setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, vendorId: v.id, vendorCategoryId: v.categoryId, vendorName: v.name } : x)); }} placeholder="Pilih vendor..." searchPlaceholder="Cari vendor..." emptyText="Tidak ada vendor" /></div>
                      <button type="button" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 shrink-0" onClick={() => setBonuses((prev) => prev.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></button>
                    </div>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span><input type="text" inputMode="numeric" className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white" placeholder="Nominal" value={b.nominal ? fmtRp(b.nominal) : ""} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, nominal: n } : x)); }} /></div>
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
              <div><label className={LBL}>Total Harga Package</label><Input disabled value={`Rp${fmtRp(getPriceAfterDiscount())}`} className="mt-1" /></div>

              {/* Discount */}
              <div className="flex flex-col gap-2 border-y py-4">
                <Input placeholder="Nama bonus (e.g. Discount)" value={specialBonusName} onChange={(e) => setSpecialBonusName(e.target.value)} className="border-0 p-0 text-sm font-medium text-gray-700 bg-transparent shadow-none focus-visible:ring-0 h-auto" />
                <Input placeholder="IDR. 0" value={specialBonusAmount ? fmtRp(specialBonusAmount) : ""} onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setSpecialBonusAmount(num); allocatePrice(getBasePrice(), num); }} inputMode="numeric" className="rounded-none" />
              </div>

              {/* Payment Method */}
              <div><label className={LBL}>Pembayaran Melalui</label><BankAccountSelect value={paymentMethodId} onChange={setPaymentMethodId} placeholder={venueId ? "Pilih metode pembayaran" : "Pilih venue dulu"} disabled={!venueId} venueId={venueId} /></div>

              {/* Terms */}
              <div>
                <label className={cn(LBL, 'mb-2 block')}>Term of Payments</label>
                <div className="space-y-4">
                  {terms.map((t, idx) => (
                    <div key={t.id ?? idx} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input value={t.name} onChange={(e) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} placeholder="Term name" className="border-0 p-0 text-sm font-medium text-gray-700 bg-transparent shadow-none focus-visible:ring-0 h-auto" />
                        {terms.length > 1 && <button type="button" onClick={() => setTerms((prev) => recalcTermDates(prev.filter((_, i) => i !== idx), bookingDate))} className="text-red-400 hover:text-red-600 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                      <div className="flex gap-3 items-center">
                        <div className="flex-2"><Input value={t.amount ? fmtRp(t.amount) : ""} onChange={(e) => { const num = parseInt(e.target.value.replace(/\D/g, "")) || 0; setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, amount: num } : x)); }} placeholder="Amount" inputMode="numeric" /></div>
                        <div className="flex-1">
                          <Popover>
                            <PopoverTrigger render={<Button variant="outline" className={cn("w-full justify-start text-left font-normal", !t.dueDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{t.dueDate ? format(new Date(t.dueDate), "dd MMM yyyy") : "Select Date"}</Button>} />
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" selected={t.dueDate ? new Date(t.dueDate) : undefined} onSelect={(date) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, dueDate: date ? date.toISOString() : "" } : x))} /></PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {idx < terms.length - 1 && <div className="border-b border-gray-100 pt-1" />}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4"><Button type="button" variant="outline" className="flex-1" onClick={() => setTerms((prev) => recalcTermDates([...prev, { name: "", amount: 0, dueDate: "", sortOrder: prev.length }], bookingDate))}>Tambah Payment</Button></div>
              </div>

              {/* Summary */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-gray-700">Harga Paket:</span><span className="text-sm font-medium text-gray-700">Rp{fmtRp(getBasePrice())}</span></div>
                <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-red-600">{specialBonusName || "Discount"}:</span><span className="text-sm font-medium text-red-600">- Rp{fmtRp(specialBonusAmount)}</span></div>
                <div className="flex justify-between items-center mb-2 border-t pt-2"><span className="text-sm font-medium text-gray-700">Harga Setelah Discount:</span><span className="text-sm font-medium text-gray-700">Rp{fmtRp(getPriceAfterDiscount())}</span></div>
                <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-gray-700">Total Input:</span><span className="text-sm font-medium text-gray-700">Rp{fmtRp(getTotalTerms())}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-700">Selisih:</span><span className={cn("text-sm font-medium", getDifference() !== 0 ? "text-red-600" : "text-gray-700")}>Rp{fmtRp(Math.abs(getDifference()))}{getDifference() < 0 ? " (Kurang)" : getDifference() > 0 ? " (Lebih)" : " (Sesuai)"}</span></div>
              </div>
            </div>
          )}

          {/* ─── Step 3: Signature ─── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div><label className={cn(LBL, 'mb-2 block')}>Lokasi Tanda Tangan *</label><Input placeholder="Contoh: Jakarta, Bandung..." value={signingLocation} onChange={(e) => setSigningLocation(e.target.value)} /></div>
              <div>
                <label className={cn(LBL, 'mb-2 block')}>Tanda Tangan Sales *</label>
                <div className={cn("border-2 border-dashed rounded-xl overflow-hidden bg-gray-50", !signatureSales ? "border-red-300" : "border-gray-300")}>
                  <SignatureCanvas ref={sigSalesRef} penColor="black" canvasProps={{ className: "w-full", style: { width: "100%", height: 200, touchAction: "none" } }} onEnd={() => { if (sigSalesRef.current) setSignatureSales(sigSalesRef.current.toDataURL("image/png")); }} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  {!signatureSales && <p className="text-xs text-red-500">Tanda tangan sales wajib diisi</p>}
                  <button type="button" onClick={() => { sigSalesRef.current?.clear(); setSignatureSales(""); }} className="text-xs text-red-500 hover:text-red-700 underline ml-auto">Hapus tanda tangan</button>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-orange-700">⚠️ Perhatian</p>
                <p className="text-xs text-orange-600">Menyimpan perubahan ini akan mereset seluruh approval. Manager dan Client harus menandatangani ulang PO ini.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white sticky bottom-0 z-10">
          <div className="flex py-4 gap-2">
            <Button variant="outline" onClick={currentStep === 1 ? () => onOpenChange(false) : handlePrevious} disabled={mut.isPending} className={cn("flex-[40%] cursor-pointer", currentStep === 1 ? "text-red-600 border-red-600 hover:bg-red-50" : "border-black text-black hover:bg-gray-100")}>
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button onClick={currentStep < totalSteps ? handleNext : handleSubmit} disabled={isContinueDisabled} className={cn("flex-[60%] bg-black text-white hover:bg-gray-800 cursor-pointer", isContinueDisabled && "opacity-50 cursor-not-allowed")}>
              {currentStep < totalSteps ? "Continue" : mut.isPending ? "Updating..." : hasSignificantChange ? "Update Booking" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
