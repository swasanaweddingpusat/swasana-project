"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AddCircle,
  TrashBinTrash,
  UploadMinimalistic,
  CloseCircle,
  CheckCircle,
  InfoCircle,
  MoneyBag,
} from "@solar-icons/react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useBookingFinanceDetail } from "@/hooks/use-booking-finance-detail";
import { createCashIn, setLedgerShowInPo } from "@/actions/ledger";
import { safeRandomUUID } from "@/lib/uuid";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentRow {
  uid: string;
  occurredAt: string;
  amount: number;
  paymentMethodId: string;
  evidenceFile: File | null;
  notes: string;
  /** Real termId from DB (NOT sortOrder). */
  linkedTermIds: string[];
  promoId: string;
  /** Tampilkan pembayaran ini di Summary Payment PO PDF. Default false. */
  showInPo: boolean;
}

interface PromoOption {
  id: string;
  name: string;
  discountType: "PERCENTAGE" | "NOMINAL";
  discountValue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISODate(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fmtRp(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function makeEmptyRow(): PaymentRow {
  return {
    uid: safeRandomUUID(),
    occurredAt: todayISODate(),
    amount: 0,
    paymentMethodId: "",
    evidenceFile: null,
    notes: "",
    linkedTermIds: [],
    promoId: "",
    showInPo: false,
  };
}

function isRowEmpty(r: PaymentRow): boolean {
  return (
    r.amount === 0 &&
    !r.paymentMethodId &&
    !r.evidenceFile &&
    r.linkedTermIds.length === 0 &&
    !r.notes.trim() &&
    !r.promoId
  );
}

function isRowFilled(r: PaymentRow): boolean {
  return r.amount > 0 && !!r.paymentMethodId && !!r.evidenceFile && r.linkedTermIds.length > 0;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json() as Promise<T>;
}

// ─── AckStatusBadge ───────────────────────────────────────────────────────────

function AckBadge({ status }: { status: string }) {
  if (status === "acknowledged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        <CheckCircle weight="BoldDuotone" className="h-3 w-3" />
        Terverifikasi
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
        Ditolak
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Menunggu verifikasi
    </span>
  );
}

// ─── EditPaymentStep ──────────────────────────────────────────────────────────

interface Props {
  bookingId: string;
}

export function EditPaymentStep({ bookingId }: Props) {
  const qc = useQueryClient();
  const { data: financeDetail, isLoading } = useBookingFinanceDetail(bookingId);

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null); // uid of row being submitted
  const [togglingPo, setTogglingPo] = useState<string | null>(null); // ledger id being toggled

  // Promo options
  const { data: promosResult } = useQuery({
    queryKey: ["promos", "active"],
    queryFn: () => fetchJson<{ items: PromoOption[] }>("/api/promos?activeOnly=true"),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const promoOptions = promosResult?.items ?? [];

  // Reset rows when bookingId changes
  useEffect(() => {
    setRows([]);
  }, [bookingId]);

  const terms = financeDetail?.terms ?? [];
  const cashIns = financeDetail?.cashIns ?? [];

  // ── Row mutation helpers ──
  function updateRow(uid: string, patch: Partial<PaymentRow>) {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }
  function removeRow(uid: string) {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  }
  function toggleTermLink(rowUid: string, termId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.uid !== rowUid) return r;
        const has = r.linkedTermIds.includes(termId);
        return {
          ...r,
          linkedTermIds: has
            ? r.linkedTermIds.filter((id) => id !== termId)
            : [...r.linkedTermIds, termId],
        };
      }),
    );
  }

  // ── Toggle showInPo on existing cash-in ──
  async function handleTogglePo(ledgerId: string, value: boolean) {
    setTogglingPo(ledgerId);
    try {
      const res = await setLedgerShowInPo({ ledgerId, value });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
    } catch (e) {
      console.error("[EditPaymentStep] handleTogglePo", e);
      toast.error("Gagal mengubah tampilan PO.");
    } finally {
      setTogglingPo(null);
    }
  }

