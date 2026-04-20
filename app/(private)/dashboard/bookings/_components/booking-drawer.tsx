"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Plus, X } from "lucide-react";
import { Drawer } from "@/components/shared/drawer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { useCreateBooking } from "@/hooks/use-bookings";
import type { BookingInput } from "@/lib/validations/booking";

interface BookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Option = { id: string; name: string };

interface PackageData {
  id: string;
  packageName: string;
  variants: { id: string; variantName: string; pax: number; price: number }[];
}

interface VendorCategoryData {
  id: string;
  name: string;
  vendors: { id: string; name: string; categoryId: string }[];
}

interface PaymentMethodData {
  id: string;
  bankName: string;
  bankAccountNumber: string;
  bankRecipient: string;
  venueId: string | null;
}

interface BonusRow {
  vendorId: string;
  vendorCategoryId: string;
  vendorName: string;
  description: string;
  qty: number;
}

interface TermRow {
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

const DEFAULT_TERMS: TermRow[] = [
  { name: "Booking Fee", amount: 0, dueDate: "", sortOrder: 0 },
  { name: "DP", amount: 0, dueDate: "", sortOrder: 1 },
  { name: "Pelunasan", amount: 0, dueDate: "", sortOrder: 2 },
];

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function BookingDrawer({ open, onOpenChange }: BookingDrawerProps) {
  const createMut = useCreateBooking();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;

  // Dropdown data
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => fetchJson<Option[]>("/api/customers"), staleTime: 5 * 60_000 });
  const { data: venues = [] } = useQuery({ queryKey: ["venues"], queryFn: () => fetchJson<Option[]>("/api/venues"), staleTime: 5 * 60_000 });
  const { data: sourceOptions = [] } = useQuery({ queryKey: ["source-of-informations"], queryFn: () => fetchJson<Option[]>("/api/source-of-informations"), staleTime: 5 * 60_000 });
  const { data: vendorCategories = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchJson<VendorCategoryData[]>("/api/vendors"), staleTime: 5 * 60_000 });

  // Venue-dependent data
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const { data: packages = [] } = useQuery({ queryKey: ["packages", selectedVenueId], queryFn: () => fetchJson<PackageData[]>(`/api/packages?venueId=${selectedVenueId}`), enabled: !!selectedVenueId, staleTime: 5 * 60_000 });
  const { data: paymentMethods = [] } = useQuery({ queryKey: ["payment-methods"], queryFn: () => fetchJson<PaymentMethodData[]>("/api/payment-methods"), staleTime: 5 * 60_000 });

  const venuePaymentMethods = paymentMethods.filter((pm) => pm.venueId === selectedVenueId);

  // Package → variant
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const variants = selectedPackage?.variants ?? [];

  // Bonuses
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const allVendors = vendorCategories.flatMap((c) => c.vendors.map((v) => ({ ...v, categoryId: c.id, categoryName: c.name })));

  // Terms
  const [terms, setTerms] = useState<TermRow[]>(DEFAULT_TERMS);

  const form = useForm<BookingInput>({
    defaultValues: {
      bookingDate: "",
      customerId: "",
      venueId: "",
      packageId: "",
      packageVariantId: null,
      paymentMethodId: null,
      sourceOfInformationId: null,
      weddingSession: null,
      weddingType: null,
      bonuses: [],
      termOfPayments: [],
    },
  });

  // Reset on open
  useEffect(() => {
    if (open) {
      form.reset();
      setSelectedVenueId("");
      setSelectedPackageId("");
      setBonuses([]);
      setTerms(DEFAULT_TERMS.map((t) => ({ ...t })));
      setCurrentStep(1);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flatten vendors for bonus picker
  const availableVendorsForBonus = allVendors.filter((v) => !bonuses.some((b) => b.vendorId === v.id));

  // Step 1 validation
  const watchedValues = form.watch();
  const isStep1Complete = !!(
    watchedValues.customerId &&
    watchedValues.venueId &&
    watchedValues.packageId &&
    watchedValues.bookingDate
  );

  const handleNext = () => {
    if (currentStep === 1 && !isStep1Complete) {
      toast.error("Lengkapi field yang wajib diisi terlebih dahulu.");
      return;
    }
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  async function onSubmit(values: BookingInput) {
    const payload: BookingInput = {
      ...values,
      bonuses: bonuses.map((b) => ({
        vendorId: b.vendorId,
        vendorCategoryId: b.vendorCategoryId,
        vendorName: b.vendorName,
        description: b.description || null,
        qty: b.qty,
      })),
      termOfPayments: terms.filter((t) => t.dueDate).map((t) => ({
        name: t.name,
        amount: t.amount,
        dueDate: t.dueDate,
        sortOrder: t.sortOrder,
      })),
    };

    const result = await createMut.mutateAsync(payload);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Booking berhasil dibuat.");
    onOpenChange(false);
  }

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Tambah Booking"
      maxWidth="sm:max-w-xl"
      steps={currentStep}
      totalSteps={totalSteps}
    >
      <div className="flex flex-col justify-between h-full">
        <div className="flex-1 overflow-y-auto px-2">
          <Form {...form}>
            <form className="space-y-4">
              {/* ─── Step 1: Data Booking ─── */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  {/* Customer */}
                  <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <SearchableSelect
                        options={customers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih customer..."
                        searchPlaceholder="Cari customer..."
                        emptyText="Tidak ada customer"
                      />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Venue */}
                  <FormField control={form.control} name="venueId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue *</FormLabel>
                      <SearchableSelect
                        options={venues}
                        value={field.value}
                        onChange={(id) => {
                          field.onChange(id);
                          setSelectedVenueId(id);
                          setSelectedPackageId("");
                          form.setValue("packageId", "");
                          form.setValue("packageVariantId", null);
                          form.setValue("paymentMethodId", null);
                        }}
                        placeholder="Pilih venue..."
                        searchPlaceholder="Cari venue..."
                        emptyText="Tidak ada venue"
                      />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Package */}
                  <FormField control={form.control} name="packageId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package *</FormLabel>
                      <SearchableSelect
                        options={packages.map((p) => ({ id: p.id, name: p.packageName }))}
                        value={field.value}
                        onChange={(id) => {
                          field.onChange(id);
                          setSelectedPackageId(id);
                          form.setValue("packageVariantId", null);
                        }}
                        placeholder={selectedVenueId ? "Pilih package..." : "Pilih venue dulu"}
                        disabled={!selectedVenueId}
                        searchPlaceholder="Cari package..."
                        emptyText="Tidak ada package"
                      />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Variant */}
                  {variants.length > 0 && (
                    <FormField control={form.control} name="packageVariantId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variant</FormLabel>
                        <SearchableSelect
                          options={variants.map((v) => ({ id: v.id, name: `${v.variantName} · ${v.pax} pax · Rp ${fmtRp(v.price)}` }))}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Pilih variant..."
                          searchPlaceholder="Cari variant..."
                          emptyText="Tidak ada variant"
                        />
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Booking Date */}
                  <FormField control={form.control} name="bookingDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Booking *</FormLabel>
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(new Date(field.value), "dd MMM yyyy") : "Pilih tanggal"}
                            </Button>
                          }
                        />
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? date.toISOString() : "")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Wedding Type & Session */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="weddingType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wedding Type</FormLabel>
                        <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Pilih type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="wedding">Wedding</SelectItem>
                            <SelectItem value="engagement">Engagement</SelectItem>
                            <SelectItem value="akad">Akad</SelectItem>
                            <SelectItem value="resepsi">Resepsi</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="weddingSession" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Session</FormLabel>
                        <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Pilih session" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                            <SelectItem value="evening">Evening</SelectItem>
                            <SelectItem value="fullday">Full Day</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Source of Information */}
                  <FormField control={form.control} name="sourceOfInformationId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source of Information</FormLabel>
                      <SearchableSelect
                        options={sourceOptions}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Pilih sumber info..."
                        searchPlaceholder="Cari..."
                        emptyText="Tidak ada data"
                      />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Bonuses / Complimentary */}
                  <div className="space-y-2">
                    <FormLabel>Complimentary (Bonus)</FormLabel>
                    <SearchableSelect
                      options={availableVendorsForBonus.map((v) => ({ id: v.id, name: v.name }))}
                      value=""
                      onChange={(vendorId) => {
                        const v = allVendors.find((x) => x.id === vendorId);
                        if (v) setBonuses((prev) => [...prev, { vendorId: v.id, vendorCategoryId: v.categoryId, vendorName: v.name, description: "", qty: 1 }]);
                      }}
                      placeholder="Pilih vendor..."
                      searchPlaceholder="Cari vendor..."
                      emptyText="Tidak ada vendor"
                    />
                    {bonuses.map((b, idx) => (
                      <div key={b.vendorId} className="bg-gray-50 border rounded-md px-3 py-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{b.vendorName}</span>
                          <button type="button" className="text-red-500 hover:text-red-700" onClick={() => setBonuses((prev) => prev.filter((_, i) => i !== idx))}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <Input
                          placeholder="Keterangan bonus..."
                          value={b.description}
                          onChange={(e) => setBonuses((prev) => prev.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                          className="text-xs h-8"
                        />
                      </div>
                    ))}
                    {bonuses.length === 0 && <p className="text-xs text-gray-400 italic text-center py-1">Belum ada complimentary</p>}
                  </div>
                </div>
              )}

              {/* ─── Step 2: Term of Payments ─── */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {/* Payment Method */}
                  <FormField control={form.control} name="paymentMethodId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pembayaran Melalui</FormLabel>
                      <SearchableSelect
                        options={venuePaymentMethods.map((pm) => ({ id: pm.id, name: `${pm.bankName} - ${pm.bankAccountNumber} (${pm.bankRecipient})` }))}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder={selectedVenueId ? "Pilih metode bayar..." : "Pilih venue dulu"}
                        disabled={!selectedVenueId}
                        searchPlaceholder="Cari..."
                        emptyText="Tidak ada payment method"
                      />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Term of Payments */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel>Term of Payments</FormLabel>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTerms((prev) => [...prev, { name: "", amount: 0, dueDate: "", sortOrder: prev.length }])}>
                        <Plus className="h-3 w-3 mr-1" /> Tambah
                      </Button>
                    </div>
                    {terms.map((t, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                          <div>
                            <label className="text-xs text-muted-foreground">Nama</label>
                            <Input value={t.name} onChange={(e) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} className="h-8 text-xs" placeholder="e.g. Booking Fee" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Amount</label>
                            <Input type="number" value={t.amount || ""} onChange={(e) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, amount: Number(e.target.value) } : x))} className="h-8 text-xs" placeholder="0" />
                          </div>
                          <button type="button" className="text-red-500 hover:text-red-700 pb-1" onClick={() => setTerms((prev) => prev.filter((_, i) => i !== idx))}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button variant="outline" size="sm" className={cn("w-full justify-start text-left text-xs h-8", !t.dueDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {t.dueDate ? format(new Date(t.dueDate), "dd MMM yyyy") : "Pilih due date"}
                              </Button>
                            }
                          />
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={t.dueDate ? new Date(t.dueDate) : undefined}
                              onSelect={(date) => setTerms((prev) => prev.map((x, i) => i === idx ? { ...x, dueDate: date ? date.toISOString() : "" } : x))}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </Form>
        </div>

        {/* Footer — step navigation */}
        <div className="bg-white sticky bottom-0 z-10">
          <div className="flex py-4 gap-2">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? () => onOpenChange(false) : handlePrevious}
              disabled={createMut.isPending}
              className={cn(
                "flex-[40%] cursor-pointer",
                currentStep === 1
                  ? "text-red-600 border-red-600 hover:bg-red-50"
                  : "border-black text-black hover:bg-gray-100"
              )}
            >
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={currentStep < totalSteps ? handleNext : form.handleSubmit(onSubmit)}
              disabled={createMut.isPending || (currentStep === 1 && !isStep1Complete)}
              className="flex-[60%] bg-black text-white hover:bg-gray-800 cursor-pointer"
            >
              {currentStep < totalSteps
                ? "Continue"
                : createMut.isPending
                  ? "Menyimpan..."
                  : "Tambah Booking"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
