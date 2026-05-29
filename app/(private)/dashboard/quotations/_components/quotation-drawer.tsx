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
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
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
    venue: "Menara Bripens",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-08-15",
  },
  {
    id: "l2",
    name: "Budi Santoso",
    phone: "081298765432",
    venue: "Paramita",
    category: "weddings",
    eventType: "Resepsi",
    eventDate: "2026-09-20",
  },
  {
    id: "l3",
    name: "Citra Dewi",
    phone: "081355667788",
    venue: "BRIN Thamrin",
    category: "weddings",
    eventType: "Teapai & Resepsi",
    eventDate: "2026-10-05",
  },
  {
    id: "l4",
    name: "PT Maju Jaya",
    phone: "02112345678",
    venue: "Grand Slipi",
    category: "mice",
    eventType: "Fullday Meeting 8hrs",
    eventDate: "2026-07-10",
  },
  {
    id: "l5",
    name: "Dwi Prasetyo",
    phone: "081277889900",
    venue: "Lippo Kuningan",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-11-22",
  },
  {
    id: "l6",
    name: "PT Global Teknologi",
    phone: "02198765432",
    venue: "Samisara Sopodel",
    category: "mice",
    eventType: "Halfday Meeting 6hrs",
    eventDate: "2026-06-25",
  },
  {
    id: "l7",
    name: "Eka Wulandari",
    phone: "081312345678",
    venue: "Seskoad",
    category: "weddings",
    eventType: "Pemberkatan Resepsi",
    eventDate: "2026-12-06",
  },
  {
    id: "l8",
    name: "PT Telkom Indonesia",
    phone: "02145678901",
    venue: "BRIN Gatot Subroto",
    category: "mice",
    eventType: "Gala Dinner",
    eventDate: "2026-09-18",
  },
  {
    id: "l9",
    name: "Fajar Nugroho",
    phone: "081356789012",
    venue: "Dharmagati",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-07-26",
  },
  {
    id: "l10",
    name: "PT Astra Internasional",
    phone: "02167890123",
    venue: "Patrajasa",
    category: "mice",
    eventType: "Corporate Event",
    eventDate: "2026-08-07",
  },
];

const VARIANTS_BY_VENUE: Record<string, string[]> = {
  "BRIN Thamrin": ["GOLD", "PLATINUM", "SAPPHIRE"],
  "BRIN Gatot Subroto": ["GOLD", "PLATINUM", "SAPPHIRE"],
  Seskoad: ["GOLD", "PLATINUM", "SAPPHIRE"],
  Dharmagati: ["GOLD", "PLATINUM", "SAPPHIRE"],
  "Lippo Kuningan": ["GOLD", "PLATINUM", "SAPPHIRE"],
  Patrajasa: ["GOLD", "PLATINUM", "SAPPHIRE"],
  "Grand Slipi": ["GOLD", "PLATINUM", "SAPPHIRE"],
  "Menara Bripens": ["ALFA", "PRIORITY", "SIGNATURE"],
  "Samisara Sopodel": ["ALFA", "PRIORITY", "SIGNATURE"],
  Paramita: ["CLASSIC", "LUXURY", "ROYAL"],
};

function derivePackageName(venue: string): string {
  if (!venue) return "";
  return `${venue.toUpperCase()} PACKAGE`;
}

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

const LEAD_OPTIONS: SearchableSelectOption[] = DUMMY_LEADS.map((l) => ({
  id: l.id,
  name: l.name,
  badge: l.phone,
}));

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
  const watchedVenue = form.watch("venue");

  const selectedLead = DUMMY_LEADS.find((l) => l.id === watchedLeadId) ?? null;

  const variantOptions: SearchableSelectOption[] = (
    VARIANTS_BY_VENUE[watchedVenue] ?? []
  ).map((v) => ({ id: v, name: v }));

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
        packageName: derivePackageName(editQuotation.venue),
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
    form.setValue("packageName", derivePackageName(selectedLead.venue));
    form.setValue("variantName", "");
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
        <div className="flex-1 overflow-y-auto px-2">
          <Form {...form}>
            <form className="space-y-3 pb-2">
              {/* Lead */}
              <FormField
                control={form.control}
                name="leadId"
                rules={{ required: "Lead wajib dipilih" }}
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Lead *</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={LEAD_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih lead..."
                        searchPlaceholder="Cari lead..."
                        emptyText="Lead tidak ditemukan"
                      />
                    </FormControl>
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
                    <FormItem className="w-full">
                      <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Venue</FormLabel>
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
                    <FormItem className="w-full">
                      <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Kategori</FormLabel>
                      <FormControl>
                        <Input
                          value={
                            field.value
                              ? (CATEGORY_LABEL[
                                  field.value as "weddings" | "mice"
                                ] ?? field.value)
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
                    <FormItem className="w-full">
                      <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Event Type</FormLabel>
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
                    <FormItem className="w-full">
                      <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Tanggal Event</FormLabel>
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

              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Detail Penawaran
                </p>

                {/* Paket (read-only, auto-derived) */}
                <FormField
                  control={form.control}
                  name="packageName"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Paket</FormLabel>
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

                {/* Varian + Pax info */}
                <FormField
                  control={form.control}
                  name="variantName"
                  rules={{ required: "Varian wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Varian *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={variantOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={
                            watchedVenue
                              ? "Pilih varian..."
                              : "Pilih lead dulu..."
                          }
                          searchPlaceholder="Cari varian..."
                          emptyText="Varian tidak ditemukan"
                          disabled={!watchedVenue}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pax: 800 (default)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Harga */}
                <FormField
                  control={form.control}
                  name="price"
                  rules={{ required: "Harga wajib diisi" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Harga *</FormLabel>
                      <FormControl>
                        <div className="relative w-full">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
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
                            className="w-full pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Diskon */}
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Diskon</FormLabel>
                      <FormControl>
                        <div className="relative w-full">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
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
                            className="w-full pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Total (read-only, auto-calculated) */}
                <div>
                  <p className={cn("text-sm", "font-medium", "text-gray-700", "mb-1.5")}>Total</p>
                  <Input
                    readOnly
                    role="status"
                    aria-live="polite"
                    aria-label={`Total quotation ${formatTotal()}`}
                    value={formatTotal()}
                    className="bg-muted text-foreground font-semibold"
                  />
                </div>
              </div>

              {/* Berlaku Sampai */}
              <FormField
                control={form.control}
                name="validUntil"
                rules={{ required: "Tanggal berlaku wajib diisi" }}
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Berlaku Sampai *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="w-full" />
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
                  <FormItem className="w-full">
                    <FormLabel className={cn("text-sm", "font-medium", "text-gray-700")}>Catatan</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Catatan tambahan (opsional)..."
                        className="w-full"
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
        <div className="sticky bottom-0 bg-white z-10">
          <div className="flex py-4 gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-[40%] cursor-pointer text-red-600 border-red-600 hover:bg-red-50"
            >
              Batal
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              className="flex-[60%] bg-black text-white hover:bg-gray-800 cursor-pointer"
            >
              {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
