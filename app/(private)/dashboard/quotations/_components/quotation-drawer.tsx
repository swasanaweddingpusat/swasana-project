"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { AutocompleteInput } from "@/components/shared/AutocompleteInput";
import {
  AddCircle,
  TrashBinTrash,
  Refresh,
  ArrowRight,
  Calendar as CalendarIcon,
} from "@solar-icons/react";
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
  // Step 1 — informasi
  leadId: string;
  clientName: string; // To (auto dari lead)
  clientPhone: string; // auto dari lead
  instansi: string; // manual
  salesId: string;
  salesName: string; // auto dari sales terpilih
  salesPhone: string; // auto dari sales terpilih
  eventName: string; // auto dari lead.eventType
  details: string; // manual
  time: string; // manual (range jam)
  venue: string; // auto dari lead
  eventDate: string; // auto dari lead
  category: string; // hidden — ikut lead (mice)
  // Step 2 — fasilitas / item
  items: QuotationItemForm[];
  discount: string;
  validUntil: string;
  notes: string;
}

// ── Dummy: leads yang qualified (sumber auto-fill) ──────────────────
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
    name: "Ibu Henny",
    phone: "0811 960 053",
    venue: "Patra Jasa Yudistira Grand Ballroom",
    category: "mice",
    eventType: "Graduation",
    eventDate: "2026-05-09",
  },
  {
    id: "l2",
    name: "PT Maju Jaya",
    phone: "02112345678",
    venue: "Grand Slipi",
    category: "mice",
    eventType: "Fullday Meeting 8hrs",
    eventDate: "2026-07-10",
  },
  {
    id: "l3",
    name: "PT Global Teknologi",
    phone: "02198765432",
    venue: "Samisara Sopodel",
    category: "mice",
    eventType: "Halfday Meeting 6hrs",
    eventDate: "2026-06-25",
  },
  {
    id: "l4",
    name: "PT Telkom Indonesia",
    phone: "02145678901",
    venue: "BRIN Gatot Subroto",
    category: "mice",
    eventType: "Gala Dinner",
    eventDate: "2026-09-18",
  },
  {
    id: "l5",
    name: "PT Astra Internasional",
    phone: "02167890123",
    venue: "Patrajasa",
    category: "mice",
    eventType: "Corporate Event",
    eventDate: "2026-08-07",
  },
];

// ── Dummy: sales dengan role sales-mice ─────────────────────────────
interface DummySalesMice {
  id: string;
  name: string;
  phone: string;
}

const DUMMY_SALES_MICE: DummySalesMice[] = [
  { id: "s1", name: "Metalia Yuniarti", phone: "0851 2108 5180" },
  { id: "s2", name: "Rina Wijaya", phone: "0812 3456 7890" },
  { id: "s3", name: "Deni Pratama", phone: "0813 9876 5432" },
];

// ── Dummy: opsi venue & event (auto dari lead, tapi bisa diganti) ────
// ── Dummy: opsi venue & event (auto dari lead, tapi bisa diganti) ────
const VENUE_OPTIONS: SearchableSelectOption[] = [
  { id: "Patra Jasa Yudistira Grand Ballroom", name: "Patra Jasa Yudistira Grand Ballroom" },
  { id: "Grand Slipi", name: "Grand Slipi" },
  { id: "Samisara Sopodel", name: "Samisara Sopodel" },
  { id: "BRIN Gatot Subroto", name: "BRIN Gatot Subroto" },
  { id: "Patrajasa", name: "Patrajasa" },
  { id: "Menara Bripens", name: "Menara Bripens" },
  { id: "BRIN Thamrin", name: "BRIN Thamrin" },
];

const EVENT_OPTIONS: SearchableSelectOption[] = [
  { id: "Graduation", name: "Graduation" },
  { id: "Fullday Meeting 8hrs", name: "Fullday Meeting 8hrs" },
  { id: "Halfday Meeting 6hrs", name: "Halfday Meeting 6hrs" },
  { id: "Gala Dinner", name: "Gala Dinner" },
  { id: "Corporate Event", name: "Corporate Event" },
  { id: "Seminar", name: "Seminar" },
  { id: "Wedding Reception", name: "Wedding Reception" },
];

const DEFAULT_VALUES: QuotationFormValues = {
  leadId: "",
  clientName: "",
  clientPhone: "",
  instansi: "",
  salesId: "",
  salesName: "",
  salesPhone: "",
  eventName: "",
  details: "",
  time: "",
  venue: "",
  eventDate: "",
  category: "",
  items: [{ description: "", qty: "", price: "", total: "", manualTotal: false }],
  discount: "",
  validUntil: "",
  notes: "",
};

