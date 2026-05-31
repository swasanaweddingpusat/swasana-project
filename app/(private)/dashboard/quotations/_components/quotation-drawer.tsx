"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { AddCircle, TrashBinTrash, Refresh } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { QuotationItem } from "./quotations-table";

interface QuotationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuotation: QuotationItem | null;
}

interface QuotationItemForm {
  description: string;
  qty: string;
  price: string;
  total: string;
  manualTotal: boolean;
}

interface QuotationFormValues {
  leadId: string;
  venue: string;
  category: string;
  eventType: string;
  eventDate: string;
  instansi: string;
  purchaseOrderNo: string;
  salesName: string;
  salesPhone: string;
  details: string;
  time: string;
  place: string;
  packageName: string;
  variantName: string;
  items: QuotationItemForm[];
  discount: string;
  bookingFee: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  downPayment: string;
  others: string;
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

const EMPTY_ITEM: QuotationItemForm = {
  description: "",
  qty: "",
  price: "",
  total: "",
  manualTotal: false,
};

const DEFAULT_VALUES: QuotationFormValues = {
  leadId: "",
  venue: "",
  category: "",
  eventType: "",
  eventDate: "",
  instansi: "",
  purchaseOrderNo: "",
  salesName: "",
  salesPhone: "",
  details: "",
  time: "",
  place: "",
  packageName: "",
  variantName: "",
  items: [{ ...EMPTY_ITEM }],
  discount: "",
  bookingFee: "",
  bankName: "",
  bankAccountNo: "",
  bankAccountName: "",
  downPayment: "",
  others: "",
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

function formatNumericDisplay(raw: string | number): string {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

function formatRupiah(amount: number): string {
  if (amount === 0) return "—";
  return amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const LABEL_CLASS = cn("text-sm", "font-medium", "text-foreground");

export function QuotationDrawer({
  open,
  onOpenChange,
  editQuotation,
}: QuotationDrawerProps) {
  const isEdit = !!editQuotation;

  const form = useForm<QuotationFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedLeadId = form.watch("leadId");
  const watchedVenue = form.watch("venue");
  const watchedItems = form.watch("items");
  const watchedDiscount = form.watch("discount");
  const watchedOthers = form.watch("others");

  const selectedLead = DUMMY_LEADS.find((l) => l.id === watchedLeadId) ?? null;

  const variantOptions: SearchableSelectOption[] = (
    VARIANTS_BY_VENUE[watchedVenue] ?? []
  ).map((v) => ({ id: v, name: v }));

  const subtotal = (watchedItems ?? []).reduce(
    (sum, it) => sum + parseNumericInput(it?.total ?? ""),
    0
  );
  const discountNum = parseNumericInput(watchedDiscount);
  const othersNum = parseNumericInput(watchedOthers);
  const grandTotal = Math.max(0, subtotal - discountNum + othersNum);

  // Recompute total baris (kalau bukan manual) dari qty * price
  function recomputeRowTotal(index: number) {
    const item = form.getValues(`items.${index}`);
    if (item?.manualTotal) return;
    const qty = parseNumericInput(item?.qty ?? "");
    const price = parseNumericInput(item?.price ?? "");
    const total = qty * price;
    form.setValue(
      `items.${index}.total`,
      total > 0 ? total.toLocaleString("id-ID") : "",
      { shouldDirty: true }
    );
  }

  function revertRowTotal(index: number) {
    form.setValue(`items.${index}.manualTotal`, false, { shouldDirty: true });
    recomputeRowTotal(index);
  }

  useEffect(() => {
    if (!open) return;
    if (editQuotation) {
      const lead =
        DUMMY_LEADS.find((l) => l.name === editQuotation.leadName) ??
        DUMMY_LEADS[0];
      const items: QuotationItemForm[] =
        editQuotation.items && editQuotation.items.length > 0
          ? editQuotation.items.map((it) => ({
              description: it.description,
              qty: it.qty > 0 ? String(it.qty) : "",
              price: it.price > 0 ? formatNumericDisplay(it.price) : "",
              total: it.total > 0 ? formatNumericDisplay(it.total) : "",
              manualTotal: !!it.manualTotal,
            }))
          : [
              {
                description: `${editQuotation.packageName} — ${editQuotation.variantName}`,
                qty: "1",
                price: formatNumericDisplay(editQuotation.price),
                total: formatNumericDisplay(editQuotation.price),
                manualTotal: true,
              },
            ];
      form.reset({
        leadId: lead?.id ?? "",
        venue: editQuotation.venue,
        category: editQuotation.category,
        eventType: editQuotation.eventType,
        eventDate: editQuotation.eventDate,
        instansi: editQuotation.instansi ?? "",
        purchaseOrderNo: editQuotation.purchaseOrderNo ?? "",
        salesName: editQuotation.salesName,
        salesPhone: editQuotation.salesPhone ?? "",
        details: editQuotation.details ?? "",
        time: editQuotation.time ?? "",
        place: editQuotation.place ?? "",
        packageName: derivePackageName(editQuotation.venue),
        variantName: editQuotation.variantName,
        items,
        discount:
          editQuotation.discount > 0
            ? formatNumericDisplay(editQuotation.discount)
            : "",
        bookingFee: editQuotation.bookingFee
          ? formatNumericDisplay(editQuotation.bookingFee)
          : "",
        bankName: editQuotation.bankName ?? "",
        bankAccountNo: editQuotation.bankAccountNo ?? "",
        bankAccountName: editQuotation.bankAccountName ?? "",
        downPayment: editQuotation.downPayment
          ? formatNumericDisplay(editQuotation.downPayment)
          : "",
        others: editQuotation.others
          ? formatNumericDisplay(editQuotation.others)
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
      maxWidth="sm:max-w-2xl"
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
                    <FormLabel className={LABEL_CLASS}>Lead *</FormLabel>
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
                <FormField
                  control={form.control}
                  name="venue"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Venue</FormLabel>
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
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Kategori</FormLabel>
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
                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Event Type</FormLabel>
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
                <FormField
                  control={form.control}
                  name="eventDate"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Tanggal Event</FormLabel>
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

              {/* ── Info Dokumen ─────────────────────────────────── */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Info Dokumen
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="instansi"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Instansi</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="mis. Al Azhar"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchaseOrderNo"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          Purchase Order No.
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="opsional"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Details</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="mis. Venue Only"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Time</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="mis. Half Day 07.00 - 13.00"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="place"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Place</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="mis. Ballroom"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="salesName"
                    rules={{ required: "Nama sales wajib diisi" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Sales *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Nama sales"
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salesPhone"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>
                          No. Hp Sales
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="opsional"
                            inputMode="tel"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* ── Detail Penawaran (varian + line items) ───────── */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Detail Penawaran
                </p>

                <FormField
                  control={form.control}
                  name="packageName"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Paket</FormLabel>
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

                <FormField
                  control={form.control}
                  name="variantName"
                  rules={{ required: "Varian wajib dipilih" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Varian *</FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Line items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className={LABEL_CLASS}>Rincian Item</p>
                    <span className="text-xs text-muted-foreground">
                      Total = Qty × Harga (bisa diisi manual)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {fields.map((fieldItem, index) => {
                      const isManual = form.getValues(
                        `items.${index}.manualTotal`
                      );
                      return (
                        <div
                          key={fieldItem.id}
                          className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.description`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Deskripsi item / judul section (akhiri ':' untuk section)"
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                              aria-label="Hapus item"
                              className="shrink-0 text-destructive hover:bg-destructive/10"
                            >
                              <TrashBinTrash
                                weight="BoldDuotone"
                                className="h-4 w-4"
                              />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.qty`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-muted-foreground">
                                    Qty
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      value={field.value}
                                      onChange={(e) => {
                                        const digits = e.target.value.replace(
                                          /\D/g,
                                          ""
                                        );
                                        field.onChange(digits);
                                        recomputeRowTotal(index);
                                      }}
                                      placeholder="0"
                                      inputMode="numeric"
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`items.${index}.price`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-muted-foreground">
                                    Harga
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      value={field.value}
                                      onChange={(e) => {
                                        field.onChange(
                                          formatNumericDisplay(e.target.value)
                                        );
                                        recomputeRowTotal(index);
                                      }}
                                      placeholder="0"
                                      inputMode="numeric"
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`items.${index}.total`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Total</span>
                                    {isManual && (
                                      <button
                                        type="button"
                                        onClick={() => revertRowTotal(index)}
                                        className="flex items-center gap-0.5 text-[10px] text-primary hover:underline cursor-pointer"
                                        aria-label="Kembalikan ke otomatis"
                                      >
                                        <Refresh
                                          weight="BoldDuotone"
                                          className="h-3 w-3"
                                        />
                                        auto
                                      </button>
                                    )}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      value={field.value}
                                      onChange={(e) => {
                                        form.setValue(
                                          `items.${index}.manualTotal`,
                                          true
                                        );
                                        field.onChange(
                                          formatNumericDisplay(e.target.value)
                                        );
                                      }}
                                      placeholder="0"
                                      inputMode="numeric"
                                      className={cn(
                                        "w-full",
                                        isManual && "border-primary/50"
                                      )}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ ...EMPTY_ITEM })}
                    className="w-full rounded-xl border-dashed"
                  >
                    <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1" />
                    Tambah Item
                  </Button>
                </div>
              </div>

              {/* ── Term & Pembayaran ────────────────────────────── */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Term &amp; Pembayaran
                </p>

                <FormField
                  control={form.control}
                  name="bookingFee"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Booking Fee</FormLabel>
                      <FormControl>
                        <div className="relative w-full">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                            Rp
                          </span>
                          <Input
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(
                                formatNumericDisplay(e.target.value)
                              )
                            }
                            placeholder="0"
                            inputMode="numeric"
                            className="w-full pl-8"
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Bank</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="mis. Bank BCA"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bankAccountNo"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>No. Rekening</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="No. rekening"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bankAccountName"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Atas Nama</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Nama pemilik rekening"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* ── Ringkasan Total ──────────────────────────────── */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Ringkasan
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Diskon</FormLabel>
                        <FormControl>
                          <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={field.value}
                              onChange={(e) =>
                                field.onChange(
                                  formatNumericDisplay(e.target.value)
                                )
                              }
                              placeholder="0"
                              inputMode="numeric"
                              className="w-full pl-8"
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="downPayment"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Down Payment</FormLabel>
                        <FormControl>
                          <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={field.value}
                              onChange={(e) =>
                                field.onChange(
                                  formatNumericDisplay(e.target.value)
                                )
                              }
                              placeholder="0"
                              inputMode="numeric"
                              className="w-full pl-8"
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="others"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Others</FormLabel>
                        <FormControl>
                          <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={field.value}
                              onChange={(e) =>
                                field.onChange(
                                  formatNumericDisplay(e.target.value)
                                )
                              }
                              placeholder="0"
                              inputMode="numeric"
                              className="w-full pl-8"
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="rounded-xl bg-muted p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatRupiah(subtotal)}</span>
                  </div>
                  {discountNum > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Diskon</span>
                      <span className="tabular-nums">
                        - {formatRupiah(discountNum)}
                      </span>
                    </div>
                  )}
                  {othersNum > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Others</span>
                      <span className="tabular-nums">
                        {formatRupiah(othersNum)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                    <span>Total</span>
                    <span
                      role="status"
                      aria-live="polite"
                      className="tabular-nums"
                    >
                      {formatRupiah(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Berlaku Sampai */}
              <FormField
                control={form.control}
                name="validUntil"
                rules={{ required: "Tanggal berlaku wajib diisi" }}
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel className={LABEL_CLASS}>Berlaku Sampai *</FormLabel>
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
                    <FormLabel className={LABEL_CLASS}>Catatan</FormLabel>
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
        <div className="sticky bottom-0 bg-background z-10">
          <div className="flex py-4 gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-[40%] cursor-pointer text-destructive border-destructive hover:bg-destructive/10"
            >
              Batal
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              className="flex-[60%] cursor-pointer"
            >
              {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
