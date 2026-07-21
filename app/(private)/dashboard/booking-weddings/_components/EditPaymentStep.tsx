"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { VoucherProgramSelect } from "@/components/shared/voucher-program-select";
import {
  AddCircle,
  CheckCircle,
  CloseCircle,
  DangerTriangle,
  UploadMinimalistic,
  CardReceive,
  Link as LinkIcon,
  Pen,
  TagPrice,
  TrashBinTrash,
} from "@solar-icons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActivePromos, computePromoDiscount } from "@/hooks/use-active-promos";
import { computeAllocationPreview } from "@/lib/payment-allocation";
import { cn } from "@/lib/utils";
import { createCashIn, deleteCashIn, updateCashIn } from "@/actions/ledger";
import { useQueryClient } from "@tanstack/react-query";
import { getBookingFinanceDetailClient } from "@/services/booking-finance-service";
import { useBookingFinanceDetail } from "@/hooks/use-booking-finance-detail";
import { useToggleCashInShowInPo } from "@/hooks/use-ledger";
import { fmtRp, type FinanceTerm } from "./edit-finance-shared";
import type { BookingCashIn } from "@/lib/queries/ledger";

/* ─── Payment Content (mini-ledger, Fase 5) ───────────────────────────────────
 * Step 6 (edit flow): daftar pembayaran + tombol "Tambah Pembayaran" yang expand
 * form ala create-cashflow (tanggal / jumlah / rekening / pilih termin / bukti /
 * keterangan / tampilkan di PO). Tiap pembayaran = satu cash-in yang menutup 1+
 * termin (alokasi greedy berurutan). Booking fee (termin pertama) WAJIB tertutup
 * sebelum lanjut ke tanda tangan.
 * ─────────────────────────────────────────────────────────────────────────── */

interface PaymentContentProps {
  bookingId: string;
  terms: FinanceTerm[];
  cashIns: BookingCashIn[];
  saveLabel?: string;
  onPrevious?: () => void;
  /** Continue flow: called after a successful save to advance to the next step. */
  onSaved?: () => void;
}

/** Alokasi GROSS greedy ke termin terpilih (urut = sortOrder fetch). Tiap termin
 *  diisi penuh sampai budget habis; termin terakhir bisa parsial. Server tetap
 *  jadi guard final untuk over-allocation. */
