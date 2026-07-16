"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format } from "date-fns";
import { Drawer } from "@/components/shared/drawer";
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
import { useQueryClient } from "@tanstack/react-query";
import { useBookingFinanceDetail } from "@/hooks/use-booking-finance-detail";
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
      setDiscountName(initialDiscountName ?? "Discount");
      setDiscountAmount(initialDiscountAmount);
      setDiscountEditing(false);
    });
  }, [initialTerms, initialDiscountName, initialDiscountAmount]);

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

    // Jadwal tidak berubah — lanjut saja (pembayaran dicatat di step berikutnya).
    if (!isChanged) {
      if (onSaved) onSaved();
      return;
    }

    const firstTerm = terms[0];
    if (firstTerm && (!firstTerm.amount || firstTerm.amount <= 0)) {
      toast.error(`Nominal ${firstTerm.name || "term pertama"} wajib diisi dan lebih dari 0.`);
      return;
    }

    setLoading(true);

    // ── Simpan jadwal termin (schedule-only; pembayaran pindah ke step Payment) ──
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

    setLoading(false);

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
