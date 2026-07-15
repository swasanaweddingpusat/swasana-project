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
import {
  AddCircle,
  CheckCircle,
  CloseCircle,
  DangerTriangle,
  UploadMinimalistic,
  CardReceive,
  Link as LinkIcon,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { createCashIn } from "@/actions/ledger";
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

  // ── Add-payment form state ────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [occurredAt, setOccurredAt] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([]);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [showInPo, setShowInPo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const amountNum = Number(amount.replace(/[^\d]/g, "")) || 0;

  // Booking fee = termin pertama; tertutup kalau paid > 0 atau ada cash-in ke situ.
  const firstTerm = terms[0];
  const bookingFeePaid =
    !!firstTerm &&
    (firstTerm.paid > 0 ||
      cashIns.some((ci) => ci.allocations.some((a) => a.termId === firstTerm.id)));

  function resetForm(): void {
    setOccurredAt(todayISO());
    setAmount("");
    setPaymentMethodId("");
    setSelectedTermIds([]);
    setEvidenceFile(null);
    setNotes("");
    setShowInPo(false);
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

    setSubmitting(true);

    // Upload bukti dulu (kalau ada) — gagal upload non-fatal.
    let evidenceKey: string | null = null;
    if (evidenceFile) {
      const fd = new FormData();
      fd.append("file", evidenceFile);
      try {
        const up = await fetch("/api/upload/booking-fee-evidence", { method: "POST", body: fd });
        if (up.ok) {
          const d = (await up.json()) as { key?: string };
          evidenceKey = d.key ?? null;
        }
      } catch {
        // non-fatal
      }
    }

    const allocations = buildAllocations(amountNum, selectedTermIds, terms);
    const result = await createCashIn({
      bookingId,
      occurredAt: new Date(occurredAt).toISOString(),
      amount: amountNum,
      paymentMethodId: paymentMethodId || null,
      discountAmount: 0,
      evidence: evidenceKey,
      notes: notes.trim() || null,
      showInPo,
      allocations,
    });
    setSubmitting(false);

    if (!result.success) { toast.error(result.error); return; }
    toast.success("Pembayaran berhasil dicatat");
    resetForm();
    setFormOpen(false);
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
              onClick={() => setFormOpen(true)}
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
              Pembayaran Baru
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
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={lunas}
                      onClick={() => toggleTermSelection(t.id)}
                      aria-pressed={selected}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                        lunas
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
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {t.name}
                        {lunas && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Lunas</span>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        Rp{fmtRp(remaining)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bukti bayar */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bukti Bayar (opsional)</Label>
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
                disabled={submitting}
              >
                {submitting ? "Menyimpan..." : "Simpan Pembayaran"}
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
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      ci.ackStatus === "acknowledged"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {ci.ackStatus === "acknowledged" ? "Terverifikasi" : "Menunggu"}
                  </span>
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
