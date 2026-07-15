"use client";

/**
 * CreatePaymentStep — Step 5 TOP builder untuk create booking wedding.
 *
 * Responsibility: jadwal termin (nama / nominal / jatuh tempo + tambah / hapus /
 * drag-urut + discount name/amount + summary reconciliation) PLUS pencatatan
 * pembayaran inline per-termin (parity dengan edit-top-drawer.tsx TopContent).
 *
 * Pembayaran inline: booking belum punya DB id saat create, jadi cash-in TIDAK
 * dibuat live di sini — datanya dikumpulin lokal (state di booking-drawer) lalu
 * disimpan sebagai Ledger cash-in saat "Create New Booking" (finalize.payments).
 * Tiap termin bayar penuh ke termin-nya sendiri (sama seperti edit).
 *
 * Layout & UX match edit flow (edit-top-drawer.tsx TopContent):
 *  - Card `rounded-2xl border border-border bg-card shadow-sm` per row
 *  - Nominal field Rp prefix inline, tabular-nums
 *  - Date trigger sebagai button class-based (bukan shadcn Button)
 *  - Accordion "Catat Pembayaran Sekaligus" per termin (tanggal / rekening /
 *    bukti / keterangan / Tampilkan di PO)
 *  - Discount section card tersendiri, nama editable via pen-icon toggle
 *  - Summary section `rounded-2xl border border-border bg-secondary/30`
 *  - Footer sticky mini bar 3-kolom (Harga Paket / Input User / Selisih)
 */

