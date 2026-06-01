"use client";

import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { SignaturePad } from "@/components/shared/signature-pad";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useSalesMice,
  useCreateMiceBooking,
  useUpdateMiceBooking,
} from "@/hooks/use-mice-bookings";
import { createMiceBookingSchema } from "@/lib/validations/booking-mice";
import type { MiceBookingItem } from "./types";

interface MiceBookingDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: MiceBookingItem | null;
}

interface MiceFormValues {
  clientName: string;
  clientPhone: string;
  venueId: string;
  eventTypeId: string;
  eventDate: string;
  bookingDate: string;
  estimatedPax: string;
  salesId: string;
  bookingFee: string;
  bookingFeeDueDate: string;
  finalPayment: string;
  finalPaymentDueDate: string;
  notes: string;
}

const today = new Date().toISOString().split("T")[0];

const DEFAULT_VALUES: MiceFormValues = {
  clientName: "",
  clientPhone: "",
  venueId: "",
  eventTypeId: "",
  eventDate: "",
  bookingDate: today,
  estimatedPax: "",
  salesId: "",
  bookingFee: "",
  bookingFeeDueDate: "",
  finalPayment: "",
  finalPaymentDueDate: "",
  notes: "",
};

function formatRp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

function parseRpToNumber(formatted: string): number {
  return parseInt(formatted.replace(/\D/g, "") || "0", 10);
}

