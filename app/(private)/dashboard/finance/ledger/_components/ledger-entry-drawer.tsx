"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  CardReceive,
  TagPrice,
  AltArrowDown,
  CheckCircle,
  CloseCircle,
  UploadMinimalistic,
  InfoCircle,
  Link as LinkIcon,
  Refresh,
} from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtDate, fmtRp } from "./ledger-format";
import { createCashIn } from "@/actions/ledger";
import type { BookingPickerItem, TermForBooking } from "@/lib/queries/ledger";
import type { PaymentMethodPickerItem } from "@/lib/queries/payment-methods";
import { ledgerEntrySchema, type LedgerEntryFormValues } from "@/lib/validations/ledger";

/* ─── Picker option types ────────────────────────────────────────────────── */

/** Program promo untuk picker drawer (subset dari getPromoPrograms). */
export interface LedgerPromoOption {
  id: string;
  name: string;
  discountType: "PERCENTAGE" | "NOMINAL";
  discountValue: number;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

/** Command forbids an empty value silently swallowing selection, so "no promo"
 *  uses this sentinel and maps back to "" in form state. */
const NO_PROMO = "__none__";

/** Tanggal hari ini dalam format YYYY-MM-DD (lokal, buat default input date). */
function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface LedgerEntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Dipanggil setelah cash-in berhasil dicatat (caller → router.refresh()). */
  onSuccess: () => void;
  bookings: BookingPickerItem[];
  promos: LedgerPromoOption[];
  paymentMethods: PaymentMethodPickerItem[];
}

/* ─── Generic searchable combobox (mirrors LeaderCombobox) ────────────────── */

interface ComboOption {
  value: string;
  label: string;
  /** Optional secondary line, e.g. amount + due date for a termin. */
  hint?: string;
}

