"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { Drawer } from "@/components/shared/drawer";
import {
  Calendar as CalendarIcon,
  AddCircle,
  TrashBinTrash,
  Pen,
  AlignVerticalSpacing,
  CheckCircle,
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
    setTerms((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdate = async (): Promise<void> => {
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

    // Continue flow with no changes — skip API call and advance immediately.
    if (!isChanged && onSaved) {
      onSaved();
      return;
    }

    const firstTerm = terms[0];
    if (firstTerm && (!firstTerm.amount || firstTerm.amount <= 0)) {
      toast.error(`Nominal ${firstTerm.name || "term pertama"} wajib diisi dan lebih dari 0.`);
      return;
    }

    setLoading(true);

    // Tag each term with its on-screen position so the server persists the post-drag
    // order (display-only, no approval reset).
    const ordered = terms.map((t, i) => ({ term: t, sortOrder: i }));
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

    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
    qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
    toast.success("Jadwal termin disimpan");
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

        {/* ── Daftar termin ── */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={terms.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2.5">
              {terms.map((term, i) => {
                const locked = isLocked(term);
                return (
                  <SortableTermItem key={term.id} id={term.id}>
                    {(drag) => (
                      <div
                        className={cn(
                          "rounded-2xl border bg-card p-3 shadow-sm transition-colors",
                          locked ? "border-primary/30 bg-primary/5" : "border-border",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {/* Drag handle */}
                          <button
                            type="button"
                            aria-label="Geser urutan termin"
                            className="mt-2 shrink-0 cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
                            {...drag.attributes}
                            {...drag.listeners}
                          >
                            <AlignVerticalSpacing weight="BoldDuotone" className="size-4" />
                          </button>

                          <div className="min-w-0 flex-1 space-y-2">
                            {/* Nama + status kunci */}
                            <div className="flex items-center gap-2">
                              <Input
                                value={term.name}
                                disabled={locked}
                                placeholder={`Termin ${i + 1}`}
                                onChange={(e) => handleFieldChange(term.id, "name", e.target.value)}
                                className="h-9 flex-1 rounded-xl"
                              />
                              {locked && (
                                <Badge variant="secondary" className="shrink-0 gap-1 rounded-full">
                                  <CheckCircle weight="BoldDuotone" className="size-3 text-primary" />
                                  Terkunci
                                </Badge>
                              )}
                            </div>

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

                              {/* Hapus — hanya termin belum terkunci */}
                              {!locked && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTerm(term.id)}
                                  aria-label={`Hapus ${term.name || `termin ${i + 1}`}`}
                                  className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                                >
                                  <TrashBinTrash weight="BoldDuotone" className="size-4" />
                                </button>
                              )}
                            </div>

                            {term.paid > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                Sudah terbayar {fmtRp(term.paid)} (cash-in ter-ack).
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
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

        {/* ── Diskon ── */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            {discountEditing ? (
              <Input
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                className="h-8 max-w-40 rounded-xl"
              />
            ) : (
              <span className="text-sm text-muted-foreground">{discountName}</span>
            )}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  inputMode="numeric"
                  value={discountAmount ? discountAmount.toLocaleString("id-ID") : ""}
                  placeholder="0"
                  onChange={(e) => setDiscountAmount(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
                  className="h-8 w-28 border-0 bg-transparent px-0 tabular-nums shadow-none focus-visible:ring-0"
                />
              </div>
              <button
                type="button"
                onClick={() => setDiscountEditing((v) => !v)}
                aria-label="Edit nama diskon"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pen weight="BoldDuotone" className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Ringkasan reconciliation ── */}
        <div className="rounded-2xl border border-border bg-secondary/30 p-3 text-sm">
          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground">Harga setelah diskon</span>
            <span className="tabular-nums text-foreground">Rp{fmtRp(priceAfterDiscount)}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground">Total cicilan</span>
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
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background pt-4">
        {onPrevious && (
          <Button type="button" variant="outline" className="mr-auto rounded-full" onClick={onPrevious}>
            Sebelumnya
          </Button>
        )}
        <Button
          type="button"
          className="rounded-full"
          disabled={loading}
          onClick={() => { void handleUpdate(); }}
        >
          {loading ? "Menyimpan..." : saveLabel}
        </Button>
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
      packagePrice={data.packagePrice}
      discountName={data.discountName}
      discountAmount={data.discountAmount}
      saveLabel={saveLabel}
      onPrevious={onPrevious}
      onSaved={onSaved}
    />
  );
}
