"use client";

import { useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
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

function formatRp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

export function MiceBookingDrawer({ open, onOpenChange, booking }: MiceBookingDrawerProps) {
  const isEdit = !!booking;
  const form = useForm<MiceFormValues>({ defaultValues: DEFAULT_VALUES });

  const { data: venues = [] } = useQuery({
    queryKey: ["venues"],
    queryFn: () => fetchJson<VenueOption[]>("/api/venues"),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!open) return;
    if (booking) {
      const matchedVenueId = venues.find((v) => v.name === booking.venueName)?.id ?? "";
      form.reset({
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

  function onSubmit(_values: MiceFormValues): void {
    onOpenChange(false);
  }

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Booking MICE" : "Tambah Booking MICE"}
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form className="space-y-5 pb-2">
              {/* Client */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Client
                </p>
                <FormField
                  control={form.control}
                  name="clientName"
                  rules={{ required: "Nama client wajib diisi" }}
                  render={({ field }) => (
                    <FormItem>
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
                    <FormItem>
                      <FormLabel>No. Telepon *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0812345678" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Event */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Detail Event
                </p>
                <FormField
                  control={form.control}
                  name="venueId"
                  rules={{ required: "Venue wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue *</FormLabel>
                      <SearchableSelect
                        options={venues}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih venue..."
                        searchPlaceholder="Cari venue..."
                        emptyText="Tidak ada venue"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eventType"
                  rules={{ required: "Tipe event wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe & Durasi Event *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih tipe event" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EVENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="eventDate"
                    rules={{ required: "Tanggal event wajib diisi" }}
                    render={({ field }) => (
                      <FormItem>
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
                      <FormItem>
                        <FormLabel>Jumlah Pax *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="100" type="number" min="1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Payment */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Pembayaran
                </p>
                <FormField
                  control={form.control}
                  name="fullPayment"
                  rules={{ required: "Full payment wajib diisi" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Payment *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            Rp
                          </span>
                          <Input
                            className="pl-9"
                            value={field.value}
                            onChange={(e) => field.onChange(formatRp(e.target.value))}
                            placeholder="45.000.000"
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
                    <FormItem>
                      <FormLabel>Booking Fee / DP *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            Rp
                          </span>
                          <Input
                            className="pl-9"
                            value={field.value}
                            onChange={(e) => field.onChange(formatRp(e.target.value))}
                            placeholder="15.000.000"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Sales */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Sales
                </p>
                <FormField
                  control={form.control}
                  name="salesName"
                  rules={{ required: "Sales wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih sales" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SALES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white pt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              className="flex-1 bg-black text-white hover:bg-gray-800 cursor-pointer"
            >
              {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