function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText = "Tidak ada hasil.",
  id,
  disabled,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText?: string;
  id?: string;
  disabled?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between rounded-xl font-normal"
          >
            {selected ? (
              <span className="truncate">{selected.label}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <AltArrowDown weight="BoldDuotone" className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[calc(100vw-2rem)] p-0 sm:w-96" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.hint ?? ""}`}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <CheckCircle
                    weight="BoldDuotone"
                    className={cn(
                      "mr-2 size-4 shrink-0",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.hint && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{opt.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Multi-select TOP linker ─────────────────────────────────────────────── */

function TerminMultiSelect({
  bookingId,
  termins,
  loading,
  value,
  onChange,
}: {
  bookingId: string;
  termins: TermForBooking[];
  loading: boolean;
  value: string[];
  onChange: (ids: string[]) => void;
}): React.ReactElement {
  function toggle(id: string): void {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  if (!bookingId) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        Pilih client / booking dulu untuk melihat termin.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
        <Refresh weight="BoldDuotone" className="size-4 animate-spin" />
        Memuat termin...
      </div>
    );
  }

  if (termins.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        Booking ini belum punya termin.
      </p>
    );
  }

  const selectedTotal = termins
    .filter((t) => value.includes(t.id))
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Kartu termin — tap buat toggle, bisa pilih banyak. */}
      <div className="flex flex-col gap-2">
        {termins.map((t) => {
          const selected = value.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              aria-pressed={selected}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40",
              )}
            >
              {selected ? (
                <CheckCircle weight="BoldDuotone" className="size-5 shrink-0 text-primary" />
              ) : (
                <span className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                {t.dueDate && (
                  <p className="text-xs text-muted-foreground">Jatuh tempo {fmtDate(t.dueDate)}</p>
                )}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {fmtRp(t.amount)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ringkasan pilihan */}
      {value.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">{value.length} termin dipilih</span>
          <span className="font-semibold tabular-nums text-foreground">{fmtRp(selectedTotal)}</span>
        </div>
      )}
    </div>
  );
}

/* ─── InfoRow helper ─────────────────────────────────────────────────────── */

function InfoRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={
          strong
            ? "font-semibold text-foreground"
            : muted
              ? "text-muted-foreground"
              : "text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/* ─── Field error line ────────────────────────────────────────────────────── */

function FieldError({ message }: { message?: string }): React.ReactElement | null {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/* ─── Required marker (bintang merah) ─────────────────────────────────────── */

function RequiredMark(): React.ReactElement {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden="true">
      *
    </span>
  );
}

/* ─── Allocation builder (§6.4 GROSS greedy) ──────────────────────────────── */

/**
 * Bagi nominal GROSS ke termin terpilih (urut sesuai fetch = sortOrder).
 * Tiap termin diisi penuh sampai budget habis; termin terakhir bisa parsial.
 * Server (validateAllocations) tetap jadi guard final untuk over-allocation.
 */
function buildAllocations(
  gross: number,
  selectedIds: string[],
  termins: TermForBooking[],
): { termId: string; amount: number }[] {
  const selected = termins.filter((t) => selectedIds.includes(t.id));
  const out: { termId: string; amount: number }[] = [];
  let budget = gross;
  for (const t of selected) {
    if (budget <= 0) break;
    const amount = Math.min(t.amount, budget);
    if (amount > 0) {
      out.push({ termId: t.id, amount });
      budget -= amount;
    }
  }
  return out;
}

/* ─── Main component ─────────────────────────────────────────────────────── */

const ACCEPTED_EVIDENCE = "image/jpeg,image/png,image/webp,application/pdf";

export function LedgerEntryDrawer({
  isOpen,
  onClose,
  onSuccess,
  bookings,
  promos,
  paymentMethods,
}: LedgerEntryDrawerProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [termins, setTermins] = useState<TermForBooking[]>([]);
  const [terminsLoading, setTerminsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors },
  } = useForm<LedgerEntryFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      bookingId: "",
      occurredAt: "",
      amount: "",
      paymentMethodId: paymentMethods[0]?.id ?? "",
      promoId: "",
      linkedTerminIds: [],
      paymentEvidenceName: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        bookingId: "",
        occurredAt: todayISO(),
        amount: "",
        paymentMethodId: paymentMethods[0]?.id ?? "",
        promoId: "",
        linkedTerminIds: [],
        paymentEvidenceName: "",
        notes: "",
      });
      setTermins([]);
    } else {
      reset();
      setTermins([]);
    }
  }, [isOpen, reset, paymentMethods]);

  /* ── Watched values ─────────────────────────────────────────────────────── */

  const bookingId = useWatch({ control, name: "bookingId" });
  const amount = useWatch({ control, name: "amount" });
  const promoId = useWatch({ control, name: "promoId" });
  const evidenceName = useWatch({ control, name: "paymentEvidenceName" });

  /* ── Fetch termins saat booking dipilih ──────────────────────────────────── */

  useEffect(() => {
    if (!bookingId) {
      setTermins([]);
      return;
    }
    let cancelled = false;
    setTerminsLoading(true);

    async function run(id: string): Promise<void> {
      try {
        const res = await fetch(`/api/bookings/${id}/terms`);
        if (!res.ok) throw new Error("gagal");
        const data: TermForBooking[] = await res.json();
        if (!cancelled) setTermins(data);
      } catch {
        if (!cancelled) setTermins([]);
      } finally {
        if (!cancelled) setTerminsLoading(false);
      }
    }

    void run(bookingId);
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const bayarNum = Number((amount ?? "").replace(/[^\d]/g, "")) || 0;
  const promo = promos.find((p) => p.id === promoId) ?? null;

  let potongan = 0;
  if (promo) {
    potongan =
      promo.discountType === "PERCENTAGE"
        ? Math.round((bayarNum * promo.discountValue) / 100)
        : promo.discountValue;
  }
  if (potongan > bayarNum) {
    potongan = bayarNum;
  }
  const realCash = bayarNum - potongan;
  const showPreview = promo !== null && bayarNum > 0;

  /* ── Options ──────────────────────────────────────────────────────────── */

  const bookingOptions: ComboOption[] = bookings.map((b) => ({
    value: b.id,
    label: b.clientName,
  }));

  const rekeningOptions: ComboOption[] = paymentMethods.map((r) => ({ value: r.id, label: r.label }));

  const promoOptions: ComboOption[] = [
    { value: NO_PROMO, label: "Tanpa promo" },
    ...promos.map((p) => ({
      value: p.id,
      label: p.name,
      hint: p.discountType === "PERCENTAGE" ? `${p.discountValue}%` : fmtRp(p.discountValue),
    })),
  ];

  /* ── File handlers ─────────────────────────────────────────────────────── */

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    setValue("paymentEvidenceName", file.name, { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeEvidence(): void {
    setValue("paymentEvidenceName", "", { shouldValidate: true });
  }

  /* ── Submit ────────────────────────────────────────────────────────────── */

  async function onValid(data: LedgerEntryFormValues): Promise<void> {
    const gross = Number(data.amount.replace(/[^\d]/g, "")) || 0;
    const selectedPromo = promos.find((p) => p.id === data.promoId) ?? null;

    let discountAmount = 0;
    if (selectedPromo) {
      discountAmount =
        selectedPromo.discountType === "PERCENTAGE"
          ? Math.round((gross * selectedPromo.discountValue) / 100)
          : selectedPromo.discountValue;
      if (discountAmount > gross) discountAmount = gross;
    }

    const allocations = buildAllocations(gross, data.linkedTerminIds ?? [], termins);

    setSubmitting(true);
    const result = await createCashIn({
      bookingId: data.bookingId,
      occurredAt: new Date(data.occurredAt).toISOString(),
      amount: gross,
      paymentMethodId: data.paymentMethodId || null,
      discountProgramId: data.promoId || null,
      discountAmount,
      evidence: data.paymentEvidenceName || null,
      notes: data.notes?.trim() || null,
      allocations,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Transaksi dicatat — kwitansi ${result.data.invoiceNumber}`);
    reset();
    setTermins([]);
    onClose();
    onSuccess();
  }

  function handleClose(): void {
    reset();
    setTermins([]);
    onClose();
  }

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Catat Transaksi" maxWidth="sm:max-w-lg">
      <form onSubmit={(e) => { void handleSubmit(onValid)(e); }} className="flex h-full flex-col">
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-1 pb-4">

          {/* ── Detail Transaksi ──────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CardReceive weight="BoldDuotone" className="size-3.5" />
              Detail Transaksi
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="led-booking">
                Client / Booking
                <RequiredMark />
              </Label>
              <Controller
                name="bookingId"
                control={control}
                render={({ field }) => (
                  <Combobox
                    id="led-booking"
                    options={bookingOptions}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      // reset termin links when client changes
                      setValue("linkedTerminIds", []);
                    }}
                    placeholder="Pilih client / booking"
                    searchPlaceholder="Cari client..."
                    emptyText="Belum ada booking dengan termin."
                  />
                )}
              />
              <FieldError message={errors.bookingId?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="led-date">
                Tanggal Transaksi
                <RequiredMark />
              </Label>
              <Input id="led-date" type="date" className="w-full rounded-xl" {...register("occurredAt")} />
              <FieldError message={errors.occurredAt?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="led-amount">
                Jumlah Dibayar Client (Rp)
                <RequiredMark />
              </Label>
              <Input
                id="led-amount"
                inputMode="numeric"
                placeholder="0"
                className="w-full rounded-xl"
                {...register("amount")}
              />
              <FieldError message={errors.amount?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="led-rekening">
                Via Rekening
                <RequiredMark />
              </Label>
              <Controller
                name="paymentMethodId"
                control={control}
                render={({ field }) => (
                  <Combobox
                    id="led-rekening"
                    options={rekeningOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pilih rekening"
                    searchPlaceholder="Cari rekening..."
                    emptyText="Belum ada rekening."
                  />
                )}
              />
              <FieldError message={errors.paymentMethodId?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>No. Kwitansi</Label>
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5">
                <InfoCircle weight="BoldDuotone" className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Otomatis dibuat saat transaksi disimpan — format{" "}
                  <span className="font-mono text-foreground">0006/KW/GWN/SMSR/07/2026</span>
                </span>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Link Termin (TOP) ─────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <LinkIcon weight="BoldDuotone" className="size-3.5" />
              Link ke Termin (TOP)
              <RequiredMark />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button type="button" className="text-muted-foreground" aria-label="Info termin">
                        <InfoCircle weight="BoldDuotone" className="size-3.5" />
                      </button>
                    }
                  />
                  <TooltipContent>
                    Kaitkan pembayaran ke satu / beberapa termin. Nominal dialokasikan berurutan.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>

            <Controller
              name="linkedTerminIds"
              control={control}
              render={({ field }) => (
                <TerminMultiSelect
                  bookingId={bookingId}
                  termins={termins}
                  loading={terminsLoading}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
            <FieldError message={errors.linkedTerminIds?.message} />
          </section>

          <Separator />

          {/* ── Promo ─────────────────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <TagPrice weight="BoldDuotone" className="size-3.5" />
              Program Promo
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="led-promo">Promo</Label>
              <Controller
                name="promoId"
                control={control}
                render={({ field }) => (
                  <Combobox
                    id="led-promo"
                    options={promoOptions}
                    value={field.value ? field.value : NO_PROMO}
                    onChange={(v) => field.onChange(v === NO_PROMO ? "" : v)}
                    placeholder="Tanpa promo"
                    searchPlaceholder="Cari promo..."
                  />
                )}
              />
            </div>

            {showPreview && (
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <InfoRow label="Dibayar client" value={fmtRp(bayarNum)} />
                <InfoRow label="Potongan promo" value={`–${fmtRp(potongan)}`} muted />
                <Separator className="my-1.5" />
                <InfoRow label="Uang riil masuk" value={fmtRp(realCash)} strong />
              </div>
            )}
          </section>

          <Separator />

          {/* ── Bukti Bayar ───────────────────────────────────────────────── */}
          <section className="flex flex-col gap-1.5">
            <Label>
              Bukti Bayar
              <RequiredMark />
            </Label>
            {evidenceName ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2.5">
                <span className="flex-1 truncate text-sm text-foreground">{evidenceName}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={removeEvidence}
                          className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Hapus bukti bayar"
                        >
                          <CloseCircle weight="BoldDuotone" className="size-5" />
                        </button>
                      }
                    />
                    <TooltipContent>Hapus file</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-muted-foreground/25 p-4 transition-colors hover:border-muted-foreground/50"
              >
                <UploadMinimalistic weight="BoldDuotone" className="size-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Klik untuk upload kwitansi / bukti transfer
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EVIDENCE}
              onChange={handleFileSelect}
              className="hidden"
            />
            <FieldError message={errors.paymentEvidenceName?.message} />
          </section>

          <Separator />

          {/* ── Keterangan (tampil di kwitansi) ───────────────────────────── */}
          <section className="flex flex-col gap-1.5">
            <Label htmlFor="led-notes">
              Keterangan
              <RequiredMark />
            </Label>
            <Textarea
              id="led-notes"
              className="w-full"
              placeholder="Mis. Pembayaran dianggap sah setelah masuk rekening kami."
              {...register("notes")}
            />
            <p className="text-xs text-muted-foreground">
              Teks ini muncul di bagian KETERANGAN pada kwitansi.
            </p>
            <FieldError message={errors.notes?.message} />
          </section>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background pt-4">
          <Button type="button" variant="outline" className="rounded-full" onClick={handleClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" className="rounded-full" disabled={submitting}>
            {submitting ? (
              <Refresh weight="BoldDuotone" className="size-4 animate-spin" />
            ) : (
              <CardReceive weight="BoldDuotone" className="size-4" />
            )}
            Catat Transaksi
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
