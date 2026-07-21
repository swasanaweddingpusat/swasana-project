"use client";

/**
 * CreatePaymentRecordStep — Step 6 Payment untuk create booking wedding.
 *
 * Paradigma: daftar pembayaran + tombol "Tambah Pembayaran" yang expand form ala
 * create-cashflow (tanggal / jumlah / rekening / pilih termin / bukti / keterangan /
 * tampilkan di PO). Tiap pembayaran menutup 1+ termin (alokasi greedy berurutan).
 *
 * Booking belum punya DB id saat create, jadi cash-in TIDAK dibuat live — payment
 * dikumpulin lokal (createPayments di booking-drawer) lalu disimpan sebagai Ledger
 * cash-in saat finalize (finalize.payments). Booking fee (termin pertama) WAJIB
 * tertutup — gate-nya (isStep6Complete) ada di booking-drawer.
 */

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { VoucherProgramSelect } from "@/components/shared/voucher-program-select";
import {
  AddCircle,
  CardReceive,
  CheckCircle,
  CloseCircle,
  DangerTriangle,
  Link as LinkIcon,
  Pen,
  TagPrice,
  TrashBinTrash,
  UploadMinimalistic,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { safeRandomUUID } from "@/lib/uuid";
import { useActivePromos, computePromoDiscount } from "@/hooks/use-active-promos";
import { computeAllocationPreview } from "@/lib/payment-allocation";
import type { CreateTermRow } from "./CreatePaymentStep";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Satu pembayaran (deferred) yang menutup 1+ termin. Disimpan sebagai cash-in
 *  saat finalize; alokasi ke termin dihitung greedy dari termUids. */
export interface CreatePaymentEntry {
  id: string;
  occurredAt: string; // YYYY-MM-DD
  amount: number;
  paymentMethodId: string;
  termUids: string[];
  evidenceFile: File | null;
  notes: string;
  showInPo: boolean;
  /** ID program promo yang dipilih (null = tanpa promo). */
  programId: string | null;
  /** Nominal potongan promo (0 = tanpa promo). Dikirim ke server as discountAmount. */
  discountAmount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRp(n: number): string {
  return n.toLocaleString("id-ID");
}

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Nominal termin yang sudah tertutup oleh payment lain (create = semua lokal). */
function coveredByOthers(termUid: string, payments: CreatePaymentEntry[], terms: CreateTermRow[]): number {
  let covered = 0;
  for (const p of payments) {
    if (!p.termUids.includes(termUid)) continue;
    // Greedy: hitung porsi payment ini yang jatuh ke termUid.
    let budget = p.amount;
    for (const uid of p.termUids) {
      const t = terms.find((x) => x.uid === uid);
      if (!t) continue;
      const take = Math.min(t.amount, budget);
      if (uid === termUid) { covered += take; break; }
      budget -= take;
      if (budget <= 0) break;
    }
  }
  return covered;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CreatePaymentRecordStepProps {
  terms: CreateTermRow[];
  payments: CreatePaymentEntry[];
  setPayments: (updater: CreatePaymentEntry[] | ((prev: CreatePaymentEntry[]) => CreatePaymentEntry[])) => void;
  /** Booking default rekening (form RHF paymentMethodId) — jadi default form. */
  defaultPaymentMethodId: string;
  /** True once the booking fee (first term) is covered by a payment. Drives banner. */
  bookingFeeRecorded: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreatePaymentRecordStep({
  terms,
  payments,
  setPayments,
  defaultPaymentMethodId,
  bookingFeeRecorded,
}: CreatePaymentRecordStepProps): React.ReactElement {
  const promos = useActivePromos();

  const [formOpen, setFormOpen] = useState(false);
  /** null = mode tambah; berisi entry id = mode edit pembayaran lokal. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(defaultPaymentMethodId);
  const [selectedTermUids, setSelectedTermUids] = useState<string[]>([]);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [showInPo, setShowInPo] = useState(false);
  const [programId, setProgramId] = useState<string | null>(null);

  const amountNum = Number(amount.replace(/[^\d]/g, "")) || 0;

  const promoSelected = promos.find((p) => p.id === programId) ?? null;

  // Saat edit, entry yang sedang diubah TIDAK boleh menghitung dirinya sendiri
  // sebagai "sudah tertutup" — kalau tidak, terminnya tampil lunas oleh dirinya.
  const otherPayments = editingId ? payments.filter((p) => p.id !== editingId) : payments;

  // Preview alokasi greedy — urut sesuai pilihan user (sama dengan finalize).
  const remainingOf = (uid: string): number => {
    const t = terms.find((x) => x.uid === uid);
    if (!t) return 0;
    return Math.max(0, t.amount - coveredByOthers(uid, otherPayments, terms));
  };
  const orderedSelected = selectedTermUids
    .map((uid) => ({ id: uid, remaining: remainingOf(uid) }));
  const alloc = computeAllocationPreview(orderedSelected, amountNum);

  // Nominal habis teralokasi penuh ke termin terpilih (tidak ada sisa `lebih`).
  // Saat habis, termin lain yang belum terpilih tidak bisa ditambah — user harus
  // ubah nominal dulu. Kalau lebih bayar (`lebih > 0`) baru bebas kaitkan termin lain.
  const budgetConsumed = amountNum > 0 && alloc.lebih === 0;

  function resetForm(): void {
    setEditingId(null);
    setOccurredAt(todayISO());
    setAmount("");
    setPaymentMethodId(defaultPaymentMethodId);
    setSelectedTermUids([]);
    setEvidenceFile(null);
    setNotes("");
    setShowInPo(false);
    setProgramId(null);
  }

  /** Buka form dalam mode edit dengan data entry lokal di-prefill. */
  function openEdit(p: CreatePaymentEntry): void {
    setEditingId(p.id);
    setOccurredAt(p.occurredAt);
    setAmount(String(p.amount));
    setPaymentMethodId(p.paymentMethodId);
    setSelectedTermUids(p.termUids);
    setEvidenceFile(p.evidenceFile);
    setNotes(p.notes);
    setShowInPo(p.showInPo);
    setProgramId(p.programId);
    setFormOpen(true);
  }

  function toggleTermSelection(uid: string): void {
    setSelectedTermUids((prev) =>
      prev.includes(uid) ? prev.filter((v) => v !== uid) : [...prev, uid],
    );
  }

  function handleAddPayment(): void {
    const discountAmount = computePromoDiscount(amountNum, promoSelected);
    if (editingId) {
      // Edit in-place — pertahankan id & urutan entry.
      setPayments((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? {
                ...p,
                occurredAt,
                amount: amountNum,
                paymentMethodId,
                termUids: selectedTermUids,
                evidenceFile,
                notes: notes.trim(),
                showInPo,
                programId,
                discountAmount,
              }
            : p,
        ),
      );
    } else {
      setPayments((prev) => [
        ...prev,
        {
          id: safeRandomUUID(),
          occurredAt,
          amount: amountNum,
          paymentMethodId,
          termUids: selectedTermUids,
          evidenceFile,
          notes: notes.trim(),
          showInPo,
          programId,
          discountAmount,
        },
      ]);
    }
    resetForm();
    setFormOpen(false);
  }

  function removePayment(id: string): void {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  // Submit boleh kalau nominal PAS atau LEBIH dari total termin terpilih.
  // Kurang bayar (alloc.kurang > 0) tidak boleh — user mesti kurangi termin
  // atau naikkan nominal dulu. Bukti bayar WAJIB dilampirkan.
  const canSubmitForm =
    amountNum > 0 &&
    !!paymentMethodId &&
    selectedTermUids.length > 0 &&
    alloc.kurang === 0 &&
    !!evidenceFile;
  const termName = (uid: string): string => terms.find((t) => t.uid === uid)?.name ?? "Termin";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4">
        {/* ── Info banner ── */}
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          Catat pembayaran client dan kaitkan ke termin. Pembayaran tersimpan saat booking
          dibuat; verifikasinya di <span className="font-medium text-foreground">Cashbook</span>.
          Booking fee wajib dicatat sebelum tanda tangan.
        </p>

        {/* ── Gate banner ── */}
        {!bookingFeeRecorded && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
            <DangerTriangle weight="BoldDuotone" className="mt-0.5 size-4 shrink-0" />
            <span>Catat pembayaran booking fee dulu sebelum lanjut ke tanda tangan.</span>
          </div>
        )}

        {/* ── Header + Tambah ── */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Pembayaran</p>
          {!formOpen && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
              onClick={() => { resetForm(); setFormOpen(true); }}
            >
              <AddCircle weight="BoldDuotone" className="size-4" />
              Tambah Pembayaran
            </Button>
          )}
        </div>

        {/* ── Add-payment form (inline expand) ── */}
        {formOpen && (
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CardReceive weight="BoldDuotone" className="size-3.5" />
              {editingId ? "Edit Pembayaran" : "Pembayaran Baru"}
            </p>

            {/* Tanggal */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tanggal Pembayaran</Label>
              <input
                type="date"
                value={occurredAt}
                max={todayISO()}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Jumlah */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Jumlah Dibayar (Rp)</Label>
              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  inputMode="numeric"
                  value={amountNum ? amountNum.toLocaleString("id-ID") : ""}
                  placeholder="0"
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-9 border-0 bg-transparent px-0 tabular-nums shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            {/* Via Rekening */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Via Rekening</Label>
              <BankAccountSelect
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                placeholder="Pilih rekening penerima..."
                crossVenue
              />
            </div>

            {/* Program (voucher potong tagihan) — selalu tampil */}
            <div className="space-y-1">
              <Label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <TagPrice weight="BoldDuotone" className="size-3.5" />
                Program <span className="text-muted-foreground/70">(opsional)</span>
              </Label>
              <VoucherProgramSelect
                programs={promos}
                value={programId}
                onChange={setProgramId}
                amount={amountNum}
              />
              {promos.length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada program aktif.</p>
              )}
            </div>

            {/* Pilih Termin */}
            <div className="space-y-1.5">
              <Label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <LinkIcon weight="BoldDuotone" className="size-3.5" />
                Kaitkan ke Termin
              </Label>
              <div className="flex flex-col gap-1.5">
                {terms.map((t) => {
                  const selected = selectedTermUids.includes(t.uid);
                  const covered = coveredByOthers(t.uid, otherPayments, terms);
                  const remaining = Math.max(0, t.amount - covered);
                  const lunas = remaining <= 0;
                  const allocated = selected ? (alloc.perTerm.get(t.uid) ?? 0) : 0;
                  const partial = selected && allocated > 0 && allocated < remaining;
                  const unfunded = selected && allocated <= 0;
                  // Nominal sudah habis → termin lain yang belum dipilih dikunci
                  // (kecuali sudah terpilih, biar tetap bisa di-uncheck).
                  const budgetLocked = budgetConsumed && !selected;
                  const disabled = lunas || budgetLocked;
                  return (
                    <button
                      key={t.uid}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleTermSelection(t.uid)}
                      aria-pressed={selected}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                        disabled
                          ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                          : selected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40",
                      )}
                    >
                      {selected ? (
                        <CheckCircle weight="BoldDuotone" className="size-4 shrink-0 text-primary" />
                      ) : (
                        <span className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                        <span className="truncate">{t.name || "Termin"}</span>
                        {lunas && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Tercatat</span>}
                        {budgetLocked && !lunas && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">Nominal habis</span>
                        )}
                        {partial && (
                          <span className="mt-0.5 block text-[11px] font-normal text-[var(--brand-gold)]">
                            Dialokasi Rp{fmtRp(allocated)} · sisa Rp{fmtRp(remaining - allocated)}
                          </span>
                        )}
                        {unfunded && (
                          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                            Belum teralokasi
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        Rp{fmtRp(remaining)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bukti bayar (wajib) */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Bukti Bayar <span className="text-destructive">*</span>
              </Label>
              {evidenceFile ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <UploadMinimalistic weight="BoldDuotone" className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs">{evidenceFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setEvidenceFile(null)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Hapus bukti bayar"
                  >
                    <CloseCircle weight="BoldDuotone" className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                  <UploadMinimalistic weight="BoldDuotone" className="size-3.5 shrink-0" />
                  Upload bukti (JPG/PNG/PDF, maks 10MB)
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              {!evidenceFile && (
                <p className="text-[11px] text-destructive">Bukti bayar wajib dilampirkan.</p>
              )}
            </div>

            {/* Keterangan */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Keterangan (opsional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan pembayaran..."
                maxLength={500}
                rows={2}
                className="resize-none rounded-xl text-xs"
              />
            </div>

            {/* Tampilkan di PO */}
            <div className="flex items-center gap-2">
              <Switch id="create-add-show-in-po" checked={showInPo} onCheckedChange={setShowInPo} />
              <Label htmlFor="create-add-show-in-po" className="cursor-pointer text-xs text-muted-foreground">
                Tampilkan di PO
              </Label>
            </div>

            {/* Ringkasan alokasi — Client Bayar / Total Termin / Selisih */}
            {selectedTermUids.length > 0 && amountNum > 0 && (
              <div className="grid grid-cols-3 gap-x-2 rounded-xl bg-muted px-3 py-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">Client Bayar</span>
                  <span className="truncate text-xs font-semibold tabular-nums text-foreground">
                    Rp{fmtRp(amountNum)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">Total Termin</span>
                  <span className="truncate text-xs font-semibold tabular-nums text-foreground">
                    Rp{fmtRp(alloc.totalRemaining)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">Selisih</span>
                  <span
                    className={cn(
                      "truncate text-xs font-semibold tabular-nums",
                      alloc.kurang > 0 && "text-destructive",
                      alloc.lebih > 0 && "text-[var(--brand-gold)]",
                      alloc.kurang === 0 && alloc.lebih === 0 && "text-primary",
                    )}
                  >
                    {alloc.kurang > 0 && `− Rp${fmtRp(alloc.kurang)} (Kurang)`}
                    {alloc.lebih > 0 && `+ Rp${fmtRp(alloc.lebih)} (Lebih)`}
                    {alloc.kurang === 0 && alloc.lebih === 0 && "Sesuai"}
                  </span>
                </div>
              </div>
            )}

            {/* Feedback selisih — kurang (blocking) / lebih (saldo, boleh) */}
            {selectedTermUids.length > 0 && amountNum > 0 && (alloc.kurang > 0 || alloc.lebih > 0) && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-xl p-2.5 text-xs",
                  alloc.kurang > 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-[var(--brand-gold)]/10 text-foreground",
                )}
              >
                <DangerTriangle
                  weight="BoldDuotone"
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    alloc.kurang > 0 ? "text-destructive" : "text-[var(--brand-gold)]",
                  )}
                />
                {alloc.kurang > 0 ? (
                  <span>
                    Kurang <span className="font-semibold tabular-nums">Rp{fmtRp(alloc.kurang)}</span> — nominal belum menutup termin terpilih. Kurangi termin atau naikkan nominal agar bisa disimpan.
                  </span>
                ) : (
                  <span>
                    Lebih <span className="font-semibold tabular-nums">Rp{fmtRp(alloc.lebih)}</span> — kelebihan akan tercatat sebagai saldo lebih bayar booking.
                  </span>
                )}
              </div>
            )}

            {/* Form actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => { resetForm(); setFormOpen(false); }}
              >
                Batal
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-full"
                onClick={handleAddPayment}
                disabled={!canSubmitForm}
              >
                {editingId ? "Simpan Perubahan" : "Simpan Pembayaran"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Daftar pembayaran ── */}
        {payments.length === 0 && !formOpen ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <CardReceive weight="BoldDuotone" className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Belum ada pembayaran.</p>
            <p className="text-xs text-muted-foreground">Klik &quot;Tambah Pembayaran&quot; untuk mencatat booking fee.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {payments.map((p) => (
              <div key={p.id} className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums text-foreground">Rp{fmtRp(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.occurredAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="Edit pembayaran"
                    >
                      <Pen weight="BoldDuotone" className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePayment(p.id)}
                      className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                      aria-label="Hapus pembayaran"
                    >
                      <TrashBinTrash weight="BoldDuotone" className="size-4" />
                    </button>
                  </div>
                </div>
                {p.termUids.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.termUids.map((uid) => (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] text-foreground"
                      >
                        {termName(uid)}
                      </span>
                    ))}
                  </div>
                )}
                {p.programId && (
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-gold)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-gold)]">
                      <TagPrice weight="BoldDuotone" className="size-3" />
                      {promos.find((pr) => pr.id === p.programId)?.name ?? "Promo"}
                      {p.discountAmount > 0 && (
                        <> · −Rp{p.discountAmount.toLocaleString("id-ID")}</>
                      )}
                    </span>
                  </div>
                )}
                {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                {(p.evidenceFile || p.showInPo) && (
                  <div className="flex items-center gap-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                    {p.evidenceFile && (
                      <span className="inline-flex items-center gap-1">
                        <UploadMinimalistic weight="BoldDuotone" className="size-3" />
                        {p.evidenceFile.name}
                      </span>
                    )}
                    {p.showInPo && <span>Tampil di PO</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
