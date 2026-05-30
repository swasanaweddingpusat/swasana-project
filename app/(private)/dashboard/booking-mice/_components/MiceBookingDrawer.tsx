"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import type { MiceBookingItem } from "./types";

interface VenueOption {
  id: string;
  name: string;
}

interface MiceBookingDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: MiceBookingItem | null;
}

interface MiceFormValues {
  quotationId: string;
  clientName: string;
  clientPhone: string;
  venueId: string;
  eventType: string;
  eventDate: string;
  pax: string;
  fullPayment: string;
  bookingFee: string;
  salesName: string;
}

const DEFAULT_VALUES: MiceFormValues = {
  quotationId: "",
  clientName: "",
  clientPhone: "",
  venueId: "",
  eventType: "",
  eventDate: "",
  pax: "",
  fullPayment: "",
  bookingFee: "",
  salesName: "",
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return [] as unknown as T;
  return res.json() as Promise<T>;
}

const EVENT_TYPES = [
  "Halfday 4hrs",
  "Halfday 6hrs",
  "Fullday Meeting 8hrs",
  "Fullday Meeting 10hrs",
  "Fullday Meeting 12hrs",
];

const SALES = ["Deni", "Rina", "Budi", "Sari"];

const EVENT_TYPE_OPTIONS: SearchableSelectOption[] = EVENT_TYPES.map((t) => ({
  id: t,
  name: t,
}));

const SALES_OPTIONS: SearchableSelectOption[] = SALES.map((s) => ({
  id: s,
  name: s,
}));

interface QuotationPickerOption {
  id: string;
  leadName: string;
  packageName: string;
  variantName: string;
  venue: string;
  eventType: string;
  totalPrice: number;
}

const DUMMY_QUOTATIONS: QuotationPickerOption[] = [
  {
    id: "q-m1",
    leadName: "PT Maju Jaya",
    packageName: "Gold",
    variantName: "100 Pax",
    venue: "Sasana Esthi Sopo",
    eventType: "Fullday Meeting 8hrs",
    totalPrice: 40000000,
  },
  {
    id: "q-m4",
    leadName: "Telkom Indonesia",
    packageName: "Silver",
    variantName: "150 Pax",
    venue: "Grand Puri 2",
    eventType: "Halfday 6hrs",
    totalPrice: 28000000,
  },
  {
    id: "q-m5",
    leadName: "Astra International",
    packageName: "Platinum",
    variantName: "200 Pax",
    venue: "Bringhall",
    eventType: "Fullday Meeting 8hrs",
    totalPrice: 55000000,
  },
  {
    id: "q-m6",
    leadName: "Bank Mandiri",
    packageName: "Gold",
    variantName: "250 Pax",
    venue: "Lippo Grand Ballroom",
    eventType: "Fullday Meeting 12hrs",
    totalPrice: 75000000,
  },
];

function formatRp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