  // ── Submit a single row ──
  async function handleSubmitRow(row: PaymentRow) {
    if (!isRowFilled(row)) {
      toast.error("Lengkapi semua field wajib: nominal, rekening, bukti bayar, dan termin.");
      return;
    }

    setSubmitting(row.uid);
    try {
      // 1. Upload evidence
      const fd = new FormData();
      fd.append("file", row.evidenceFile!);
      const uploadRes = await fetch("/api/upload/booking-fee-evidence", {
        method: "POST",
        body: fd,
      });
      if (!uploadRes.ok) {
        const body = (await uploadRes.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Gagal upload bukti bayar.");
        return;
      }
      const { key: evidenceKey } = (await uploadRes.json()) as { key: string };

      // 2. Compute discount
      const promo = promoOptions.find((p) => p.id === row.promoId) ?? null;
      let discountAmount = 0;
      if (promo) {
        discountAmount =
          promo.discountType === "PERCENTAGE"
            ? Math.round((row.amount * promo.discountValue) / 100)
            : promo.discountValue;
        if (discountAmount > row.amount) discountAmount = row.amount;
      }

      // 3. Build greedy allocations against real termIds
      const linked = terms.filter((t) => row.linkedTermIds.includes(t.id));
      let budget = row.amount;
      const allocations: { termId: string; amount: number }[] = [];
      for (const t of linked) {
        if (budget <= 0) break;
        const sisa = t.amount - t.effectivePaid;
        const amt = Math.min(Math.max(sisa, 0), budget);
        if (amt > 0) {
          allocations.push({ termId: t.id, amount: amt });
          budget -= amt;
        }
      }

      // 4. createCashIn
      const result = await createCashIn({
        bookingId,
        occurredAt: row.occurredAt,
        amount: row.amount,
        paymentMethodId: row.paymentMethodId || null,
        discountProgramId: row.promoId || null,
        discountAmount,
        evidence: evidenceKey,
        notes: row.notes.trim() || null,
        allocations,
        showInPo: row.showInPo,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Pembayaran berhasil dicatat — ${result.data.invoiceNumber}`);
      // Invalidate finance detail + ledger
      await qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
      await qc.invalidateQueries({ queryKey: ["ledger"] });
      // Remove the submitted row from local state
      removeRow(row.uid);
    } catch (e) {
      console.error("[EditPaymentStep] handleSubmitRow", e);
      toast.error("Gagal mencatat pembayaran.");
    } finally {
      setSubmitting(null);
    }
  }

  // ── Render ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Memuat data keuangan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* ── Guard: missing terms ── */}
      {terms.length === 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
          <InfoCircle weight="BoldDuotone" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Belum ada Term of Payment di booking ini.{" "}
            <span className="font-medium text-foreground">Isi Step 5 (TOP) dulu</span>{" "}
            sebelum mencatat pembayaran — alokasi ke termin wajib ada.
          </p>
        </div>
      )}

      {/* ── Section 1: Input pembayaran baru ── */}
      <PermissionGate
        module="booking"
        action="edit"
        fallback={
          <div className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
            <InfoCircle weight="BoldDuotone" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Anda tidak memiliki izin untuk mencatat pembayaran baru.
            </p>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Input Pembayaran Baru</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-dashed text-muted-foreground"
              onClick={() => setRows((prev) => [...prev, makeEmptyRow()])}
              disabled={submitting !== null || rows.some((r) => !isRowFilled(r))}
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah
            </Button>
          </div>

          {rows.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              Belum ada pembayaran baru. Klik &ldquo;Tambah&rdquo; untuk mencatat.
            </p>
          )}

          {rows.map((row, idx) => {
            const promo = promoOptions.find((p) => p.id === row.promoId) ?? null;
            let potongan = 0;
            if (promo && row.amount > 0) {
              potongan =
                promo.discountType === "PERCENTAGE"
                  ? Math.round((row.amount * promo.discountValue) / 100)
                  : promo.discountValue;
              if (potongan > row.amount) potongan = row.amount;
            }
            const realCash = row.amount - potongan;
            const linkedTotal = terms
              .filter((t) => row.linkedTermIds.includes(t.id))
              .reduce((sum, t) => sum + t.amount, 0);
            const isThisSubmitting = submitting === row.uid;
            const canSubmit = isRowFilled(row) && !isThisSubmitting && submitting === null;

            return (
              <div
                key={row.uid}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MoneyBag weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Pembayaran #{idx + 1}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.uid)}
                    aria-label="Hapus pembayaran"
                    className="shrink-0 rounded-lg p-1 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                  </button>
                </div>

                {/* Tanggal + Nominal */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Tanggal <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={row.occurredAt}
                      onChange={(e) => updateRow(row.uid, { occurredAt: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Nominal (Rp) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={row.amount ? fmtRp(row.amount) : ""}
                      onChange={(e) => {
                        const num = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                        updateRow(row.uid, { amount: num });
                      }}
                      placeholder="0"
                      inputMode="numeric"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Via Rekening */}
                <div>
                  <Label className="mb-1 block text-sm font-medium text-foreground">
                    Via Rekening <span className="text-destructive">*</span>
                  </Label>
                  <BankAccountSelect
                    value={row.paymentMethodId}
                    onChange={(v) => updateRow(row.uid, { paymentMethodId: v })}
                    placeholder="Pilih rekening"
                    crossVenue
                    disableAdd
                  />
                </div>

                {/* Bukti Bayar */}
                <div>
                  <Label className="mb-1 block text-sm font-medium text-foreground">
                    Bukti Bayar <span className="text-destructive">*</span>
                  </Label>
                  {row.evidenceFile ? (
                    <div className="relative flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs">
                      <span className="flex-1 truncate text-foreground">{row.evidenceFile.name}</span>
                      <button
                        type="button"
                        onClick={() => updateRow(row.uid, { evidenceFile: null })}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Hapus bukti bayar"
                      >
                        <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40">
                      <UploadMinimalistic weight="BoldDuotone" className="h-4 w-4 shrink-0" />
                      <span>Upload bukti transfer / kwitansi</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) updateRow(row.uid, { evidenceFile: f });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Link ke TOP (real termIds from DB) */}
                <div>
                  <Label className="mb-1 block text-sm font-medium text-foreground">
                    Link ke Termin (TOP) <span className="text-destructive">*</span>
                  </Label>
                  {terms.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                      Belum ada termin di booking ini. Isi Step 5 (TOP) dulu.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {terms.map((t) => {
                        const selected = row.linkedTermIds.includes(t.id);
                        const sisa = Math.max(t.amount - t.effectivePaid, 0);
                        const fullyLinked = sisa === 0 && t.amount > 0;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => { if (!fullyLinked) toggleTermLink(row.uid, t.id); }}
                            aria-pressed={selected}
                            disabled={fullyLinked}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                              fullyLinked
                                ? "cursor-not-allowed border-border bg-muted/20 opacity-60"
                                : selected
                                ? "border-primary bg-primary/5"
                                : "border-border bg-muted/20 hover:border-primary/40 hover:bg-secondary/40",
                            )}
                          >
                            {fullyLinked ? (
                              <span className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/20 bg-muted" />
                            ) : selected ? (
                              <CheckCircle weight="BoldDuotone" className="size-5 shrink-0 text-primary" />
                            ) : (
                              <span className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {t.name || "Term tanpa nama"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Tagihan: Rp{fmtRp(t.amount)}
                                {!fullyLinked && t.effectivePaid > 0 && (
                                  <> · Sisa: Rp{fmtRp(sisa)}</>
                                )}
                              </p>
                            </div>
                            {fullyLinked ? (
                              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                Lunas
                              </span>
                            ) : (
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                                Rp{fmtRp(t.amount)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {row.linkedTermIds.length > 0 && (
                        <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs">
                          <span className="text-muted-foreground">
                            {row.linkedTermIds.length} termin dipilih
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            Rp{fmtRp(linkedTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Promo */}
                {promoOptions.length > 0 && (
                  <div>
                    <Label className="mb-1 block text-sm font-medium text-foreground">
                      Promo
                    </Label>
                    <Select
                      value={row.promoId || "__none__"}
                      onValueChange={(v) =>
                        updateRow(row.uid, { promoId: v === "__none__" ? "" : v })
                      }
                    >
                      <SelectTrigger className="w-full bg-background">
                        <span className="text-sm">{promo ? promo.name : "Tanpa promo"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Tanpa promo</SelectItem>
                        {promoOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} (
                            {p.discountType === "PERCENTAGE"
                              ? `${p.discountValue}%`
                              : `Rp${fmtRp(p.discountValue)}`}
                            )
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {promo && row.amount > 0 && (
                      <div className="mt-2 space-y-1 rounded-xl border border-border bg-secondary/30 p-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Dibayar client</span>
                          <span className="font-medium text-foreground">Rp{fmtRp(row.amount)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Potongan promo</span>
                          <span className="font-medium text-destructive">-Rp{fmtRp(potongan)}</span>
                        </div>
                        <div className="mt-1 flex justify-between border-t border-border pt-1 text-xs">
                          <span className="font-semibold text-foreground">Uang riil masuk</span>
                          <span className="font-semibold text-foreground">Rp{fmtRp(realCash)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Keterangan */}
                <div>
                  <Label className="mb-1 block text-sm font-medium text-foreground">
                    Keterangan
                  </Label>
                  <Textarea
                    value={row.notes}
                    onChange={(e) => updateRow(row.uid, { notes: e.target.value })}
                    placeholder="Catatan pembayaran (opsional)"
                    maxLength={500}
                  />
                </div>

                {/* Tampilkan di PO */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                  <div className="min-w-0 pr-3">
                    <p
                      id={`po-label-new-${row.uid}`}
                      className="text-sm font-medium text-foreground"
                    >
                      Tampilkan di PO
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pembayaran ini muncul di Summary Payment pada dokumen PO.
                    </p>
                  </div>
                  <Switch
                    checked={row.showInPo}
                    onCheckedChange={(v) => updateRow(row.uid, { showInPo: v })}
                    aria-labelledby={`po-label-new-${row.uid}`}
                  />
                </div>

                {/* Submit row */}
                <Button
                  type="button"
                  onClick={() => { void handleSubmitRow(row); }}
                  disabled={!canSubmit}
                  className={cn(
                    "w-full rounded-full",
                    !canSubmit && "cursor-not-allowed opacity-50",
                  )}
                >
                  {isThisSubmitting ? "Menyimpan..." : "Simpan Pembayaran Ini"}
                </Button>

                {!isRowEmpty(row) && !isRowFilled(row) && (
                  <p className="text-center text-xs text-muted-foreground">
                    Lengkapi nominal, rekening, bukti bayar, dan minimal 1 termin untuk menyimpan.
                  </p>
                )}
              </div>
            );
          })}

        </div>
      </PermissionGate>

      {/* ── Section 2: Riwayat pembayaran (read-only) ── */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Riwayat Pembayaran</p>

        {cashIns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada pembayaran tercatat untuk booking ini.
          </div>
        ) : (
          <div className="space-y-3">
            {cashIns.map((ci) => (
              <div
                key={ci.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ci.occurredAt), "d MMMM yyyy", { locale: localeId })}
                      {ci.linkedTermNames.length > 0 && (
                        <>
                          {" · "}
                          <span className="font-medium text-foreground">
                            Alokasi ke: {ci.linkedTermNames.join(", ")}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="font-heading text-lg font-bold text-foreground tabular-nums">
                      Rp{fmtRp(ci.amount)}
                    </p>
                    {ci.invoiceNumber && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        No. Kwitansi: {ci.invoiceNumber}
                      </p>
                    )}
                    {ci.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{ci.notes}</p>
                    )}
                  </div>
                  <AckBadge status={ci.ackStatus} />
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span
                    id={`po-label-${ci.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Tampilkan di PO
                  </span>
                  <Switch
                    checked={ci.showInPo}
                    disabled={togglingPo === ci.id}
                    onCheckedChange={(v) => { void handleTogglePo(ci.id, v); }}
                    aria-labelledby={`po-label-${ci.id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
