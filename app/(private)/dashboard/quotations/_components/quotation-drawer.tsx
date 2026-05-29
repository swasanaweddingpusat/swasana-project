"use client";

import { useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { QuotationItem } from "./quotations-table";

interface QuotationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuotation: QuotationItem | null;
}

interface QuotationFormValues {
  leadId: string;
  venue: string;
  category: string;
  eventType: string;
  eventDate: string;
  packageName: string;
  variantName: string;
  price: string;
  discount: string;
  validUntil: string;
  notes: string;
}

interface DummyLead {
  id: string;
  name: string;
  phone: string;
  venue: string;
  category: "weddings" | "mice";
  eventType: string;
  eventDate: string;
}

const DUMMY_LEADS: DummyLead[] = [
  {
    id: "l1",
    name: "Ahmad Fauzi",
    phone: "081234567890",
    venue: "Bringhall",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-08-15",
  },
  {
    id: "l2",
    name: "Budi Santoso",
    phone: "081298765432",
    venue: "Grand Puri 2",
    category: "weddings",
    eventType: "Resepsi",
    eventDate: "2026-09-20",
  },
  {
    id: "l3",
    name: "Citra Dewi",
    phone: "081355667788",
    venue: "De Rivier Mansion",
    category: "weddings",
    eventType: "Tea Pai & Resepsi",
    eventDate: "2026-10-05",
  },
  {
    id: "l4",
    name: "PT Maju Jaya",
    phone: "02112345678",
    venue: "Sasana Esthi Sopo",
    category: "mice",
    eventType: "Fullday Meeting 8hrs",
    eventDate: "2026-07-10",
  },
  {
    id: "l5",
    name: "Dwi Prasetyo",
    phone: "081277889900",
    venue: "Lippo Grand Ballroom",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-11-22",
  },
  {
    id: "l6",
    name: "PT Global Tech",
    phone: "02198765432",
    venue: "Bripensiunan",
    category: "mice",
    eventType: "Halfday 6hrs",
    eventDate: "2026-06-25",
  },
];

const PACKAGES = ["Gold", "Platinum", "Sapphire"];

const VARIANTS = ["100 Pax", "200 Pax", "300 Pax", "400 Pax", "500 Pax", "600 Pax"];

const CATEGORY_LABEL: Record<"weddings" | "mice", string> = {
  weddings: "Weddings",
  mice: "MICE",
};

const DEFAULT_VALUES: QuotationFormValues = {
  leadId: "",
  venue: "",
  category: "",
  eventType: "",
  eventDate: "",
  packageName: "",
  variantName: "",
  price: "",
  discount: "",
  validUntil: "",
  notes: "",
};

function parseNumericInput(raw: string): number {
  return parseInt(raw.replace(/\D/g, ""), 10) || 0;
}

function formatNumericDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