export function MiceBookingDrawer({
  open,
  onOpenChange,
  booking,
}: MiceBookingDrawerProps) {
  const isEdit = !!booking;
  const form = useForm<MiceFormValues>({ defaultValues: DEFAULT_VALUES });

  const { data: venues = [] } = useQuery({
    queryKey: ["venues"],
    queryFn: () => fetchJson<VenueOption[]>("/api/venues"),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const venueOptions = useMemo<SearchableSelectOption[]>(
    () => venues.map((v) => ({ id: v.id, name: v.name })),
    [venues]
  );

  const quotationOptions = useMemo<SearchableSelectOption[]>(
    () =>
      DUMMY_QUOTATIONS.map((q) => ({
        id: q.id,
        name: `${q.packageName} ${q.variantName} — ${q.leadName}`,
      })),
    []
  );

  useEffect(() => {
    if (!open) return;
    if (booking) {
      const matchedVenueId =
        venues.find((v) => v.name === booking.venueName)?.id ?? "";
      form.reset({
        quotationId: booking.quotation?.id ?? "",
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        venueId: matchedVenueId,
        eventType: booking.eventType,
        eventDate: booking.eventDate,
        pax: "",
        fullPayment: booking.fullPayment.toLocaleString("id-ID"),
        bookingFee: booking.bookingFee.toLocaleString("id-ID"),
        salesName: booking.salesName,
      });
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, booking]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQuotationPick(quotationId: string) {
    form.setValue("quotationId", quotationId);
    if (!quotationId) return;
    const q = DUMMY_QUOTATIONS.find((x) => x.id === quotationId);
    if (!q) return;
    if (!form.getValues("clientName")) {
      form.setValue("clientName", q.leadName);
    }
    form.setValue("eventType", q.eventType);
    form.setValue("fullPayment", q.totalPrice.toLocaleString("id-ID"));
    const matchedVenue = venues.find((v) => v.name === q.venue);
    if (matchedVenue) {
      form.setValue("venueId", matchedVenue.id);
    }
  }

  function onSubmit(_values: MiceFormValues): void {
    onOpenChange(false);
  }

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Booking MICE" : "Tambah Booking MICE"}
      maxWidth="sm:max-w-2xl"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form className="space-y-5 pb-2">
              {/* === Section: Quotation === */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quotation
                </p>
                <FormField
                  control={form.control}
                  name="quotationId"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Pilih Quotation</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={quotationOptions}
                          value={field.value}
                          onChange={handleQuotationPick}
                          placeholder="Pilih quotation (opsional)..."
                          searchPlaceholder="Cari quotation..."
                          emptyText="Tidak ada quotation"
                          className="w-full"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Memilih quotation akan otomatis mengisi venue, tipe event, dan full payment.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* === Section: Informasi Client === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Client
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="clientName"
                    rules={{ required: "Nama client wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Nama Client / Perusahaan *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="PT Maju Jaya" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientPhone"
                    rules={{ required: "No. telepon wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>No. Telepon *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="tel"
                            inputMode="numeric"
                            placeholder="0812345678"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* === Section: Detail Event === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Detail Event
                </p>

                <FormField
                  control={form.control}
                  name="venueId"
                  rules={{ required: "Venue wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Venue *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={venueOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pilih venue..."
                          searchPlaceholder="Cari venue..."
                          emptyText="Tidak ada venue"
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventType"
                  rules={{ required: "Tipe event wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Tipe & Durasi Event *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={EVENT_TYPE_OPTIONS}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pilih tipe event..."
                          searchPlaceholder="Cari tipe event..."
                          emptyText="Tidak ada tipe event"
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="eventDate"
                    rules={{ required: "Tanggal event wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Tanggal Event *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pax"
                    rules={{ required: "Jumlah pax wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Jumlah Pax *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="100"
                            type="number"
                            min="1"
                            inputMode="numeric"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* === Section: Informasi Pembayaran === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Pembayaran
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="fullPayment"
                    rules={{ required: "Full payment wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Full Payment *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span
                              aria-hidden="true"
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none"
                            >
                              Rp
                            </span>
                            <Input
                              className="pl-9"
                              value={field.value}
                              onChange={(e) =>
                                field.onChange(formatRp(e.target.value))
                              }
                              placeholder="45.000.000"
                              inputMode="numeric"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bookingFee"
                    rules={{ required: "Booking fee wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Booking Fee / DP *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span
                              aria-hidden="true"
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none"
                            >
                              Rp
                            </span>
                            <Input
                              className="pl-9"
                              value={field.value}
                              onChange={(e) =>
                                field.onChange(formatRp(e.target.value))
                              }
                              placeholder="15.000.000"
                              inputMode="numeric"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* === Section: Informasi Sales === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Sales
                </p>
                <FormField
                  control={form.control}
                  name="salesName"
                  rules={{ required: "Sales wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Sales *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={SALES_OPTIONS}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pilih sales..."
                          searchPlaceholder="Cari sales..."
                          emptyText="Tidak ada sales"
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background pt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              className="flex-1"
            >
              {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
