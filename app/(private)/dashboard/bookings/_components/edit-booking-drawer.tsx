"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Drawer } from "@/components/shared/drawer";
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { editBooking } from "@/actions/booking";
import type { EditBookingInput } from "@/lib/validations/booking";
import type { BookingListItem } from "@/lib/queries/bookings";

interface Props {
  booking: BookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VenueOption { id: string; name: string }
interface PackageVariant { id: string; variantName: string; pax: number; margin: number; categoryPrices: { basePrice: number }[] }
interface PackageOption { id: string; packageName: string; variants: PackageVariant[] }

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

export function EditBookingDrawer({ booking, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const [venueId, setVenueId] = useState(() => booking?.venueId ?? "");
  const [packageId, setPackageId] = useState(() => booking?.packageId ?? "");
  const [variantId, setVariantId] = useState(() => booking?.packageVariantId ?? "");
  const [bookingDate, setBookingDate] = useState<Date | undefined>(() => booking ? new Date(booking.bookingDate) : undefined);
  const [calOpen, setCalOpen] = useState(false);
  const [weddingSession, setWeddingSession] = useState(() => booking?.weddingSession ?? "");

  // Venue availability
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail> | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => booking ? new Date(booking.bookingDate) : new Date());

  useEffect(() => {
    if (!venueId) return;
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    fetch(`/api/venues/${venueId}/availability?month=${month}`)
      .then((r) => r.json())
      .then((data: Record<string, DayAvail>) => setAvailability(data))
      .catch(() => setAvailability({}));
  }, [venueId, visibleMonth]);

  function getDateStatus(d: Date): "available" | "partial" | "unavailable" {
    const key = format(d, "yyyy-MM-dd");
    const a = availability?.[key];
    if (!a) return "available";
    const count = [a.morning, a.evening, a.fullday].filter(Boolean).length;
    if (count === 0) return "unavailable";
    if (count === 3) return "available";
    return "partial";
  }
  const [weddingType, setWeddingType] = useState(() => booking?.weddingType ?? "");
  const [signingLocation, setSigningLocation] = useState(() => booking?.signingLocation ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(() => booking?.paymentMethodId ?? "");
  const [sourceOfInformationId, setSourceOfInformationId] = useState(() => booking?.sourceOfInformationId ?? "");
  const [customerName, setCustomerName] = useState(() => booking?.snapCustomer?.name ?? "");
  const [contactNumbers, setContactNumbers] = useState<string[]>(() => (booking?.snapCustomer?.mobileNumber ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const [bonuses, setBonuses] = useState<{ vendorId: string; vendorCategoryId: string; vendorName: string; description: string; qty: number; nominal: number }[]>([]);

  // Fetch full booking detail (only for email, nikNumber, ktpAddress)
  const { data: detail } = useQuery({
    queryKey: ["bookings", booking?.id],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${booking!.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!booking?.id && open,
    staleTime: 2 * 60 * 1000,
  });

  // Derive async fields — user edits tracked via separate state
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const [nikOverride, setNikOverride] = useState<string | null>(null);
  const [ktpOverride, setKtpOverride] = useState<string | null>(null);

  const contactEmail = emailOverride ?? detail?.snapCustomer?.email ?? "";
  const contactNik = nikOverride ?? detail?.snapCustomer?.nikNumber ?? "";
  const contactKtpAddress = ktpOverride ?? detail?.snapCustomer?.ktpAddress ?? "";
  const resolvedBonuses: { vendorId: string; vendorCategoryId: string; vendorName: string; description: string; qty: number; nominal: number }[] =
    bonuses.length > 0 ? bonuses : (detail?.snapBonuses?.map((b: { vendorId: string; vendorCategoryId: string; vendorName: string; description: string | null; qty: number; nominal?: number | null }) => ({
      vendorId: b.vendorId, vendorCategoryId: b.vendorCategoryId, vendorName: b.vendorName, description: b.description ?? "", qty: b.qty, nominal: Number(b.nominal ?? 0),
    })) ?? []);

  const { data: venues = [] } = useQuery<VenueOption[]>({
    queryKey: ["venues"],
    queryFn: () => fetchJson("/api/venues"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: packages = [] } = useQuery<PackageOption[]>({
    queryKey: ["packages", venueId, "booking"],
    queryFn: () => fetchJson(`/api/packages?venueId=${venueId}&forBooking=true`),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sources = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchJson("/api/source-of-informations"),
    staleTime: 10 * 60 * 1000,
  });

  const { data: vendorCategories = [] } = useQuery<{ id: string; name: string; vendors: { id: string; name: string }[] }[]>({
    queryKey: ["vendors-for-bonus"],
    queryFn: () => fetchJson("/api/vendors"),
    staleTime: 5 * 60 * 1000,
  });
  const allVendors = vendorCategories.flatMap((c) => c.vendors.map((v) => ({ id: v.id, name: v.name, categoryId: c.id })));

  const salesName = detail?.sales?.fullName ?? booking?.sales?.fullName ?? "";

  const selectedPkg = packages.find((p) => p.id === packageId);
  const variants = selectedPkg?.variants ?? [];

  const mut = useMutation({
    mutationFn: (data: Parameters<typeof editBooking>[0]) => editBooking(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });

  async function handleSubmit() {
    if (!booking) return;
    const r = await mut.mutateAsync({
      id: booking.id,
      bookingDate: bookingDate ? format(bookingDate, "yyyy-MM-dd") : format(new Date(booking.bookingDate), "yyyy-MM-dd"),
      venueId,
      packageId,
      packageVariantId: variantId || null,
      paymentMethodId: paymentMethodId || null,
      sourceOfInformationId: sourceOfInformationId || null,
      weddingSession: (weddingSession as EditBookingInput["weddingSession"]) || null,
      weddingType: (weddingType as EditBookingInput["weddingType"]) || null,
      signingLocation: signingLocation || null,
      customerName,
      contactNumbers: contactNumbers.join(","),
      contactEmail,
      contactNik,
      contactKtpAddress,
      bonuses: resolvedBonuses.map((b) => ({ vendorId: b.vendorId, vendorCategoryId: b.vendorCategoryId, vendorName: b.vendorName, description: b.description || null, qty: b.qty, nominal: b.nominal })),
    });
    if (!r.success) toast.error(r.error);
    else { toast.success("Booking berhasil diupdate."); onOpenChange(false); }
  }

  function addContact(e: React.KeyboardEvent<HTMLInputElement>) {
    const val = e.currentTarget.value.trim();
    if ((e.key === "Enter" || e.key === ",") && val) {
      e.preventDefault();
      if (!contactNumbers.includes(val)) setContactNumbers((p) => [...p, val]);
      e.currentTarget.value = "";
    }
  }

  const LBL = "text-sm font-medium text-gray-700";

  return (
    <Drawer isOpen={open} onClose={() => onOpenChange(false)} title="Edit Booking">
      <div className={cn('space-y-3', 'pb-6')}>
          {/* Customer Name */}
          <div>
            <label className={LBL}>Customer Name *</label>
            <Input className={cn('mt-1', 'w-full')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Input customer name" />
          </div>

          {/* Contact Person */}
          <div>
            <label className={LBL}>Contact Person *</label>
            <div className={cn('flex', 'flex-wrap', 'gap-2', 'bg-white', 'border', 'border-gray-300', 'rounded-lg', 'px-2', 'py-2', 'mt-1')}>
              {contactNumbers.map((num, i) => (
                <span key={i} className={cn('flex', 'items-center', 'bg-[#FAFAFA]', 'border', 'rounded-lg', 'px-3', 'text-sm', 'font-normal', 'text-black', 'gap-2')}>
                  {num}
                  <button type="button" className={cn('ml-1', 'text-red-600', 'hover:bg-red-100', 'rounded-full', 'p-1')} onClick={() => setContactNumbers((p) => p.filter((_, j) => j !== i))} aria-label="Remove">
                    <X className={cn('w-4', 'h-4')} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                inputMode="numeric"
                className={cn('flex-1', 'min-w-30', 'border-none', 'outline-none', 'bg-transparent', 'text-sm', 'px-2')}
                placeholder="Input contact person number"
                onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
                onKeyDown={addContact}
              />
            </div>
          </div>

          {/* Sumber Informasi — SearchableSelect like create */}
          <div>
            <label className={LBL}>Sumber Informasi</label>
            <SearchableSelect
              options={sources}
              value={sourceOfInformationId}
              onChange={setSourceOfInformationId}
              placeholder="Pilih sumber informasi"
              searchPlaceholder="Cari sumber..."
              emptyText="Tidak ada data"
            />
          </div>

          {/* Email */}
          <div>
            <label className={LBL}>Email</label>
            <Input className="mt-1" type="email" value={contactEmail} onChange={(e) => setEmailOverride(e.target.value)} placeholder="Input email address" />
          </div>

          {/* NIK */}
          <div>
            <label className={LBL}>NIK Number</label>
            <Input
              className="mt-1"
              inputMode="numeric"
              maxLength={16}
              value={contactNik}
              onChange={(e) => setNikOverride(e.target.value.replace(/\D/g, "").slice(0, 16))}
              onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
              placeholder="Input NIK number"
            />
          </div>

          {/* Alamat KTP */}
          <div>
            <label className={LBL}>Alamat (sesuai KTP)</label>
            <Textarea className="mt-1" rows={3} value={contactKtpAddress} onChange={(e) => setKtpOverride(e.target.value)} placeholder="Input alamat sesuai KTP" />
          </div>

          {/* Sales PIC — disabled */}
          <div>
            <label className={LBL}>Sales PIC *</label>
            <Input className={cn('mt-1', 'w-full')} value={salesName} disabled />
          </div>

          {/* Venue — SearchableSelect */}
          <div>
            <label className={LBL}>Venue *</label>
            <SearchableSelect
              options={venues}
              value={venueId}
              onChange={(id) => { setVenueId(id); setPackageId(""); setVariantId(""); setPaymentMethodId(""); }}
              placeholder="Pilih venue..."
              searchPlaceholder="Cari venue..."
              emptyText="Tidak ada venue"
            />
          </div>

          {/* Pilih Paket — SearchableSelect */}
          <div>
            <label className={LBL}>Pilih Paket *</label>
            <SearchableSelect
              options={packages.map((p) => ({ id: p.id, name: p.packageName }))}
              value={packageId}
              onChange={(id) => { setPackageId(id); setVariantId(""); }}
              placeholder={venueId ? "Pilih paket..." : "Pilih venue dulu"}
              disabled={!venueId}
              searchPlaceholder="Cari paket..."
              emptyText="Tidak ada paket"
            />
          </div>

          {/* Pilih Tipe Paket — SearchableSelect */}
          {packageId && variants.length > 0 && (
            <div>
              <label className={LBL}>Pilih Tipe Paket *</label>
              <SearchableSelect
                options={variants.map((v) => ({ id: v.id, name: `${v.variantName ? v.variantName + " · " : ""}${v.pax} PAX · Rp ${fmtRp(getVariantPrice(v))}` }))}
                value={variantId}
                onChange={setVariantId}
                placeholder="Pilih tipe paket..."
                searchPlaceholder="Cari..."
                emptyText="Tidak ada variant"
              />
            </div>
          )}

          {/* Event Date */}
          <div>
            <label className={LBL}>Event Date *</label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger render={
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full mt-1 justify-start text-left font-normal", !bookingDate && "text-muted-foreground")}
                  onClick={() => setCalOpen(true)}
                >
                  <CalendarIcon className={cn('mr-2', 'h-4', 'w-4')} />
                  {bookingDate ? format(bookingDate, "PPP") : <span>Select Date</span>}
                </Button>
              } />
              <PopoverContent className={cn('w-auto', 'p-0')} align="start">
                <Calendar
                  mode="single"
                  selected={bookingDate}
                  onSelect={(d) => { setBookingDate(d); setCalOpen(false); }}
                  initialFocus
                  captionLayout="dropdown"
                  fromDate={new Date(new Date().setHours(0, 0, 0, 0))}
                  defaultMonth={bookingDate ?? new Date()}
                  onMonthChange={setVisibleMonth}
                  disabled={(d) => {
                    if (d < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                    return getDateStatus(d) === "unavailable";
                  }}
                  modifiers={{
                    available: (d) => !!venueId && getDateStatus(d) === "available",
                    partial: (d) => !!venueId && getDateStatus(d) === "partial",
                    unavailable: (d) => !!venueId && getDateStatus(d) === "unavailable",
                  }}
                  modifiersClassNames={{
                    available: "day-available",
                    partial: "day-partial",
                    unavailable: "day-unavailable",
                  }}
                />
              </PopoverContent>
            </Popover>
            {availability === null && venueId && <p className={cn('text-xs', 'text-muted-foreground', 'mt-1')}>Mengecek ketersediaan...</p>}
          </div>

          {/* Event Session — native Select */}
          <div>
            <label className={LBL}>Event Session *</label>
            <Select value={weddingSession} onValueChange={setWeddingSession}>
              <SelectTrigger className={cn('mt-1', 'w-full')}><SelectValue placeholder="Pilih session" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Pagi</SelectItem>
                <SelectItem value="evening">Malam</SelectItem>
                <SelectItem value="fullday">Fullday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Event Type — native Select */}
          <div>
            <label className={LBL}>Event Type *</label>
            <Select value={weddingType} onValueChange={setWeddingType}>
              <SelectTrigger className={cn('mt-1', 'w-full')}><SelectValue placeholder="Pilih type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resepsi">Resepsi</SelectItem>
                <SelectItem value="akad">Akad & Resepsi</SelectItem>
                <SelectItem value="wedding">Pemberkatan Resepsi</SelectItem>
                <SelectItem value="engagement">Teapai</SelectItem>
                <SelectItem value="other">Venue Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Note Date Event */}
          <div>
            <label className={LBL}>Note Date Event</label>
            <Textarea className="mt-1" rows={3} value={signingLocation} onChange={(e) => setSigningLocation(e.target.value)} placeholder="Add note for date event" />
          </div>

          {/* Complimentary (Bonus) */}
          <div className="space-y-2">
            <label className={LBL}>Complimentary (Bonus)</label>
            <SearchableSelect
              options={allVendors.filter((v) => !resolvedBonuses.some((b) => b.vendorId === v.id)).map((v) => ({ id: v.id, name: v.name }))}
              value=""
              onChange={(vendorId) => {
                const v = allVendors.find((x) => x.id === vendorId);
                if (v) setBonuses((prev) => [...prev, { vendorId: v.id, vendorCategoryId: v.categoryId ?? "", vendorName: v.name, description: "", qty: 1, nominal: 0 }]);
              }}
              placeholder="Pilih vendor..."
              searchPlaceholder="Cari vendor..."
              emptyText="Tidak ada vendor"
            />
            {resolvedBonuses.map((b, idx) => (
              <div key={idx} className={cn('bg-gray-50', 'border', 'border-gray-200', 'rounded-md', 'px-3', 'py-2', 'space-y-1.5')}>
                <div className={cn('flex', 'items-center', 'gap-2')}>
                  <div className="flex-1">
                    <SearchableSelect
                      options={allVendors.filter((v) => !resolvedBonuses.some((x, i) => i !== idx && x.vendorId === v.id)).map((v) => ({ id: v.id, name: v.name }))}
                      value={b.vendorId}
                      onChange={(vendorId) => {
                        const v = allVendors.find((x) => x.id === vendorId);
                        if (!v) return;
                        const base = bonuses.length > 0 ? bonuses : resolvedBonuses;
                        setBonuses(base.map((x, i) => i === idx ? { ...x, vendorId: v.id, vendorCategoryId: v.categoryId ?? "", vendorName: v.name } : x));
                      }}
                      placeholder="Pilih vendor..."
                      searchPlaceholder="Cari vendor..."
                      emptyText="Tidak ada vendor"
                    />
                  </div>
                  <button type="button" className={cn('h-6', 'w-6', 'p-0', 'text-red-500', 'hover:text-red-700', 'shrink-0')} onClick={() => { const base = bonuses.length > 0 ? bonuses : resolvedBonuses; setBonuses(base.filter((_, i) => i !== idx)); }}>
                    <X className={cn('h-3', 'w-3')} />
                  </button>
                </div>
                <div className="relative">
                  <span className={cn('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'text-xs', 'text-gray-400')}>Rp</span>
                  <input type="text" inputMode="numeric" className={cn('w-full', 'pl-8', 'pr-3', 'py-1.5', 'text-sm', 'border', 'border-gray-200', 'rounded-md', 'bg-white')}
                    placeholder="Nominal"
                    value={b.nominal ? new Intl.NumberFormat("id-ID").format(b.nominal) : ""}
                    onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); const base = bonuses.length > 0 ? bonuses : resolvedBonuses; setBonuses(base.map((x, i) => i === idx ? { ...x, nominal: n } : x)); }}
                  />
                </div>
                <SimpleEditor value={b.description} onChange={(html) => { const base = bonuses.length > 0 ? bonuses : resolvedBonuses; setBonuses(base.map((x, i) => i === idx ? { ...x, description: html } : x)); }} placeholder="Keterangan bonus..." className="min-h-15" />
              </div>
            ))}
            {resolvedBonuses.length === 0 && <p className={cn('text-xs', 'text-gray-400', 'italic', 'text-center', 'py-1')}>Belum ada complimentary</p>}
          </div>

          {/* Submit */}
          <div className={cn('sticky', 'bottom-0', 'left-0', 'right-0', 'bg-white', 'border-t', 'border-gray-200', 'pt-4')}>
            <Button
              className={cn('w-full', 'bg-black', 'text-white', 'hover:bg-gray-800', 'cursor-pointer', 'rounded-lg', 'disabled:opacity-50', 'disabled:cursor-not-allowed')}
              disabled={!customerName || !venueId || !packageId || !bookingDate || mut.isPending}
              onClick={handleSubmit}
            >
              {mut.isPending ? "Menyimpan..." : "Update"}
            </Button>
          </div>
        </div>
    </Drawer>
  );
}