const EMPTY_ITEM: QuotationItemForm = {
  description: "",
  qty: "",
  price: "",
  total: "",
  manualTotal: false,
};

const LEAD_OPTIONS: SearchableSelectOption[] = DUMMY_LEADS.map((l) => ({
  id: l.id,
  name: l.name,
  badge: l.phone,
}));

const SALES_OPTIONS: SearchableSelectOption[] = DUMMY_SALES_MICE.map((s) => ({
  id: s.id,
  name: s.name,
  badge: s.phone,
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

// Field readonly (auto-fill) helper
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <FormItem className="w-full">
      <FormLabel className={LABEL_CLASS}>{label}</FormLabel>
      <FormControl>
        <Input
          value={value}
          readOnly
          placeholder="—"
          aria-readonly="true"
          className={cn("bg-muted text-muted-foreground", !value && "italic")}
        />
      </FormControl>
    </FormItem>
  );
}

export function QuotationDrawer({
  open,
  onOpenChange,
  editQuotation,
}: QuotationDrawerProps) {
  const isEdit = !!editQuotation;
  const [step, setStep] = useState<1 | 2>(1);

  const form = useForm<QuotationFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedSalesId = form.watch("salesId");
  const watchedItems = form.watch("items");
  const watchedDiscount = form.watch("discount");
  const watchedSalesPhone = form.watch("salesPhone");

  const selectedSales =
    DUMMY_SALES_MICE.find((s) => s.id === watchedSalesId) ?? null;

  const subtotal = (watchedItems ?? []).reduce(
    (sum, it) => sum + parseNumericInput(it?.total ?? ""),
    0
  );
  const discountNum = parseNumericInput(watchedDiscount);
  const grandTotal = Math.max(0, subtotal - discountNum);

  // Total baris auto qty * price (kecuali manual override)
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

  // Reset form + step setiap drawer dibuka
  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (editQuotation) {
      const lead =
        DUMMY_LEADS.find((l) => l.name === editQuotation.leadName) ?? null;
      const sales =
        DUMMY_SALES_MICE.find((s) => s.name === editQuotation.salesName) ?? null;
      const items: QuotationItemForm[] =
        editQuotation.items && editQuotation.items.length > 0
          ? editQuotation.items.map((it) => ({
              description: it.description,
              qty: it.qty > 0 ? String(it.qty) : "",
              price: it.price > 0 ? formatNumericDisplay(it.price) : "",
              total: it.total > 0 ? formatNumericDisplay(it.total) : "",
              manualTotal: !!it.manualTotal,
            }))
          : [{ ...EMPTY_ITEM }];
      form.reset({
        leadId: lead?.id ?? "",
        clientName: editQuotation.leadName,
        clientPhone: editQuotation.leadPhone,
        instansi: editQuotation.instansi ?? "",
        salesId: sales?.id ?? "",
        salesName: editQuotation.salesName,
        salesPhone: editQuotation.salesPhone ?? "",
        eventName: editQuotation.eventType,
        details: editQuotation.details ?? "",
        time: editQuotation.time ?? "",
        venue: editQuotation.venue,
        eventDate: editQuotation.eventDate,
        category: editQuotation.category,
        items,
        discount:
          editQuotation.discount > 0
            ? formatNumericDisplay(editQuotation.discount)
            : "",
        validUntil: editQuotation.validUntil,
        notes: editQuotation.notes,
      });
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, editQuotation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill no HP sales dari sales terpilih
  useEffect(() => {
    if (!selectedSales) return;
    form.setValue("salesName", selectedSales.name);
    form.setValue("salesPhone", selectedSales.phone);
  }, [watchedSalesId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleNext() {
    const ok = await form.trigger(["clientName", "salesId"]);
    if (ok) setStep(2);
  }

  function onSubmit(_values: QuotationFormValues) {
    toast.success(
      isEdit ? "Quotation berhasil diperbarui." : "Quotation berhasil disimpan."
    );
    onOpenChange(false);
  }

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Quotation" : "Tambah Quotation"}
      maxWidth="sm:max-w-2xl"
      steps={step}
      totalSteps={2}
      stepperType="short"
      onBack={step === 2 ? () => setStep(1) : undefined}
      backButtonLabel="Kembali ke Informasi"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-2">
          <Form {...form}>
            <form className="space-y-3 pb-2">
              {/* ════════════════ STEP 1 — INFORMASI ════════════════ */}
              <div className={cn(step !== 1 && "hidden", "space-y-3")}>
                {/* Client / Lead — search existing lead ATAU ketik client baru */}
                <FormField
                  control={form.control}
                  name="clientName"
                  rules={{ required: "Client / Lead wajib diisi" }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={LABEL_CLASS}>Client / Lead *</FormLabel>
                      <FormControl>
                        <AutocompleteInput
                          options={LEAD_OPTIONS}
                          value={field.value}
                          onChange={(val) => {
                            // ketik nama manual → client baru, lepas relasi lead
                            field.onChange(val);
                            form.setValue("leadId", "");
                          }}
                          onSelect={(opt) => {
                            const lead = DUMMY_LEADS.find((l) => l.id === opt.id);
                            if (!lead) return;
                            // pilih lead existing → auto-fill semua data terkait
                            form.setValue("leadId", lead.id);
                            field.onChange(lead.name);
                            form.setValue("clientPhone", lead.phone);
                            form.setValue("venue", lead.venue);
                            form.setValue("eventName", lead.eventType);
                            form.setValue("eventDate", lead.eventDate);
                            form.setValue("category", lead.category);
                          }}
                          placeholder="Cari lead atau ketik client baru..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Info Client */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Info Client
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientPhone"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>No. Hp Client</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="No. HP client"
                              inputMode="tel"
                              className="w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
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
                  </div>
                </div>

                {/* Sales MICE */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Sales MICE
                  </p>
                  <FormField
                    control={form.control}
                    name="salesId"
                    rules={{ required: "Sales wajib dipilih" }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Sales MICE *</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={SALES_OPTIONS}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Pilih sales..."
                            searchPlaceholder="Cari sales..."
                            emptyText="Sales tidak ditemukan"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <ReadonlyField label="No. Hp Sales" value={watchedSalesPhone} />
                </div>

                {/* Event */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Detail Event
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="eventName"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Event Name</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={EVENT_OPTIONS}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Pilih / cari event..."
                              searchPlaceholder="Cari event..."
                              emptyText="Event tidak ditemukan"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="venue"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className={LABEL_CLASS}>Venue</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={VENUE_OPTIONS}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Pilih / cari venue..."
                              searchPlaceholder="Cari venue..."
                              emptyText="Venue tidak ditemukan"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-3">
                    {/* Tanggal Event — calendar (full width) */}
                    <FormField
                      control={form.control}
                      name="eventDate"
                      render={({ field }) => (
                        <FormItem className="flex w-full flex-col">
                          <FormLabel className={LABEL_CLASS}>
                            Tanggal Event
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                />
                              }
                            >
                              <CalendarIcon
                                weight="BoldDuotone"
                                className="mr-2 h-4 w-4 shrink-0"
                              />
                              {field.value
                                ? format(new Date(field.value), "d MMMM yyyy", {
                                    locale: localeId,
                                  })
                                : "Pilih tanggal"}
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={
                                  field.value ? new Date(field.value) : undefined
                                }
                                onSelect={(date) =>
                                  field.onChange(
                                    date ? format(date, "yyyy-MM-dd") : ""
                                  )
                                }
                                defaultMonth={
                                  field.value ? new Date(field.value) : undefined
                                }
                                autoFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />

                    {/* Time — single / range picker */}
                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem className="flex w-full flex-col">
                          <FormLabel className={LABEL_CLASS}>Time</FormLabel>
                          <FormControl>
                            <TimeRangePicker
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Pilih waktu (bisa rentang)..."
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className={LABEL_CLASS}>Details</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            placeholder="mis. Venue Only"
                            className="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* ════════════════ STEP 2 — FASILITAS / ITEM ════════════════ */}
              <div className={cn(step !== 2 && "hidden", "space-y-3")}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className={LABEL_CLASS}>Fasilitas / Item</p>
                    <span className="text-xs text-muted-foreground">
                      Total = Qty × Harga (bisa manual)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Akhiri deskripsi dengan &quot;:&quot; untuk jadi judul section
                    (mis. &quot;A. Ballroom Facilities :&quot;). Harga boleh
                    dikosongkan untuk item tanpa biaya.
                  </p>

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
                                      placeholder="Deskripsi fasilitas / judul section"
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
                                        field.onChange(
                                          e.target.value.replace(/\D/g, "")
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

                {/* Ringkasan */}
                <div className="border-t pt-4 space-y-3">
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
                          rows={2}
                          placeholder="Catatan tambahan (opsional)..."
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
        <div className="sticky bottom-0 bg-background z-10">
          <div className="flex py-4 gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-[40%] cursor-pointer text-destructive border-destructive hover:bg-destructive/10"
            >
              Batal
            </Button>
            {step === 1 ? (
              <Button
                onClick={handleNext}
                className="flex-[60%] cursor-pointer"
              >
                Lanjut
                <ArrowRight weight="BoldDuotone" className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={form.handleSubmit(onSubmit)}
                className="flex-[60%] cursor-pointer"
              >
                {isEdit ? "Simpan" : "Tambah"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
