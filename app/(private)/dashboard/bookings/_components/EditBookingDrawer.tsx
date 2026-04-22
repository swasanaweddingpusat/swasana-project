"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
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
import type { BookingListItem } from "@/lib/queries/bookings";

interface Props {
  booking: BookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VenueOption { id: string; name: string }
interface PackageVariant { id: string; variantName: string; pax: number; price: number }
interface PackageOption { id: string; packageName: string; variants: PackageVariant[] }
interface PaymentMethodOption { id: string; bankName: string; bankAccountNumber: string; bankRecipient: string }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function EditBookingDrawer({ booking, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const [venueId, setVenueId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [bookingDate, setBookingDate] = useState<Date | undefined>();
  const [calOpen, setCalOpen] = useState(false);
  const [weddingSession, setWeddingSession] = useState("");
  const [weddingType, setWeddingType] = useState("");
  const [signingLocation, setSigningLocation] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [sourceOfInformationId, setSourceOfInformationId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [contactNumbers, setContactNumbers] = useState<string[]>([]);
  const [contactEmail, setContactEmail] = useState("");
  const [contactNik, setContactNik] = useState("");
  const [contactKtpAddress, setContactKtpAddress] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [bonuses, setBonuses] = useState<{ vendorId: string; vendorCategoryId: string; vendorName: string; description: string; qty: number }[]>([]);

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

  // Instant pre-fill from list data (no loading state)
  useEffect(() => {
    if (!booking || !open || loaded) return;
    setVenueId(booking.venueId ?? "");
    setPackageId(booking.packageId ?? "");
    setVariantId(booking.packageVariantId ?? "");
    setBookingDate(new Date(booking.bookingDate));
    setWeddingSession(booking.weddingSession ?? "");
    setWeddingType(booking.weddingType ?? "");
    setSigningLocation((booking as any).signingLocation ?? "");
    setPaymentMethodId(booking.paymentMethodId ?? "");
    setSourceOfInformationId(booking.sourceOfInformationId ?? "");
    setCustomerName(booking.snapCustomer?.name ?? "");
    setContactNumbers((booking.snapCustomer?.mobileNumber ?? "").split(",").map((s) => s.trim()).filter(Boolean));
    setContactEmail("");
    setContactNik("");
    setContactKtpAddress("");
    setLoaded(true);
    setDetailLoaded(false);
  }, [booking, open, loaded]);

  // Fill email/NIK/KTP/bonuses when detail arrives
  useEffect(() => {
    if (!detail?.snapCustomer || detailLoaded) return;
    setContactEmail(detail.snapCustomer.email ?? "");
    setContactNik(detail.snapCustomer.nikNumber ?? "");
    setContactKtpAddress(detail.snapCustomer.ktpAddress ?? "");
    // Load bonuses from snapBonuses
    if (detail.snapBonuses?.length > 0) {
      setBonuses(detail.snapBonuses.map((b: { vendorId: string; vendorCategoryId: string; vendorName: string; description: string | null; qty: number }) => ({
        vendorId: b.vendorId, vendorCategoryId: b.vendorCategoryId, vendorName: b.vendorName, description: b.description ?? "", qty: b.qty,
      })));
    }
    setDetailLoaded(true);
  }, [detail, detailLoaded]);

  // Reset flags when drawer closes
  useEffect(() => {
    if (!open) { setLoaded(false); setDetailLoaded(false); setBonuses([]); }
  }, [open]);

  const { data: venues = [] } = useQuery<VenueOption[]>({
    queryKey: ["venues"],
    queryFn: () => fetchJson("/api/venues"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: packages = [] } = useQuery<PackageOption[]>({
    queryKey: ["packages", venueId],
    queryFn: () => fetchJson(`/api/packages?venueId=${venueId}`),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethodOption[]>({
    queryKey: ["payment-methods", venueId],
    queryFn: () => fetchJson(`/api/payment-methods?venueId=${venueId}`),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sources = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchJson("/api/source-of-informations"),
    staleTime: 10 * 60 * 1000,
  });

  const { data: allVendors = [] } = useQuery<{ id: string; name: string; categoryId: string }[]>({
    queryKey: ["vendors-for-bonus"],
    queryFn: () => fetchJson("/api/vendors"),
    staleTime: 5 * 60 * 1000,
  });

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
      weddingSession: (weddingSession as any) || null,
      weddingType: (weddingType as any) || null,
      signingLocation: signingLocation || null,
      customerName,
      contactNumbers: contactNumbers.join(","),
      contactEmail,
      contactNik,
      contactKtpAddress,
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
      <div className="space-y-3 pb-6">
          {/* Customer Name */}
          <div>
            <label className={LBL}>Customer Name *</label>
            <Input className="mt-1 w-full" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Input customer name" />
          </div>

          {/* Contact Person */}
          <div>
            <label className={LBL}>Contact Person *</label>
            <div className="flex flex-wrap gap-2 bg-white border border-gray-300 rounded-lg px-2 py-2 mt-1">
              {contactNumbers.map((num, i) => (
                <span key={i} className="flex items-center bg-[#FAFAFA] border rounded-lg px-3 text-sm font-normal text-black gap-2">
                  {num}
                  <button type="button" className="ml-1 text-red-600 hover:bg-red-100 rounded-full p-1" onClick={() => setContactNumbers((p) => p.filter((_, j) => j !== i))} aria-label="Remove">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                inputMode="numeric"
                className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm px-2"
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
            <Input className="mt-1" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Input email address" />
          </div>

          {/* NIK */}
          <div>
            <label className={LBL}>NIK Number</label>
            <Input
              className="mt-1"
              inputMode="numeric"
              maxLength={16}
              value={contactNik}
              onChange={(e) => setContactNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
              onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
              placeholder="Input NIK number"
            />
          </div>

          {/* Alamat KTP */}
          <div>
            <label className={LBL}>Alamat (sesuai KTP)</label>
            <Textarea className="mt-1" rows={3} value={contactKtpAddress} onChange={(e) => setContactKtpAddress(e.target.value)} placeholder="Input alamat sesuai KTP" />
          </div>

          {/* Sales PIC — disabled */}
          <div>
            <label className={LBL}>Sales PIC *</label>
            <Input className="mt-1 w-full" value={salesName} disabled />
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
                options={variants.map((v) => ({ id: v.id, name: `${v.variantName ? v.variantName + " · " : ""}${v.pax} PAX · Rp ${fmtRp(v.price)}` }))}
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
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {bookingDate ? format(bookingDate, "PPP") : <span>Select Date</span>}
                </Button>
              } />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={bookingDate} onSelect={(d) => { setBookingDate(d); setCalOpen(false); }} initialFocus captionLayout="dropdown" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Event Session — native Select */}
          <div>
            <label className={LBL}>Event Session *</label>
            <Select value={weddingSession} onValueChange={setWeddingSession}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih session" /></SelectTrigger>
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
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih type" /></SelectTrigger>
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
              options={allVendors.filter((v) => !bonuses.some((b) => b.vendorId === v.id)).map((v) => ({ id: v.id, name: v.name }))}
              value=""
              onChange={(vendorId) => {
                const v = allVendors.find((x) => x.id === vendorId);
                if (v) setBonuses((prev) => [...prev, { vendorId: v.id, vendorCategoryId: v.categoryId ?? "", vendorName: v.name, description: "", qty: 1 }]);
              }}
              placeholder="Pilih vendor..."
              searchPlaceholder="Cari vendor..."
              emptyText="Tidak ada vendor"
            />
            {bonuses.map((b, idx) => (
              <div key={b.vendorId} className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-900">{b.vendorName}</span>
                  <button type="button" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => setBonuses((prev) => prev.filter((_, i) => i !== idx))}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <SimpleEditor value={b.description} onChange={(html) => setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, description: html } : x))} placeholder="Keterangan bonus..." className="min-h-[60px]" />
              </div>
            ))}
            {bonuses.length === 0 && <p className="text-xs text-gray-400 italic text-center py-1">Belum ada complimentary</p>}
          </div>

          {/* Submit */}
          <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 pt-4">
            <Button
              className="w-full bg-black text-white hover:bg-gray-800 cursor-pointer rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
