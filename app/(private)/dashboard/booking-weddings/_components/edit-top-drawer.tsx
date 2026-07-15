"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Drawer } from "@/components/shared/drawer";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import {
  Calendar as CalendarIcon,
  AddCircle,
  TrashBinTrash,
  Pen,
  AlignVerticalSpacing,
  AltArrowDown,
  CheckCircle,
  ClockCircle,
  DangerTriangle,
  MoneyBag,
  UploadMinimalistic,
  CloseCircle,
} from "@solar-icons/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { updateTermOfPayments } from "@/actions/term-of-payment";
import { createCashIn, updateCashIn } from "@/actions/ledger";
import { useQueryClient } from "@tanstack/react-query";
import { getBookingFinanceDetailClient } from "@/services/booking-finance-service";
import { useBookingFinanceDetail } from "@/hooks/use-booking-finance-detail";
import { useToggleCashInShowInPo } from "@/hooks/use-ledger";
import { fmtRp, toLocalISO, type FinanceTerm } from "./edit-finance-shared";

/* ─── Sortable Term wrapper ───────────────────────────────────────────────────
 * Provides the draggable container + drag-handle props for one TOP row.
 * ─────────────────────────────────────────────────────────────────────────── */

type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

function SortableTermItem({
  id,
  children,
}: {
  id: string;
  children: (drag: DragHandleProps) => React.ReactNode;
}): React.ReactElement {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-50 relative z-10")}
    >
      {children({ attributes, listeners })}
    </div>
  );
}

/* ─── TOP Content (schedule-only, Fase 5) ─────────────────────────────────────
 * Edit jadwal termin: nama / nominal / jatuh tempo + tambah / hapus / drag-urut.
 * Pembayaran DICATAT terpisah di Cashbook (Ledger) — drawer ini tidak lagi
 * mengelola status bayar / bukti / cicilan. Termin yang sudah punya cash-in
 * ter-ack (`paid > 0`) TERKUNCI: nominal/nama read-only & tidak bisa dihapus.
 * ─────────────────────────────────────────────────────────────────────────── */

interface TopContentProps {
  bookingId: string;
  initialTerms: FinanceTerm[];
  cashIns: import("@/lib/queries/ledger").BookingCashIn[];
  packagePrice: number;
  discountName: string | null;
  discountAmount: number;
  saveLabel?: string;
  onPrevious?: () => void;
  /** Continue flow: called after a successful save to advance to the next step.
   *  Omitted in standalone usage (Finance AR / row menu) — drawer stays open. */
  onSaved?: () => void;
}