export function QuotationDrawer({
  open,
  onOpenChange,
  editQuotation,
}: QuotationDrawerProps) {
  const isEdit = !!editQuotation;

  const form = useForm<QuotationFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const watchedLeadId = form.watch("leadId");
  const watchedPrice = form.watch("price");
  const watchedDiscount = form.watch("discount");

  const selectedLead = DUMMY_LEADS.find((l) => l.id === watchedLeadId) ?? null;

  const priceNum = parseNumericInput(watchedPrice);
  const discountNum = parseNumericInput(watchedDiscount);
  const totalNum = Math.max(0, priceNum - discountNum);

  function formatTotal(): string {
    if (priceNum === 0) return "—";
    return totalNum.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  useEffect(() => {
    if (!open) return;
    if (editQuotation) {
      const lead =
        DUMMY_LEADS.find((l) => l.name === editQuotation.leadName) ??
        DUMMY_LEADS[0];
      form.reset({
        leadId: lead?.id ?? "",
        venue: editQuotation.venue,
        category: editQuotation.category,
        eventType: editQuotation.eventType,
        eventDate: editQuotation.eventDate,
        packageName: editQuotation.packageName,
        variantName: editQuotation.variantName,
        price: editQuotation.price.toLocaleString("id-ID"),
        discount:
          editQuotation.discount > 0
            ? editQuotation.discount.toLocaleString("id-ID")
            : "",
        validUntil: editQuotation.validUntil,
        notes: editQuotation.notes,
      });
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, editQuotation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedLead) return;
    form.setValue("venue", selectedLead.venue);
    form.setValue("category", selectedLead.category);
    form.setValue("eventType", selectedLead.eventType);
    form.setValue("eventDate", selectedLead.eventDate);
  }, [watchedLeadId]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(_values: QuotationFormValues) {
    toast.success(
      isEdit
        ? "Quotation berhasil diperbarui."
        : "Quotation berhasil disimpan."
    );
    onOpenChange(false);
  }

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Quotation" : "Tambah Quotation"}
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form className="space-y-4 pb-2">
              {/* Lead */}
              <FormField
                control={form.control}
                name="leadId"
                rules={{ required: "Lead wajib dipilih" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih lead..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DUMMY_LEADS.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            <span className="flex flex-col">
                              <span>{l.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {l.phone}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Auto-filled fields from lead */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Venue (read-only) */}
                <FormField
                  control={form.control}
                  name="venue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly
                          placeholder="—"
                          aria-readonly="true"
                          className={cn(
                            "bg-muted text-muted-foreground",
                            !field.value && "italic"
                          )}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Kategori (read-only) */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori</FormLabel>
                      <FormControl>
                        <Input
                          value={
                            field.value
                              ? CATEGORY_LABEL[
                                  field.value as "weddings" | "mice"
                                ] ?? field.value
                              : ""
                          }
                          readOnly
                          placeholder="—"
                          aria-readonly="true"
                          className={cn(
                            "bg-muted text-muted-foreground",
                            !field.value && "italic"
                          )}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Event Type (read-only) */}
                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly
                          placeholder="—"
                          aria-readonly="true"
                          className={cn(
                            "bg-muted text-muted-foreground",
                            !field.value && "italic"
                          )}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Tanggal Event (read-only) */}
                <FormField
                  control={form.control}
                  name="eventDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Event</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly
                          placeholder="—"
                          aria-readonly="true"
                          className={cn(
                            "bg-muted text-muted-foreground",
                            !field.value && "italic"
                          )}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wide">
                  Detail Penawaran
                </p>

                {/* Paket & Varian */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="packageName"
                    rules={{ required: "Paket wajib dipilih" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paket *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih paket..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PACKAGES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="variantName"
                    rules={{ required: "Varian wajib dipilih" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Varian *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih varian..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {VARIANTS.map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Harga */}
                <div className="mt-4">
                  <FormField
                    control={form.control}
                    name="price"
                    rules={{ required: "Harga wajib diisi" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Harga *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={field.value}
                              onChange={(e) => {
                                const formatted = formatNumericDisplay(
                                  e.target.value
                                );
                                field.onChange(formatted);
                              }}
                              placeholder="0"
                              inputMode="numeric"
                              className="pl-10"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Diskon */}
                <div className="mt-4">
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Diskon</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={field.value}
                              onChange={(e) => {
                                const formatted = formatNumericDisplay(
                                  e.target.value
                                );
                                field.onChange(formatted);
                              }}
                              placeholder="0"
                              inputMode="numeric"
                              className="pl-10"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Total (read-only, auto-calculated) */}
                <div className="mt-4">
                  <p className="text-sm font-medium mb-1.5">Total</p>
                  <div
                    role="status"
                    aria-live="polite"
                    aria-label={`Total quotation ${formatTotal()}`}
                    className="flex items-center h-10 px-3 rounded-md border border-border bg-muted text-sm font-semibold text-foreground"
                  >
                    {formatTotal()}
                  </div>
                </div>
              </div>

              {/* Berlaku Sampai */}
              <FormField
                control={form.control}
                name="validUntil"
                rules={{ required: "Tanggal berlaku wajib diisi" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Berlaku Sampai *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Catatan */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan</FormLabel>
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
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
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