export function MiceBookingDrawer({
  open,
  onOpenChange,
  booking,
}: MiceBookingDrawerProps) {
  const isEdit = !!booking;
  const form = useForm<MiceFormValues>({ defaultValues: DEFAULT_VALUES });
  const signatureRef = useRef<string | null>(null);

  // Real data hooks
  const { data: venues = [] } = useVenues();
  const { data: eventTypes = [] } = useEventTypes("MICE");
  const { user } = useCurrentUser();
  const { data: salesMice = [] } = useSalesMice(open);

  const { mutateAsync: createMiceBooking, isPending: isCreating } = useCreateMiceBooking();
  const { mutateAsync: updateMiceBooking, isPending: isUpdating } = useUpdateMiceBooking();
  const isPending = isCreating || isUpdating;

  // Venue options
  const venueOptions = useMemo<SearchableSelectOption[]>(
    () => venues.map((v) => ({ id: v.id, name: v.name })),
    [venues]
  );

  // Event type options (MICE only)
  const eventTypeOptions = useMemo<SearchableSelectOption[]>(
    () => eventTypes.map((et) => ({ id: et.id, name: et.name })),
    [eventTypes]
  );

  // Sales auto-detect: if current user's profileId is in sales-mice list → read-only
  const currentUserIsSalesMice = useMemo(() => {
    if (!user) return false;
    return salesMice.some((s) => s.id === user.profileId);
  }, [salesMice, user]);

  const salesOptions = useMemo<SearchableSelectOption[]>(
    () =>
      salesMice.map((s) => ({
        id: s.id,
        name: s.fullName ?? s.id,
      })),
    [salesMice]
  );

  // Clear signature ref whenever drawer closes
  useEffect(() => {
    if (!open) {
      signatureRef.current = null;
    }
  }, [open]);

  // Edit-mode reset: map from MiceBookingItem shape
  useEffect(() => {
    if (!open) return;
    if (booking) {
      const bookingFeeterm = booking.terms.find((t) => t.name === "Booking Fee");
      const finalPaymentTerm = booking.terms.find((t) => t.name === "Final Payment");

      form.reset({
        clientName: booking.customer.name,
        clientPhone: booking.customer.phone,
        venueId: booking.venue.id,
        eventTypeId: "", // not returned by list API — left empty in edit mode
        eventDate: booking.eventDate
          ? new Date(booking.eventDate).toISOString().split("T")[0]
          : "",
        bookingDate: booking.bookingDate
          ? new Date(booking.bookingDate).toISOString().split("T")[0]
          : today,
        estimatedPax: "",
        salesId: booking.sales?.id ?? "",
        bookingFee: bookingFeeterm
          ? bookingFeeterm.amount.toLocaleString("id-ID")
          : "",
        bookingFeeDueDate: bookingFeeterm?.dueDate
          ? new Date(bookingFeeterm.dueDate).toISOString().split("T")[0]
          : "",
        finalPayment: finalPaymentTerm
          ? finalPaymentTerm.amount.toLocaleString("id-ID")
          : "",
        finalPaymentDueDate: finalPaymentTerm?.dueDate
          ? new Date(finalPaymentTerm.dueDate).toISOString().split("T")[0]
          : "",
        notes: "",
      });
    } else {
      // Create mode: auto-assign salesId if current user is sales-mice
      const autoSalesId =
        currentUserIsSalesMice && user?.profileId ? user.profileId : "";
      form.reset({ ...DEFAULT_VALUES, salesId: autoSalesId });
    }
  }, [open, booking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also update salesId when salesMice loads in create mode and user is detected
  useEffect(() => {
    if (open && !booking && currentUserIsSalesMice && user?.profileId) {
      form.setValue("salesId", user.profileId);
    }
  }, [open, booking, currentUserIsSalesMice, user?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: MiceFormValues): Promise<void> {
    const resolvedSalesId = currentUserIsSalesMice
      ? ((user?.profileId ?? values.salesId) || undefined)
      : values.salesId || undefined;

    const payload = {
      clientName: values.clientName,
      clientPhone: values.clientPhone,
      venueId: values.venueId,
      eventTypeId: values.eventTypeId,
      eventDate: values.eventDate,
      bookingDate: values.bookingDate,
      estimatedPax: values.estimatedPax ? Number(values.estimatedPax) : null,
      salesId: resolvedSalesId ?? null,
      salesSignature: signatureRef.current ?? null,
      bookingFee: parseRpToNumber(values.bookingFee),
      bookingFeeDueDate: values.bookingFeeDueDate,
      finalPayment: parseRpToNumber(values.finalPayment),
      finalPaymentDueDate: values.finalPaymentDueDate,
      notes: values.notes || undefined,
      quotationId: null,
      sourceOfInformationId: null,
    };

    const parsed = createMiceBookingSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    if (isEdit && booking) {
      const result = await updateMiceBooking({ ...parsed.data, id: booking.id });
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan booking.");
        return;
      }
      toast.success("Booking MICE berhasil diperbarui.");
    } else {
      const result = await createMiceBooking(parsed.data);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan booking.");
        return;
      }
      toast.success("Booking MICE berhasil disimpan.");
    }

    onOpenChange(false);
  }

  const currentSalesName = useMemo(() => {
    if (!currentUserIsSalesMice || !user) return null;
    const found = salesMice.find((s) => s.id === user.profileId);
    return found?.fullName ?? user.name ?? null;
  }, [currentUserIsSalesMice, salesMice, user]);

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

              {/* === Section: Informasi Client === */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Client
                </p>
                <div className="flex flex-col gap-3">
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

              {/* === Section: Quotation (deferred) === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quotation
                </p>
                <div className="w-full">
                  <p className="text-sm font-medium mb-1.5">Pilih Quotation</p>
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground cursor-not-allowed select-none">
                    Modul Quotation menyusul
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Integrasi quotation akan tersedia di versi berikutnya.
                  </p>
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
                  name="eventTypeId"
                  rules={{ required: "Tipe event wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>
                        Tipe &amp; Durasi Event *
                        {isEdit && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (edit: pilih ulang jika perlu)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={eventTypeOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pilih tipe event..."
                          searchPlaceholder="Cari tipe event..."
                          emptyText="Tidak ada tipe event MICE"
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
                    name="bookingDate"
                    rules={{ required: "Tanggal booking wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Tanggal Booking *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                </div>

                <FormField
                  control={form.control}
                  name="estimatedPax"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Jumlah Pax (Estimasi)</FormLabel>
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

              {/* === Section: Informasi Sales === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Sales
                </p>

                {currentUserIsSalesMice ? (
                  /* Current user IS a sales-mice → show read-only */
                  <div className="w-full">
                    <p className="text-sm font-medium mb-1.5">Sales *</p>
                    <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
                      {currentSalesName ?? "—"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Booking ini akan tercatat atas nama Anda.
                    </p>
                  </div>
                ) : (
                  /* Admin / manager → pick from sales-mice list */
                  <FormField
                    control={form.control}
                    name="salesId"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Sales</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={salesOptions}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Pilih sales (opsional)..."
                            searchPlaceholder="Cari sales..."
                            emptyText="Tidak ada sales MICE"
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* === Section: Catatan === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Catatan
                </p>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Catatan Tambahan</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="Catatan tambahan (opsional)..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* === Section: Informasi Pembayaran === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Informasi Pembayaran
                </p>

                {/* Booking Fee row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <FormField
                    control={form.control}
                    name="bookingFeeDueDate"
                    rules={{ required: "Jatuh tempo booking fee wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Jatuh Tempo Booking Fee *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Final Payment row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="finalPayment"
                    rules={{ required: "Final payment wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Final Payment *</FormLabel>
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
                    name="finalPaymentDueDate"
                    rules={{ required: "Jatuh tempo final payment wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Jatuh Tempo Final Payment *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* === Section: Tanda Tangan Sales === */}
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tanda Tangan
                </p>
                <SignaturePad
                  onSignature={(url) => { signatureRef.current = url; }}
                  label="Tanda Tangan Sales"
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
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => { void form.handleSubmit(onSubmit)(); }}
              className="flex-1"
              disabled={isPending}
            >
              {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