function TopContent({
  bookingId,
  initialTerms,
  cashIns,
  packagePrice,
  discountName: initialDiscountName,
  discountAmount: initialDiscountAmount,
  saveLabel = "Update",
  onPrevious,
  onSaved,
}: TopContentProps): React.ReactElement {
  const qc = useQueryClient();
  const [terms, setTerms] = useState<FinanceTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [discountName, setDiscountName] = useState(initialDiscountName ?? "Discount");
  const [discountAmount, setDiscountAmount] = useState(initialDiscountAmount);
  const [discountEditing, setDiscountEditing] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);
  // Guard error dari server (integrity check FIX A) — ditampilkan sebagai banner
  // persisten, bukan cuma toast, karena pesannya sebut nama termin + nominal.
  const [guardError, setGuardError] = useState<string | null>(null);
  // ── Inline payment state ──────────────────────────────────────────────────
  interface InlinePayment {
    /** Ledger id kalau form ini nge-edit cash-in pending yang SUDAH ada di DB.
     *  null = pembayaran baru (akan dibuat via createCashIn saat simpan). */
    existingLedgerId: string | null;
    enabled: boolean;
    occurredAt: string;         // YYYY-MM-DD
    paymentMethodId: string;
    evidenceFile: File | null;
    evidenceUrl: string | null; // storage key setelah upload
    notes: string;
    showInPo: boolean;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const toggleShowInPoMutation = useToggleCashInShowInPo(bookingId);

  const defaultInlinePayment = (): InlinePayment => ({
    existingLedgerId: null,
    enabled: false,
    occurredAt: todayStr,
    paymentMethodId: "",
    evidenceFile: null,
    evidenceUrl: null,
    notes: "",
    showInPo: false,
  });

  const [inlinePayments, setInlinePayments] = useState<Map<string, InlinePayment>>(new Map());

  const updateInlinePayment = (termId: string, patch: Partial<InlinePayment>): void => {
    setInlinePayments((prev) => {
      const next = new Map(prev);
      next.set(termId, { ...(next.get(termId) ?? defaultInlinePayment()), ...patch });
      return next;
    });
  };

  // Accordion collapse state — a term's id here = collapsed (body hidden).
  const [collapsedTerms, setCollapsedTerms] = useState<Set<string>>(new Set());

  const toggleTerm = (id: string): void => {
    setCollapsedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // Reset when the booking data actually changes (drawer re-opened with different
  // booking). Compare by content fingerprint so a background refetch returning the
  // same data does NOT clobber an in-progress drag reorder / edit.
  const prevFingerprintRef = useRef<string>("");
  useEffect(() => {
    const fingerprint = JSON.stringify({
      terms: initialTerms.map((t) => ({
        id: t.id,
        name: t.name,
        amount: Number(t.amount),
        dueDate: t.dueDate,
        sortOrder: t.sortOrder,
        paid: t.paid,
      })),
      discountName: initialDiscountName ?? "Discount",
      discountAmount: initialDiscountAmount,
    });
    if (fingerprint === prevFingerprintRef.current) return;
    prevFingerprintRef.current = fingerprint;
    queueMicrotask(() => {
      setTerms(initialTerms.map((t) => ({ ...t, amount: Number(t.amount) })));
      // Collapse terkunci (paid > 0) secara default — sudah settled, kartu mulai
      // ringkas; termin aktif (belum ada cash-in) tetap kebuka.
      setCollapsedTerms(new Set(initialTerms.filter((t) => t.paid > 0).map((t) => t.id)));
      // Auto-fill inline payment dari cash-in pending yang sudah ada di DB.
      // Satu termin = satu cash-in pending terakhir (jika ada).
      const prefilledMap = new Map<string, InlinePayment>();
      for (const term of initialTerms) {
        if (term.paid > 0) continue; // locked → tidak pakai inline payment
        const existing = cashIns.find(
          (ci) => ci.ackStatus === "pending" && ci.allocations.some((a) => a.termId === term.id),
        );
        if (existing) {
          prefilledMap.set(term.id, {
            existingLedgerId: existing.id,
            // Default COLLAPSED — data tetap pre-loaded, user klik header buat lihat/edit.
            enabled: false,
            occurredAt: existing.occurredAt.slice(0, 10),
            paymentMethodId: existing.paymentMethodId ?? "",
            evidenceFile: null,
            evidenceUrl: existing.evidence,
            notes: existing.notes ?? "",
            showInPo: existing.showInPo,
          });
        }
      }
      setInlinePayments(prefilledMap);
      setDiscountName(initialDiscountName ?? "Discount");
      setDiscountAmount(initialDiscountAmount);
      setDiscountEditing(false);
    });
  }, [initialTerms, initialDiscountName, initialDiscountAmount, cashIns]);

  // Locked term = sudah ada cash-in ter-ack (paid > 0). Read-only + tak bisa dihapus.
  const isLocked = (t: FinanceTerm): boolean => t.paid > 0;

  const priceAfterDiscount = Math.max(0, packagePrice - discountAmount);
  const totalTerms = terms.reduce((s, t) => s + (t.amount || 0), 0);
  const difference = totalTerms - priceAfterDiscount;

  const isChanged = useMemo(() => {
    if (terms.length !== initialTerms.length) return true;
    if (discountName !== (initialDiscountName ?? "Discount")) return true;
    if (discountAmount !== initialDiscountAmount) return true;
    const initById = new Map(initialTerms.map((t) => [t.id, t]));
    const orderChanged = terms.some((t, i) => initialTerms[i]?.id !== t.id);
    if (orderChanged) return true;
    return terms.some((t) => {
      const init = initById.get(t.id);
      if (!init) return true; // new term
      return (
        t.name !== init.name ||
        Number(t.amount) !== Number(init.amount) ||
        t.dueDate !== init.dueDate
      );
    });
  }, [terms, initialTerms, discountName, initialDiscountName, discountAmount, initialDiscountAmount]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTerms((prev) => {
      const oldIdx = prev.findIndex((t) => t.id === active.id);
      const newIdx = prev.findIndex((t) => t.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleFieldChange = (id: string, field: "name" | "amount" | "dueDate", value: string | number): void => {
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleAddTerm = (): void => {
    const maxSort = terms.reduce((max, t) => Math.max(max, t.sortOrder), -1);
    setTerms((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        amount: 0,
        dueDate: toLocalISO(new Date()),
        sortOrder: maxSort + 1,
        notes: null,
        paid: 0,
      },
    ]);
  };

  const handleDeleteTerm = (id: string): void => {
    setGuardError(null);
    setTerms((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdate = async (): Promise<void> => {
    setGuardError(null);

    // Reconciliation guard: Σ termin HARUS sama dengan harga-setelah-diskon.
    if (difference !== 0) {
      const absDiff = fmtRp(Math.abs(difference));
      toast.error(
        difference < 0
          ? `Total cicilan kurang Rp${absDiff} dari harga paket. Sesuaikan dulu.`
          : `Total cicilan lebih Rp${absDiff} dari harga paket. Sesuaikan dulu.`,
      );
      return;
    }

    // Tag each term with its on-screen position so the server persists the post-drag
    // order (display-only, no approval reset).
    const ordered = terms.map((t, i) => ({ term: t, sortOrder: i }));

    // Inline payments yang aktif & punya rekening — dicatat/di-update saat simpan.
    const pendingPayments = ordered.filter(({ term }) => {
      const ip = inlinePayments.get(term.id);
      return ip?.enabled && ip.paymentMethodId;
    });

    // Benar-benar tidak ada yang berubah (termin sama + tak ada pembayaran) — lanjut saja.
    if (!isChanged && pendingPayments.length === 0) {
      if (onSaved) onSaved();
      return;
    }

    const firstTerm = terms[0];
    if (firstTerm && (!firstTerm.amount || firstTerm.amount <= 0)) {
      toast.error(`Nominal ${firstTerm.name || "term pertama"} wajib diisi dan lebih dari 0.`);
      return;
    }

    setLoading(true);

    // ── Simpan jadwal termin HANYA jika berubah ──────────────────────────────
    if (isChanged) {
      const existingTerms = ordered.filter((x) => !x.term.id.startsWith("new-"));
      const newTerms = ordered.filter((x) => x.term.id.startsWith("new-"));

      const result = await updateTermOfPayments(
        bookingId,
        existingTerms.map(({ term: t, sortOrder }) => ({
          id: t.id,
          name: t.name,
          amount: t.amount,
          dueDate: t.dueDate,
          notes: t.notes,
          sortOrder,
        })),
        newTerms.map(({ term: t, sortOrder }) => ({
          name: t.name,
          amount: t.amount,
          dueDate: t.dueDate,
          sortOrder,
        })),
        { discountName, discountAmount },
      );

      if (!result.success) {
        setLoading(false);
        // Guard errors (FIX A) name the specific term + cash amount attached — surface
        // them as a persistent banner (not just a toast) so the instruction stays
        // visible while the user goes to void/move the payment in Cashbook.
        setGuardError(result.error ?? "Terjadi kesalahan.");
        toast.error(result.error);
        return;
      }

      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
      void qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
      toast.success("Jadwal termin disimpan");
    }

    setLoading(false);

    // ── Inline payments: create baru / update yang sudah ada ─────────────────
    if (pendingPayments.length > 0) {
      // Untuk new-* terms: fetch fresh data buat resolve real DB IDs.
      // Untuk existing terms: ID sudah diketahui langsung.
      const hasNewTerms = pendingPayments.some(({ term }) => term.id.startsWith("new-"));
      let freshTerms: { id: string; name: string; amount: number }[] = [];
      if (hasNewTerms) {
        try {
          const freshDetail = await getBookingFinanceDetailClient(bookingId);
          const initialIds = new Set(initialTerms.map((t) => t.id));
          freshTerms = (freshDetail?.terms ?? []).filter((t) => !initialIds.has(t.id));
        } catch {
          toast.error("Gagal memuat data termin baru — cash-in tidak dibuat.");
          if (onSaved) onSaved();
          return;
        }
      }

      for (const { term } of pendingPayments) {
        const ip = inlinePayments.get(term.id)!;

        // Resolve termId: existing = langsung, new-* = match by name+amount
        let resolvedTermId: string;
        if (term.id.startsWith("new-")) {
          const matched = freshTerms.find((ft) => ft.name === term.name && ft.amount === term.amount);
          if (!matched) {
            toast.error(`Tidak menemukan termin "${term.name}" di data terbaru — cash-in dilewati.`);
            continue;
          }
          resolvedTermId = matched.id;
        } else {
          resolvedTermId = term.id;
        }

        // Upload evidence jika ada file baru yang belum di-upload
        let evidenceKey = ip.evidenceUrl;
        if (ip.evidenceFile && !evidenceKey) {
          const fd = new FormData();
          fd.append("file", ip.evidenceFile);
          try {
            const uploadRes = await fetch("/api/upload/booking-fee-evidence", { method: "POST", body: fd });
            if (uploadRes.ok) {
              const uploadData = (await uploadRes.json()) as { key?: string };
              evidenceKey = uploadData.key ?? null;
            }
          } catch {
            // non-fatal: lanjut tanpa evidence
          }
        }

        if (ip.existingLedgerId) {
          // Cash-in pending yang sudah ada → UPDATE (jangan bikin duplikat).
          // Hanya panggil kalau ada perubahan vs data DB, biar tidak spam log.
          const orig = cashIns.find((c) => c.id === ip.existingLedgerId);
          const changed =
            !orig ||
            orig.occurredAt.slice(0, 10) !== ip.occurredAt ||
            (orig.paymentMethodId ?? "") !== ip.paymentMethodId ||
            (orig.notes ?? "") !== ip.notes.trim() ||
            orig.showInPo !== ip.showInPo ||
            Boolean(ip.evidenceFile) ||
            (orig.evidence ?? null) !== (evidenceKey ?? null) ||
            Number(orig.amount) !== Number(term.amount);
          if (!changed) continue;

          const updateResult = await updateCashIn({
            ledgerId: ip.existingLedgerId,
            occurredAt: ip.occurredAt,
            amount: term.amount,
            paymentMethodId: ip.paymentMethodId || null,
            discountAmount: 0,
            evidence: evidenceKey ?? null,
            notes: ip.notes.trim() || null,
            showInPo: ip.showInPo,
            allocations: [{ termId: resolvedTermId, amount: term.amount }],
          });

          if (updateResult.success) {
            toast.success(`Pembayaran "${term.name}" berhasil diperbarui`);
          } else {
            toast.error(`Pembayaran "${term.name}" gagal: ${updateResult.error}`);
          }
        } else {
          const cashInResult = await createCashIn({
            bookingId,
            occurredAt: ip.occurredAt,
            amount: term.amount,
            paymentMethodId: ip.paymentMethodId || null,
            discountAmount: 0,
            evidence: evidenceKey ?? null,
            notes: ip.notes.trim() || null,
            showInPo: ip.showInPo,
            allocations: [{ termId: resolvedTermId, amount: term.amount }],
          });

          if (cashInResult.success) {
            toast.success(`Cash-in "${term.name}" berhasil dicatat`);
          } else {
            toast.error(`Cash-in "${term.name}" gagal: ${cashInResult.error}`);
          }
        }
      }

      setInlinePayments(new Map());
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
    }

    if (onSaved) onSaved();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4">
        {/* ── Info: pembayaran pindah ke Cashbook ── */}
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          Ini jadwal termin (nama, nominal, jatuh tempo). Pencatatan pembayaran &amp;
          verifikasinya ada di <span className="font-medium text-foreground">Cashbook</span>.
        </p>

        {/* ── Guard error (FIX A): termin ber-cash-in gagal dihapus/disimpan ── */}
        {guardError && (
          <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive">
            <DangerTriangle weight="BoldDuotone" className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{guardError}</span>
          </div>
        )}

        {/* ── Daftar termin ── */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={terms.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2.5">
              {terms.map((term, i) => {
                const locked = isLocked(term);
                // Termin punya cash-in non-void nempel (pending/acked). Server nolak
                // hapus termin begini (guard orphan) — jadi sembunyikan tombol hapus
                // di client biar gak nyasar ke error banner pas simpan.
                const hasCashIn = cashIns.some((ci) =>
                  ci.allocations.some((a) => a.termId === term.id),
                );
                const isOpen = !collapsedTerms.has(term.id);
                return (
                  <SortableTermItem key={term.id} id={term.id}>
                    {(drag) => (
                      <Collapsible
                        open={isOpen}
                        onOpenChange={() => toggleTerm(term.id)}
                        className={cn(
                          "overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
                          locked ? "border-primary/30 bg-primary/5" : "border-border",
                        )}
                      >
                        {/* ── Header accordion — drag handle + trigger + hapus (sibling) ── */}
                        <div className="flex items-center gap-1 px-3 py-2.5">
                          <button
                            type="button"
                            aria-label="Geser urutan termin"
                            className="-ml-1.5 shrink-0 cursor-grab rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing touch-none"
                            {...drag.attributes}
                            {...drag.listeners}
                          >
                            <AlignVerticalSpacing weight="BoldDuotone" className="size-4" />
                          </button>
                          <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
                            <AltArrowDown
                              weight="BoldDuotone"
                              className={cn(
                                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                isOpen && "rotate-180",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-sm font-medium",
                                  term.name ? "text-foreground" : "italic text-muted-foreground",
                                )}
                              >
                                {term.name || `Termin ${i + 1}`}
                              </p>
                              {!isOpen && (
                                <p className="text-xs tabular-nums text-muted-foreground">
                                  {term.amount ? `Rp${fmtRp(term.amount)}` : "Rp0"}
                                  {term.dueDate ? ` · ${format(new Date(term.dueDate), "dd MMM yyyy")}` : ""}
                                </p>
                              )}
                            </div>
                          </CollapsibleTrigger>
                          {locked && (
                            <Badge variant="secondary" className="shrink-0 gap-1 rounded-full">
                              <CheckCircle weight="BoldDuotone" className="size-3 text-primary" />
                              Terkunci
                            </Badge>
                          )}
                          {!locked && hasCashIn && (
                            <Badge variant="secondary" className="shrink-0 gap-1 rounded-full">
                              <ClockCircle weight="BoldDuotone" className="size-3 text-muted-foreground" />
                              Ada pembayaran
                            </Badge>
                          )}
                          {/* Hapus — hanya termin belum terkunci & TANPA cash-in nempel
                              (server nolak hapus termin ber-cash-in → cegah di sini). */}
                          {!locked && !hasCashIn && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTerm(term.id);
                              }}
                              aria-label={`Hapus ${term.name || `termin ${i + 1}`}`}
                              className="shrink-0 rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                            >
                              <TrashBinTrash weight="BoldDuotone" className="size-3.5" />
                            </button>
                          )}
                        </div>

                        {/* ── Body accordion ── */}
                        <CollapsibleContent>
                          <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
                            {/* Nama */}
                            <Input
                              value={term.name}
                              disabled={locked}
                              placeholder={`Termin ${i + 1}`}
                              onChange={(e) => handleFieldChange(term.id, "name", e.target.value)}
                              className="h-9 rounded-xl"
                            />

                            {/* Nominal + jatuh tempo */}
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex min-w-40 flex-1 items-center gap-1.5 rounded-xl border border-border bg-background px-2.5">
                                <span className="text-xs text-muted-foreground">Rp</span>
                                <Input
                                  inputMode="numeric"
                                  value={term.amount ? term.amount.toLocaleString("id-ID") : ""}
                                  disabled={locked}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const n = Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                                    handleFieldChange(term.id, "amount", n);
                                  }}
                                  className="h-9 border-0 bg-transparent px-0 tabular-nums shadow-none focus-visible:ring-0"
                                />
                              </div>

                              <Popover
                                open={datePickerOpen === term.id}
                                onOpenChange={(o) => setDatePickerOpen(o ? term.id : null)}
                              >
                                <PopoverTrigger
                                  disabled={locked}
                                  className={cn(
                                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-medium transition-colors",
                                    locked
                                      ? "cursor-not-allowed text-muted-foreground opacity-60"
                                      : "cursor-pointer text-foreground hover:bg-accent",
                                  )}
                                >
                                  <CalendarIcon weight="BoldDuotone" className="size-3.5 text-muted-foreground" />
                                  {term.dueDate ? format(new Date(term.dueDate), "dd MMM yyyy") : "Jatuh tempo"}
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={term.dueDate ? new Date(term.dueDate) : undefined}
                                    onSelect={(d) => {
                                      if (d) handleFieldChange(term.id, "dueDate", toLocalISO(d));
                                      setDatePickerOpen(null);
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>


                            {/* ── Info pembayaran (locked term) ── */}
                            {locked && (() => {
                              const termCashIns = cashIns.filter((ci) =>
                                ci.allocations.some((a) => a.termId === term.id),
                              );
                              if (termCashIns.length === 0) return null;
                              const s3Base = (process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "").replace(/\/$/, "");
                              return (
                                <div className="mt-1 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Pembayaran Masuk
                                  </p>
                                  {termCashIns.map((ci) => {
                                    const alloc = ci.allocations.find((a) => a.termId === term.id);
                                    return (
                                      <div key={ci.id} className="space-y-1.5 rounded-xl border border-border/40 bg-background p-2.5">
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                          <span className="text-muted-foreground">
                                            {new Date(ci.occurredAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                          </span>
                                          <span className="font-semibold tabular-nums text-foreground">
                                            Rp{fmtRp(alloc?.amount ?? ci.amount)}
                                          </span>
                                        </div>
                                        {ci.notes && (
                                          <p className="text-[11px] text-muted-foreground">{ci.notes}</p>
                                        )}
                                        {ci.evidence && (
                                          <a
                                            href={`${s3Base}/${ci.evidence}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
                                          >
                                            <UploadMinimalistic weight="BoldDuotone" className="size-3" />
                                            Lihat bukti bayar
                                          </a>
                                        )}
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                          <span className="text-[11px] text-muted-foreground">Tampilkan di PO</span>
                                          <Switch
                                            checked={ci.showInPo}
                                            disabled={toggleShowInPoMutation.isPending}
                                            onCheckedChange={(val) => {
                                              void toggleShowInPoMutation.mutateAsync({
                                                ledgerId: ci.id,
                                                showInPo: val,
                                              });
                                            }}
                                            aria-label="Tampilkan di PO"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                                    Untuk mengubah data pembayaran, hubungi tim Finance.
                                  </p>
                                </div>
                              );
                            })()}

                            {/* ── Catat Pembayaran Sekaligus (semua term belum locked) ── */}
                            {!locked && (() => {
                              const ip = inlinePayments.get(term.id) ?? defaultInlinePayment();
                              const hasRecorded = Boolean(ip.existingLedgerId);
                              return (
                                <div className="mt-1 rounded-xl border border-dashed border-border/70 bg-muted/20">
                                  <button
                                    type="button"
                                    onClick={() => updateInlinePayment(term.id, { enabled: !ip.enabled })}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                  >
                                    <MoneyBag
                                      weight="BoldDuotone"
                                      className={cn("size-3.5 shrink-0", hasRecorded && "text-primary")}
                                    />
                                    <span className="flex-1">
                                      {hasRecorded ? "Pembayaran Tercatat" : "Catat Pembayaran Sekaligus"}
                                    </span>
                                    {hasRecorded && !ip.enabled && (
                                      <Badge variant="secondary" className="shrink-0 gap-1 rounded-full">
                                        <CheckCircle weight="BoldDuotone" className="size-3 text-primary" />
                                        Tercatat
                                      </Badge>
                                    )}
                                    <AltArrowDown
                                      weight="BoldDuotone"
                                      className={cn("size-3.5 shrink-0 transition-transform", ip.enabled && "rotate-180")}
                                    />
                                  </button>

                                  {ip.enabled && (
                                    <div className="space-y-3 border-t border-border/50 px-3 pb-3 pt-2.5">
                                      {/* Tanggal pembayaran */}
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Tanggal Pembayaran</Label>
                                        <input
                                          type="date"
                                          value={ip.occurredAt}
                                          max={todayStr}
                                          onChange={(e) => updateInlinePayment(term.id, { occurredAt: e.target.value })}
                                          className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                      </div>

                                      {/* Via Rekening */}
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Via Rekening</Label>
                                        <BankAccountSelect
                                          value={ip.paymentMethodId}
                                          onChange={(v) => updateInlinePayment(term.id, { paymentMethodId: v })}
                                          placeholder="Pilih rekening penerima..."
                                          crossVenue
                                        />
                                      </div>

                                      {/* Bukti bayar */}
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Bukti Bayar (opsional)</Label>
                                        {ip.evidenceFile ? (
                                          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                                            <UploadMinimalistic weight="BoldDuotone" className="size-3.5 shrink-0 text-muted-foreground" />
                                            <span className="min-w-0 flex-1 truncate text-xs">{ip.evidenceFile.name}</span>
                                            <button
                                              type="button"
                                              onClick={() => updateInlinePayment(term.id, { evidenceFile: null, evidenceUrl: null })}
                                              className="shrink-0 text-muted-foreground hover:text-foreground"
                                            >
                                              <CloseCircle weight="BoldDuotone" className="size-3.5" />
                                            </button>
                                          </div>
                                        ) : ip.evidenceUrl ? (
                                          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                                            <UploadMinimalistic weight="BoldDuotone" className="size-3.5 shrink-0 text-muted-foreground" />
                                            <a
                                              href={`${(process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "").replace(/\/$/, "")}/${ip.evidenceUrl}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="min-w-0 flex-1 truncate text-xs text-primary underline-offset-2 hover:underline"
                                            >
                                              Lihat bukti bayar
                                            </a>
                                            <button
                                              type="button"
                                              onClick={() => updateInlinePayment(term.id, { evidenceFile: null, evidenceUrl: null })}
                                              className="shrink-0 text-muted-foreground hover:text-foreground"
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
                                              onChange={(e) => {
                                                const file = e.target.files?.[0] ?? null;
                                                updateInlinePayment(term.id, { evidenceFile: file, evidenceUrl: null });
                                              }}
                                            />
                                          </label>
                                        )}
                                      </div>

                                      {/* Keterangan */}
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Keterangan (opsional)</Label>
                                        <Textarea
                                          value={ip.notes}
                                          onChange={(e) => updateInlinePayment(term.id, { notes: e.target.value })}
                                          placeholder="Catatan pembayaran..."
                                          maxLength={500}
                                          rows={2}
                                          className="resize-none rounded-xl text-xs"
                                        />
                                      </div>

                                      {/* Toggle Tampilkan di PO — kalau cash-in sudah ada di DB,
                                          persist langsung (biar PO update tanpa nunggu Simpan). */}
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          id={`show-in-po-${term.id}`}
                                          checked={ip.showInPo}
                                          disabled={Boolean(ip.existingLedgerId) && toggleShowInPoMutation.isPending}
                                          onCheckedChange={(checked) => {
                                            updateInlinePayment(term.id, { showInPo: checked });
                                            if (ip.existingLedgerId) {
                                              void toggleShowInPoMutation.mutateAsync({
                                                ledgerId: ip.existingLedgerId,
                                                showInPo: checked,
                                              });
                                            }
                                          }}
                                        />
                                        <Label htmlFor={`show-in-po-${term.id}`} className="cursor-pointer text-xs text-muted-foreground">
                                          Tampilkan di PO
                                        </Label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </SortableTermItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* ── Tambah termin ── */}
        <Button type="button" variant="outline" className="rounded-full" onClick={handleAddTerm}>
          <AddCircle weight="BoldDuotone" className="size-4" />
          Tambah Termin
        </Button>

        {/* ── Diskon — label di ATAS input (stacked) ── */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-2">
            {/* Label / nama diskon */}
            <div className="flex items-center justify-between gap-2">
              {discountEditing ? (
                <Input
                  value={discountName}
                  onChange={(e) => setDiscountName(e.target.value)}
                  placeholder="Nama diskon"
                  className="h-8 flex-1 rounded-xl"
                />
              ) : (
                <span className="text-sm font-medium text-foreground">{discountName}</span>
              )}
              <button
                type="button"
                onClick={() => setDiscountEditing((v) => !v)}
                aria-label="Edit nama diskon"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pen weight="BoldDuotone" className="size-3.5" />
              </button>
            </div>
            {/* Nominal diskon — full width di bawah label */}
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5">
              <span className="text-xs text-muted-foreground">Rp</span>
              <Input
                inputMode="numeric"
                value={discountAmount ? discountAmount.toLocaleString("id-ID") : ""}
                placeholder="0"
                onChange={(e) => setDiscountAmount(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
                className="h-9 flex-1 border-0 bg-transparent px-0 tabular-nums shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        {/* ── Ringkasan reconciliation ── */}
        <div className="rounded-2xl border border-border bg-secondary/30 p-3 text-sm">
          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground">Harga Paket</span>
            <span className="tabular-nums text-foreground">Rp{fmtRp(packagePrice)}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-destructive">{discountName || "Discount"}</span>
            <span className="tabular-nums text-destructive">− Rp{fmtRp(discountAmount)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-muted-foreground">Harga Setelah Discount</span>
            <span className="tabular-nums text-foreground">Rp{fmtRp(priceAfterDiscount)}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground">Total Input User</span>
            <span className="tabular-nums text-foreground">Rp{fmtRp(totalTerms)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
            <span className="font-medium text-foreground">Selisih</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                difference === 0 ? "text-primary" : "text-destructive",
              )}
            >
              {difference > 0 ? "+" : difference < 0 ? "−" : ""}Rp{fmtRp(Math.abs(difference))}
              {difference === 0 ? " (Sesuai)" : difference < 0 ? " (Kurang)" : " (Lebih)"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background pt-3">
        {/* Mini price summary — Harga Paket · Input User · Selisih */}
        <div className="mb-2 grid grid-cols-3 gap-x-2 rounded-xl bg-muted px-3 py-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Harga Paket</span>
            <span className="truncate text-xs font-semibold tabular-nums text-foreground">Rp{fmtRp(packagePrice)}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Input User</span>
            <span className="truncate text-xs font-semibold tabular-nums text-foreground">Rp{fmtRp(totalTerms)}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Selisih</span>
            <span
              className={cn(
                "truncate text-xs font-semibold tabular-nums",
                difference === 0 ? "text-foreground" : "text-destructive",
              )}
            >
              {difference === 0
                ? "Sesuai"
                : `${difference < 0 ? "−" : "+"} Rp${fmtRp(Math.abs(difference))}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onPrevious && (
            <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={onPrevious}>
              Sebelumnya
            </Button>
          )}
          <Button
            type="button"
            className="flex-1 rounded-full"
            disabled={loading}
            onClick={() => { void handleUpdate(); }}
          >
            {loading ? "Menyimpan..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── EditTopDrawerById (lazy fetch) ──────────────────────────────────────────
 * Fetches booking finance detail on open. Used by Finance AR table.
 * ─────────────────────────────────────────────────────────────────────────── */

export interface EditTopDrawerByIdProps {
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  bookingId: string;
  customerName: string;
  saveLabel?: string;
  step?: number;
  totalSteps?: number;
}

export function EditTopDrawerById({
  isOpen,
  onClose,
  onPrevious,
  bookingId,
  customerName,
  saveLabel,
  step,
  totalSteps,
}: EditTopDrawerByIdProps): React.ReactElement {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Term of Payment — ${customerName}`}
      headerActions={step && totalSteps ? (
        <span className="text-sm text-muted-foreground">Step {step} / {totalSteps}</span>
      ) : undefined}
    >
      <EditTopContentById active={isOpen} bookingId={bookingId} onPrevious={onPrevious} saveLabel={saveLabel} />
    </Drawer>
  );
}

/* ─── EditTopContentById (no Drawer shell) ────────────────────────────────────
 * Fetches finance detail and renders the TOP body WITHOUT a Sheet of its own, so
 * it can be embedded inside another drawer's single Sheet (the edit-booking
 * continue flow). `active` gates the fetch.
 * ─────────────────────────────────────────────────────────────────────────── */

export function EditTopContentById({
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
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Memuat data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-destructive">
        Gagal memuat data. Coba tutup dan buka kembali.
      </div>
    );
  }
  if (!data) return <></>;

  // Map finance-detail terms → schedule-only FinanceTerm (paid = effectivePaid dari Ledger).
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
    <TopContent
      bookingId={data.id}
      initialTerms={terms}
      cashIns={data.cashIns}
      packagePrice={data.packagePrice}
      discountName={data.discountName}
      discountAmount={data.discountAmount}
      saveLabel={saveLabel}
      onPrevious={onPrevious}
      onSaved={onSaved}
    />
  );
}