import React, { useState } from "react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
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
import {
  AddCircle,
  AlignVerticalSpacing,
  AltArrowDown,
  Calendar as CalendarIcon,
  CheckCircle,
  CloseCircle,
  MoneyBag,
  Pen,
  TrashBinTrash,
  UploadMinimalistic,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

/** One term row (client-side, never persisted directly here). */
export interface CreateTermRow {
  /** Stable client-side id for React keys + drag-drop. */
  uid: string;
  name: string;
  amount: number;
  /** ISO date string with time component (e.g. "2026-07-15T00:00:00.000Z"). */
  dueDate: string;
  sortOrder: number;
}

/**
 * Inline payment satu termin (opsional). Dikumpulin lokal di create; disimpan
 * sebagai Ledger cash-in saat booking dibuat (finalize.payments). Nominal cash-in
 * = nominal termin-nya (bayar penuh), sama seperti inline payment di edit.
 */
export interface CreateInlinePayment {
  /** Accordion pembayaran terbuka untuk termin ini. */
  enabled: boolean;
  /** Tanggal pembayaran, format YYYY-MM-DD. */
  occurredAt: string;
  paymentMethodId: string;
  evidenceFile: File | null;
  notes: string;
  showInPo: boolean;
}

/** Default inline-payment satu termin — accordion auto-kebuka, tanggal = hari ini. */
export function makeCreateInlinePayment(): CreateInlinePayment {
  return {
    enabled: true,
    occurredAt: new Date().toISOString().slice(0, 10),
    paymentMethodId: "",
    evidenceFile: null,
    notes: "",
    showInPo: false,
  };
}

export interface CreatePaymentStepProps {
  terms: CreateTermRow[];
  setTerms: (updater: CreateTermRow[] | ((prev: CreateTermRow[]) => CreateTermRow[])) => void;
  collapsedTerms: Set<string>;
  setCollapsedTerms: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  specialBonusName: string;
  setSpecialBonusName: (v: string | ((prev: string) => string)) => void;
  specialBonusAmount: number;
  setSpecialBonusAmount: (v: number | ((prev: number) => number)) => void;
  /** Recalculate due-dates for empty slots when booking date is known. */
  onAddTerm: () => void;
  /** Gross package price (before discount). */
  packagePrice: number;
  /** Inline payment per-termin (keyed by term uid). Owned by booking-drawer. */
  inlinePayments: Map<string, CreateInlinePayment>;
  updateInlinePayment: (uid: string, patch: Partial<CreateInlinePayment>) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRp(n: number): string {
  return n.toLocaleString("id-ID");
}

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

// ─── Sortable wrapper ──────────────────────────────────────────────────────────

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
      className={cn(isDragging && "relative z-10 opacity-50")}
    >
      {children({ attributes, listeners })}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreatePaymentStep({
  terms,
  setTerms,
  collapsedTerms,
  setCollapsedTerms,
  specialBonusName,
  setSpecialBonusName,
  specialBonusAmount,
  setSpecialBonusAmount,
  onAddTerm,
  packagePrice,
  inlinePayments,
  updateInlinePayment,
}: CreatePaymentStepProps): React.ReactElement {
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);
  const [discountEditing, setDiscountEditing] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const priceAfterDiscount = Math.max(0, packagePrice - specialBonusAmount);
  const totalTerms = terms.reduce((s, t) => s + (t.amount || 0), 0);
  const difference = totalTerms - priceAfterDiscount;

  /** Row terakhir belum diisi — disable tombol Tambah. */
  const lastTerm = terms[terms.length - 1];
  const isLastTermEmpty = lastTerm
    ? !lastTerm.name.trim() || !lastTerm.amount
    : false;

  function toggleTerm(uid: string): void {
    setCollapsedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) { next.delete(uid); } else { next.add(uid); }
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTerms((prev) => {
      const oldIdx = prev.findIndex((t) => t.uid === active.id);
      const newIdx = prev.findIndex((t) => t.uid === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx).map((t, i) => ({ ...t, sortOrder: i }));
    });
  }

  function handleFieldChange(
    uid: string,
    field: "name" | "amount" | "dueDate",
    value: string | number,
  ): void {
    setTerms((prev) => prev.map((t) => (t.uid === uid ? { ...t, [field]: value } : t)));
  }

  function handleDeleteTerm(uid: string): void {
    setTerms((prev) =>
      prev.filter((t) => t.uid !== uid).map((t, i) => ({ ...t, sortOrder: i })),
    );
    setCollapsedTerms((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4">

        {/* ── Info banner ── */}
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          Atur jadwal termin (nama, nominal, jatuh tempo). Pembayaran awal
          (mis. Booking Fee / DP) bisa langsung dicatat per termin di{" "}
          <span className="font-medium text-foreground">Catat Pembayaran Sekaligus</span> —
          tersimpan saat booking dibuat.
        </p>

        {/* ── Daftar termin ── */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={terms.map((t) => t.uid)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2.5">
              {terms.map((term, i) => {
                const isFirstTerm = i === 0;
                const isOpen = !collapsedTerms.has(term.uid);
                return (
                  <SortableTermItem key={term.uid} id={term.uid}>
                    {(drag) => (
                      <Collapsible
                        open={isOpen}
                        onOpenChange={() => toggleTerm(term.uid)}
                        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors"
                      >
                        {/* ── Header: drag handle + trigger + hapus ── */}
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
                                {isFirstTerm && (
                                  <span className="ml-1 text-destructive">*</span>
                                )}
                              </p>
                              {!isOpen && (
                                <p className="text-xs tabular-nums text-muted-foreground">
                                  {term.amount ? `Rp${fmtRp(term.amount)}` : "Rp0"}
                                  {term.dueDate
                                    ? ` · ${format(new Date(term.dueDate), "dd MMM yyyy")}`
                                    : ""}
                                </p>
                              )}
                            </div>
                          </CollapsibleTrigger>

                          {/* Hapus — hanya kalau lebih dari 1 term */}
                          {terms.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTerm(term.uid);
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
                            {/* Nama termin */}
                            <Input
                              value={term.name}
                              placeholder={`Termin ${i + 1}`}
                              onChange={(e) => handleFieldChange(term.uid, "name", e.target.value)}
                              className="h-9 rounded-xl"
                            />

                            {/* Nominal + jatuh tempo */}
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Nominal — Rp prefix inline */}
                              <div className="flex min-w-40 flex-1 items-center gap-1.5 rounded-xl border border-border bg-background px-2.5">
                                <span className="text-xs text-muted-foreground">Rp</span>
                                <Input
                                  inputMode="numeric"
                                  value={term.amount ? term.amount.toLocaleString("id-ID") : ""}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const n =
                                      Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                                    handleFieldChange(term.uid, "amount", n);
                                  }}
                                  className="h-9 border-0 bg-transparent px-0 tabular-nums shadow-none focus-visible:ring-0"
                                />
                              </div>

                              {/* Jatuh tempo — button-based date picker */}
                              <Popover
                                open={datePickerOpen === term.uid}
                                onOpenChange={(o) => setDatePickerOpen(o ? term.uid : null)}
                              >
                                <PopoverTrigger
                                  className={cn(
                                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent",
                                    term.dueDate ? "text-foreground" : "text-muted-foreground",
                                  )}
                                >
                                  <CalendarIcon
                                    weight="BoldDuotone"
                                    className="size-3.5 text-muted-foreground"
                                  />
                                  {term.dueDate
                                    ? format(new Date(term.dueDate), "dd MMM yyyy")
                                    : "Jatuh tempo"}
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={term.dueDate ? new Date(term.dueDate) : undefined}
                                    onSelect={(d) => {
                                      if (d) handleFieldChange(term.uid, "dueDate", toLocalISO(d));
                                      setDatePickerOpen(null);
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>

                            {/* Peringatan nominal wajib untuk term pertama */}
                            {isFirstTerm && (!term.amount || term.amount <= 0) && (
                              <p className="text-xs text-destructive">
                                Nominal term pertama wajib diisi
                              </p>
                            )}

                            {/* ── Catat Pembayaran Sekaligus (opsional) — parity edit ── */}
                            {(() => {
                              const ip = inlinePayments.get(term.uid) ?? makeCreateInlinePayment();
                              const hasInput = !!ip.paymentMethodId;
                              return (
                                <div className="mt-1 rounded-xl border border-dashed border-border/70 bg-muted/20">
                                  <button
                                    type="button"
                                    onClick={() => updateInlinePayment(term.uid, { enabled: !ip.enabled })}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                  >
                                    <MoneyBag
                                      weight="BoldDuotone"
                                      className={cn("size-3.5 shrink-0", hasInput && "text-primary")}
                                    />
                                    <span className="flex-1">Catat Pembayaran Sekaligus</span>
                                    {hasInput && !ip.enabled && (
                                      <Badge variant="secondary" className="shrink-0 gap-1 rounded-full">
                                        <CheckCircle weight="BoldDuotone" className="size-3 text-primary" />
                                        Terisi
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
                                          onChange={(e) => updateInlinePayment(term.uid, { occurredAt: e.target.value })}
                                          className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                      </div>

                                      {/* Via Rekening */}
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Via Rekening</Label>
                                        <BankAccountSelect
                                          value={ip.paymentMethodId}
                                          onChange={(v) => updateInlinePayment(term.uid, { paymentMethodId: v })}
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
                                              onClick={() => updateInlinePayment(term.uid, { evidenceFile: null })}
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
                                              onChange={(e) => updateInlinePayment(term.uid, { evidenceFile: e.target.files?.[0] ?? null })}
                                            />
                                          </label>
                                        )}
                                      </div>

                                      {/* Keterangan */}
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Keterangan (opsional)</Label>
                                        <Textarea
                                          value={ip.notes}
                                          onChange={(e) => updateInlinePayment(term.uid, { notes: e.target.value })}
                                          placeholder="Catatan pembayaran..."
                                          maxLength={500}
                                          rows={2}
                                          className="resize-none rounded-xl text-xs"
                                        />
                                      </div>

                                      {/* Tampilkan di PO */}
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          id={`create-show-in-po-${term.uid}`}
                                          checked={ip.showInPo}
                                          onCheckedChange={(checked) => updateInlinePayment(term.uid, { showInPo: checked })}
                                        />
                                        <Label htmlFor={`create-show-in-po-${term.uid}`} className="cursor-pointer text-xs text-muted-foreground">
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
        <Button
          type="button"
          variant="outline"
          disabled={isLastTermEmpty}
          onClick={onAddTerm}
          className={cn(
            "rounded-full",
            isLastTermEmpty && "cursor-not-allowed opacity-50",
          )}
        >
          <AddCircle weight="BoldDuotone" className="size-4" />
          Tambah Termin
        </Button>

        {/* ── Diskon ── */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-2">
            {/* Label / nama diskon */}
            <div className="flex items-center justify-between gap-2">
              {discountEditing ? (
                <Input
                  value={specialBonusName}
                  onChange={(e) => setSpecialBonusName(e.target.value)}
                  placeholder="Nama diskon"
                  className="h-8 flex-1 rounded-xl"
                />
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {specialBonusName || "Discount"}
                </span>
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
            {/* Nominal diskon */}
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5">
              <span className="text-xs text-muted-foreground">Rp</span>
              <Input
                inputMode="numeric"
                value={specialBonusAmount ? specialBonusAmount.toLocaleString("id-ID") : ""}
                placeholder="0"
                onChange={(e) =>
                  setSpecialBonusAmount(Number(e.target.value.replace(/[^\d]/g, "")) || 0)
                }
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
            <span className="text-destructive">{specialBonusName || "Discount"}</span>
            <span className="tabular-nums text-destructive">− Rp{fmtRp(specialBonusAmount)}</span>
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

        {/* Spacer biar content tidak tertutup sticky footer */}
        <div className="h-2" />
      </div>

      {/* ── Sticky footer: mini price summary ── */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background pt-3">
        <div className="mb-2 grid grid-cols-3 gap-x-2 rounded-xl bg-muted px-3 py-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Harga Paket</span>
            <span className="truncate text-xs font-semibold tabular-nums text-foreground">
              Rp{fmtRp(packagePrice)}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">Input User</span>
            <span className="truncate text-xs font-semibold tabular-nums text-foreground">
              Rp{fmtRp(totalTerms)}
            </span>
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
      </div>
      {/* Note: tidak ada tombol Continue di sini — Continue ada di footer booking-drawer */}
    </div>
  );
}