function buildAllocations(
  gross: number,
  selectedIds: string[],
  terms: FinanceTerm[],
): { termId: string; amount: number }[] {
  const selected = terms.filter((t) => selectedIds.includes(t.id));
  const out: { termId: string; amount: number }[] = [];
  let budget = gross;
  for (const t of selected) {
    if (budget <= 0) break;
    const remaining = Math.max(0, t.amount - t.paid);
    const amount = Math.min(remaining, budget);
    if (amount > 0) {
      out.push({ termId: t.id, amount });
      budget -= amount;
    }
  }
  return out;
}

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function PaymentContent({
  bookingId,
  terms,
  cashIns,
  saveLabel = "Simpan",
  onPrevious,
  onSaved,
}: PaymentContentProps): React.ReactElement {
  const qc = useQueryClient();
  const toggleShowInPoMutation = useToggleCashInShowInPo(bookingId);
  const promos = useActivePromos();

  // ── Add/edit-payment form state ───────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  /** null = mode tambah; berisi ledgerId = mode edit cash-in pending. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([]);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  /** S3 key bukti lama saat edit — dipertahankan kalau user tak upload ulang. */
  const [existingEvidence, setExistingEvidence] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [showInPo, setShowInPo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [programId, setProgramId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingCashIn | null>(null);
  const [deleting, setDeleting] = useState(false);

  const amountNum = Number(amount.replace(/[^\d]/g, "")) || 0;

  const promoSelected = promos.find((p) => p.id === programId) ?? null;

  // Preview alokasi greedy — urut sortOrder (sama dengan buildAllocations submit).
  const orderedSelected = terms
    .filter((t) => selectedTermIds.includes(t.id))
    .map((t) => ({ id: t.id, remaining: Math.max(0, t.amount - t.paid) }));
  const alloc = computeAllocationPreview(orderedSelected, amountNum);

  // Nominal habis teralokasi penuh (tidak ada sisa `lebih`) → termin lain yang
  // belum terpilih dikunci. Kalau lebih bayar baru bebas kaitkan ke mana saja.
  const budgetConsumed = amountNum > 0 && alloc.lebih === 0;
  // Bukti bayar wajib: file baru dilampirkan ATAU (saat edit) bukti lama masih ada.
  const hasEvidence = !!evidenceFile || !!existingEvidence;
  // Submit boleh saat nominal PAS/LEBIH (kurang = blocking) + bukti bayar ada.
  const canSubmitForm =
    amountNum > 0 &&
    !!paymentMethodId &&
    selectedTermIds.length > 0 &&
    alloc.kurang === 0 &&
    hasEvidence;

  // Booking fee = termin pertama; tertutup kalau paid > 0 atau ada cash-in ke situ.
  const firstTerm = terms[0];
  const bookingFeePaid =
    !!firstTerm &&
    (firstTerm.paid > 0 ||
      cashIns.some((ci) => ci.allocations.some((a) => a.termId === firstTerm.id)));

  function resetForm(): void {
    setEditingId(null);
    setOccurredAt(todayISO());
    setAmount("");
    setPaymentMethodId("");
    setSelectedTermIds([]);
    setEvidenceFile(null);
    setExistingEvidence(null);
    setNotes("");
    setShowInPo(false);
    setProgramId(null);
  }

  /** Buka form dalam mode edit dengan data cash-in pending di-prefill. */
  function openEdit(ci: BookingCashIn): void {
    setEditingId(ci.id);
    setOccurredAt(ci.occurredAt.slice(0, 10));
    setAmount(String(ci.amount));
    setPaymentMethodId(ci.paymentMethodId ?? "");
    setSelectedTermIds(ci.allocations.map((a) => a.termId));
    setEvidenceFile(null);
    setExistingEvidence(ci.evidence);
    setNotes(ci.notes ?? "");
    setShowInPo(ci.showInPo);
    setProgramId(ci.discountProgramId);
    setFormOpen(true);
  }

  function toggleTermSelection(id: string): void {
    setSelectedTermIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  async function handleAddPayment(): Promise<void> {
    if (amountNum <= 0) { toast.error("Jumlah pembayaran wajib diisi."); return; }
    if (!paymentMethodId) { toast.error("Pilih rekening penerima."); return; }
    if (selectedTermIds.length === 0) { toast.error("Pilih minimal satu termin."); return; }
    if (alloc.kurang > 0) { toast.error("Nominal kurang dari termin terpilih. Kurangi termin atau naikkan nominal."); return; }
    if (!hasEvidence) { toast.error("Bukti bayar wajib dilampirkan."); return; }

    setSubmitting(true);

    // Upload bukti baru (kalau ada). User sengaja melampirkan bukti, jadi kalau
    // upload gagal JANGAN diam-diam simpan tanpa bukti — tampilkan alasannya
    // (403 izin / 413 file kegedean / 500 storage) lalu batalkan submit. Saat edit
    // tanpa upload ulang, pertahankan bukti lama (existingEvidence).
    let evidenceKey: string | null = existingEvidence;
    if (evidenceFile) {
      const fd = new FormData();
      fd.append("file", evidenceFile);
      try {
        const up = await fetch("/api/upload/booking-fee-evidence", { method: "POST", body: fd });
        if (up.ok) {
          const d = (await up.json()) as { key?: string };
          evidenceKey = d.key ?? evidenceKey;
        } else {
          const d = (await up.json().catch(() => ({}))) as { error?: string };
          toast.error(d.error ?? `Gagal upload bukti (${up.status}).`);
          setSubmitting(false);
          return;
        }
      } catch {
        toast.error("Gagal upload bukti — periksa koneksi lalu coba lagi.");
        setSubmitting(false);
        return;
      }
    }

    const allocations = buildAllocations(amountNum, selectedTermIds, terms);
    const discountAmount = computePromoDiscount(amountNum, promoSelected);
    const result = editingId
      ? await updateCashIn({
          ledgerId: editingId,
          occurredAt: new Date(occurredAt).toISOString(),
          amount: amountNum,
          paymentMethodId: paymentMethodId || null,
          discountProgramId: programId,
          discountAmount,
          evidence: evidenceKey,
          notes: notes.trim() || null,
          showInPo,
          allocations,
        })
      : await createCashIn({
          bookingId,
          occurredAt: new Date(occurredAt).toISOString(),
          amount: amountNum,
          paymentMethodId: paymentMethodId || null,
          discountProgramId: programId,
          discountAmount,
          evidence: evidenceKey,
          notes: notes.trim() || null,
          showInPo,
          allocations,
        });
    setSubmitting(false);

    if (!result.success) { toast.error(result.error); return; }
    toast.success(editingId ? "Pembayaran berhasil diperbarui" : "Pembayaran berhasil dicatat");
    resetForm();
    setFormOpen(false);
    void qc.invalidateQueries({ queryKey: ["bookings"] });
    void qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
    void qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
  }

  async function confirmDeleteCashIn(): Promise<void> {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteCashIn(deleteTarget.id);
    setDeleting(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Pembayaran dihapus");
    setDeleteTarget(null);
    void qc.invalidateQueries({ queryKey: ["bookings"] });
    void qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
    void qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
  }

  async function handleContinue(): Promise<void> {
    // Re-check gate against fresh data before advancing.
    try {
      const fresh = await getBookingFinanceDetailClient(bookingId);
      const freshFirst = fresh?.terms?.[0];
      const feeOk =
        !!freshFirst &&
        (freshFirst.effectivePaid > 0 ||
          (fresh?.cashIns ?? []).some((ci) => ci.allocations.some((a) => a.termId === freshFirst.id)));
      if (!feeOk) {
        toast.error("Booking fee belum tercatat. Catat pembayaran booking fee dulu.");
        return;
      }
    } catch {
      // If recheck fails, fall through to the local gate (bookingFeePaid).
      if (!bookingFeePaid) return;
    }
    if (onSaved) onSaved();
  }

  const s3Base = (process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "").replace(/\/$/, "");
  const termName = (termId: string): string => terms.find((t) => t.id === termId)?.name ?? "Termin";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4">
        {/* ── Info banner ── */}
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          Catat pembayaran client dan kaitkan ke termin. Verifikasi Finance tetap di{" "}
          <span className="font-medium text-foreground">Cashbook</span>. Booking fee wajib
          dicatat sebelum tanda tangan.
        </p>

        {/* ── Gate banner ── */}
        {!bookingFeePaid && (
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
                  const selected = selectedTermIds.includes(t.id);
                  const remaining = Math.max(0, t.amount - t.paid);
                  const lunas = remaining <= 0;
                  const allocated = selected ? (alloc.perTerm.get(t.id) ?? 0) : 0;
                  const partial = selected && allocated > 0 && allocated < remaining;
                  const unfunded = selected && allocated <= 0;
                  // Nominal habis → termin lain yang belum dipilih dikunci.
                  const budgetLocked = budgetConsumed && !selected;
                  const disabled = lunas || budgetLocked;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleTermSelection(t.id)}
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
                        <span className="truncate">{t.name}</span>
                        {lunas && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Lunas</span>}
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
                  {existingEvidence ? "Ganti bukti (biarkan untuk pertahankan yang lama)" : "Upload bukti (JPG/PNG/PDF, maks 10MB)"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              {editingId && existingEvidence && !evidenceFile && (
                <p className="text-[11px] text-muted-foreground">Bukti lama masih tersimpan.</p>
              )}
              {!hasEvidence && (
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
              <Switch id="edit-add-show-in-po" checked={showInPo} onCheckedChange={setShowInPo} />
              <Label htmlFor="edit-add-show-in-po" className="cursor-pointer text-xs text-muted-foreground">
                Tampilkan di PO
              </Label>
            </div>

            {/* Ringkasan alokasi — Client Bayar / Total Termin / Selisih */}
            {selectedTermIds.length > 0 && amountNum > 0 && (
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
            {selectedTermIds.length > 0 && amountNum > 0 && (alloc.kurang > 0 || alloc.lebih > 0) && (
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
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-full"
                onClick={() => { void handleAddPayment(); }}
                disabled={!canSubmitForm || submitting}
              >
                {submitting ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Pembayaran"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Daftar pembayaran tercatat ── */}
        {cashIns.length === 0 && !formOpen ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <CardReceive weight="BoldDuotone" className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Belum ada pembayaran tercatat.</p>
            <p className="text-xs text-muted-foreground">Klik &quot;Tambah Pembayaran&quot; untuk mencatat booking fee.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {cashIns.map((ci) => (
              <div key={ci.id} className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums text-foreground">Rp{fmtRp(ci.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ci.occurredAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        ci.ackStatus === "acknowledged"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {ci.ackStatus === "acknowledged" ? "Terverifikasi" : "Menunggu"}
                    </span>
                    {ci.ackStatus !== "acknowledged" && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(ci)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          aria-label="Edit pembayaran"
                        >
                          <Pen weight="BoldDuotone" className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(ci)}
                          className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                          aria-label="Hapus pembayaran"
                        >
                          <TrashBinTrash weight="BoldDuotone" className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Termin yang ditutup */}
                {ci.allocations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ci.allocations.map((a) => (
                      <span
                        key={a.termId}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] text-foreground"
                      >
                        {termName(a.termId)} · Rp{fmtRp(a.amount)}
                      </span>
                    ))}
                  </div>
                )}

                {ci.notes && <p className="text-xs text-muted-foreground">{ci.notes}</p>}

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                  {ci.evidence ? (
                    <a
                      href={`${s3Base}/${ci.evidence}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      <UploadMinimalistic weight="BoldDuotone" className="size-3" />
                      Lihat bukti
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Tanpa bukti</span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Tampilkan di PO</span>
                    <Switch
                      checked={ci.showInPo}
                      disabled={toggleShowInPoMutation.isPending}
                      onCheckedChange={(val) => {
                        void toggleShowInPoMutation.mutateAsync({ ledgerId: ci.id, showInPo: val });
                      }}
                      aria-label="Tampilkan di PO"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background pt-3">
        <div className="flex items-center gap-2 pb-1">
          {onPrevious && (
            <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={onPrevious}>
              Sebelumnya
            </Button>
          )}
          <Button
            type="button"
            className="flex-1 rounded-full"
            disabled={!bookingFeePaid || submitting}
            onClick={() => { void handleContinue(); }}
          >
            {saveLabel}
          </Button>
        </div>
      </div>

      {/* Konfirmasi hapus pembayaran (pending only) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Pembayaran <span className="font-semibold tabular-nums">Rp{fmtRp(deleteTarget.amount)}</span>{" "}
                  ({new Date(deleteTarget.occurredAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})
                  akan dihapus permanen. Hanya pembayaran yang belum diverifikasi yang bisa dihapus.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void confirmDeleteCashIn(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── EditPaymentContentById (no Drawer shell) ────────────────────────────────
 * Fetches finance detail and renders the Payment body WITHOUT a Sheet of its own,
 * so it can be embedded inside the edit-booking continue flow. `active` gates fetch.
 * ─────────────────────────────────────────────────────────────────────────── */

export function EditPaymentContentById({
  active,
  bookingId,
  onPrevious,
  onSaved,
  saveLabel,
}: {
  active: boolean;
  bookingId: string;
  onPrevious?: () => void;
  /** Continue flow only: advance to the next step after a successful save. */
  onSaved?: () => void;
  saveLabel?: string;
}): React.ReactElement {
  const { data, isLoading, error } = useBookingFinanceDetail(active ? bookingId : null);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Memuat data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-destructive">
        Gagal memuat data. Coba tutup dan buka kembali.
      </div>
    );
  }
  if (!data) return <></>;

  const terms: FinanceTerm[] = data.terms.map((t) => ({
    id: t.id,
    name: t.name,
    amount: t.amount,
    dueDate: t.dueDate,
    sortOrder: t.sortOrder,
    notes: t.notes,
    paid: t.effectivePaid,
  }));

  return (
    <PaymentContent
      bookingId={data.id}
      terms={terms}
      cashIns={data.cashIns}
      saveLabel={saveLabel}
      onPrevious={onPrevious}
      onSaved={onSaved}
    />
  );
}

/* ─── EditPaymentDrawerById (standalone) ──────────────────────────────────────
 * Optional standalone shell (Finance AR / row menu). Mirrors EditTopDrawerById.
 * ─────────────────────────────────────────────────────────────────────────── */

export interface EditPaymentDrawerByIdProps {
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  bookingId: string;
  customerName: string;
  saveLabel?: string;
  step?: number;
  totalSteps?: number;
}

export function EditPaymentDrawerById({
  isOpen,
  onClose,
  onPrevious,
  bookingId,
  customerName,
  saveLabel,
  step,
  totalSteps,
}: EditPaymentDrawerByIdProps): React.ReactElement {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Pembayaran — ${customerName}`}
      headerActions={step && totalSteps ? (
        <span className="text-sm text-muted-foreground">Step {step} / {totalSteps}</span>
      ) : undefined}
    >
      <EditPaymentContentById active={isOpen} bookingId={bookingId} onPrevious={onPrevious} saveLabel={saveLabel} />
    </Drawer>
  );
}
