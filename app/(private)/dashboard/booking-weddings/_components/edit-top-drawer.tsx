"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { Drawer } from "@/components/shared/drawer";
import {
  Calendar as CalendarIcon,
  AltArrowDown,
  FileText,
  Pen,
  AddCircle,
  TrashBinTrash,
  CloseCircle,
  CheckCircle,
  AlignVerticalSpacing,
  Copy,
  TagPrice,
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
import { deletePartialPayment } from "@/actions/partial-payment";
import { useQueryClient } from "@tanstack/react-query";
import { useBookingFinanceDetail } from "@/hooks/use-booking-finance-detail";
import {
  EvidencePreview,
  PAYMENT_STATUS,
  fmtRp,
  toFullUrl,
  toLocalISO,
  type FinanceTerm,
  type PartialPayment,
} from "./edit-finance-shared";

/* ─── Sortable Term wrapper ───────────────────────────────────────────────────
 * Provides the draggable container + drag-handle props for one TOP row. The row
 * body stays inline in TopContent (render-prop) so it keeps access to all the
 * local state closures without threading dozens of props through.
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

/* ─── TOP Content ─────────────────────────────────────────────────────────── */

interface TopContentProps {
  bookingId: string;
  initialTerms: FinanceTerm[];
  packagePrice: number;
  discountName: string | null;
  discountAmount: number;
  saveLabel?: string;
  onPrevious?: () => void;
  /** When provided, called after a successful save instead of leaving the drawer
   *  open — used by the edit-booking continue flow to advance to the next step.
   *  Omitted in standalone usage (Finance AR / row menu), where the drawer stays open. */
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
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [partialPayments, setPartialPayments] = useState<Record<string, PartialPayment[]>>({});
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
  const [_uploading, setUploading] = useState<string | null>(null);
  // Payment method (bank tujuan) per term — UI-only for now, keyed by term id.
  const [termPaymentMethods, setTermPaymentMethods] = useState<Record<string, string>>({});
  // Accordion: which term cards are collapsed (paid/locked terms start collapsed).
  const [collapsedTerms, setCollapsedTerms] = useState<Set<string>>(new Set());
  // Which locked (paid/acknowledged) terms the user explicitly unlocked to edit.
  const [unlockedTerms, setUnlockedTerms] = useState<Set<string>>(new Set());
  function toggleCollapse(id: string): void {
    setCollapsedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
  function toggleUnlock(id: string): void {
    setUnlockedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const [discountName, setDiscountName] = useState(initialDiscountName ?? "Discount");
  const [discountAmount, setDiscountAmount] = useState(initialDiscountAmount);
  const [discountEditing, setDiscountEditing] = useState(false);

  // Reset when the booking data actually changes (drawer re-opened with different booking).
  // We compare by content fingerprint rather than by reference so that a TanStack Query
  // background refetch that returns the same data (new array object, same IDs/values)
  // does NOT clobber the user's in-progress drag reorder.
  const prevFingerprintRef = useRef<string>("");
  useEffect(() => {
    const fingerprint = JSON.stringify({
      terms: initialTerms.map((t) => ({ id: t.id, name: t.name, amount: Number(t.amount), dueDate: t.dueDate, sortOrder: t.sortOrder, paymentStatus: t.paymentStatus })),
      discountName: initialDiscountName ?? "Discount",
      discountAmount: initialDiscountAmount,
    });
    if (fingerprint === prevFingerprintRef.current) return; // same data — preserve user edits (inc. drag order)
    prevFingerprintRef.current = fingerprint;
    queueMicrotask(() => {
      setTerms(initialTerms.map((t) => ({ ...t, amount: Number(t.amount) })));
      setPendingFiles({});
      setPartialPayments(() => {
        const map: Record<string, PartialPayment[]> = {};
        for (const t of initialTerms) {
          if (t.partialPayments?.length) {
            map[t.id] = t.partialPayments.map((p, i) => ({
              tempId: `db-${p.id}-${i}`,
              dbId: p.id,
              amount: p.amount,
              paidAt: new Date(p.paidAt).toISOString(),
              evidence: p.evidence,
              notes: p.notes ?? "",
            }));
          }
        }
        return map;
      });
      // Seed per-term payment method from saved data (includes backfilled bank for old terms).
      setTermPaymentMethods(
        Object.fromEntries(
          initialTerms
            .filter((t) => t.paymentMethodId)
            .map((t) => [t.id, t.paymentMethodId as string]),
        ),
      );
      setExpandedTerms(new Set());
      // Collapse paid / acknowledged / refund terms by default — they're settled,
      // so the card starts compact; active (unpaid) terms stay expanded.
      setCollapsedTerms(
        new Set(
          initialTerms
            .filter(
              (t) =>
                t.paymentStatus === "paid" ||
                t.paymentStatus === "refund" ||
                t.ackStatus === "acknowledged",
            )
            .map((t) => t.id),
        ),
      );
      setUnlockedTerms(new Set());
      setDiscountName(initialDiscountName ?? "Discount");
      setDiscountAmount(initialDiscountAmount);
      setDiscountEditing(false);
    });
  }, [initialTerms, initialDiscountName, initialDiscountAmount]);

  // Term is locked when paid, acknowledged by finance, OR a system refund term
  const lockedIds = useMemo(
    () =>
      initialTerms
        .filter(
          (t) =>
            t.paymentStatus === "paid" ||
            t.paymentStatus === "refund" ||
            t.ackStatus === "acknowledged",
        )
        .map((t) => t.id),
    [initialTerms],
  );

  // Promo state (multi-select). One payment nominal (uang masuk / cashflow) drives
  // every promo's potongan; each potongan can be overridden manually per promo.
  const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);
  const [promoOpen, setPromoOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [promoOverrides, setPromoOverrides] = useState<Record<string, number>>({});
  const selectedPromos = DUMMY_PROMOS.filter((p) => selectedPromoIds.includes(p.id));
  function togglePromo(id: string): void {
    setSelectedPromoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    // Drop any manual override when a promo is unselected so it recomputes fresh next time.
    setPromoOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  function computePotongan(p: (typeof DUMMY_PROMOS)[number], payment: number): number {
    return p.discountType === "PERCENTAGE"
      ? Math.round((payment || 0) * p.discountValue / 100)
      : p.discountValue; // nominal flat, tidak tergantung pembayaran
  }
  function potonganOf(p: (typeof DUMMY_PROMOS)[number]): number {
    return promoOverrides[p.id] ?? computePotongan(p, paymentAmount);
  }
  const totalPromo = selectedPromos.reduce((s, p) => s + potonganOf(p), 0);

  const priceAfterDiscount = Math.max(0, packagePrice - discountAmount);
  // Refund terms are a separate reconciliation, not a billable term — exclude
  // them from the total so the difference reflects the actual billing pool.
  const totalTerms = terms
    .filter((t) => t.paymentStatus !== "refund")
    .reduce((s, t) => s + (t.amount || 0), 0);
  const difference = totalTerms - priceAfterDiscount;

  const isChanged = useMemo(() => {
    if (terms.length !== initialTerms.length) return true;
    if (discountName !== (initialDiscountName ?? "Discount")) return true;
    if (discountAmount !== initialDiscountAmount) return true;
    // Compare by ID order to detect drag reorder (position change) in addition to field edits.
    // We check both: same id at same array index AND field-level changes.
    const initById = new Map(initialTerms.map((t) => [t.id, t]));
    // Order changed if any term appears at a different position than in initialTerms
    const orderChanged = terms.some((t, i) => initialTerms[i]?.id !== t.id);
    if (orderChanged) return true;
    return terms.some((t) => {
      const init = initById.get(t.id);
      if (!init) return true; // new term
      return (
        t.name !== init.name ||
        Number(t.amount) !== Number(init.amount) ||
        t.dueDate !== init.dueDate ||
        t.paymentStatus !== init.paymentStatus ||
        (t.notes ?? "") !== (init.notes ?? "")
      );
    });
  }, [terms, initialTerms, discountName, initialDiscountName, discountAmount, initialDiscountAmount]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTerms((prev) => {
      const oldIdx = prev.findIndex((t) => t.id === active.id);
      const newIdx = prev.findIndex((t) => t.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleFieldChange = (id: string, field: keyof FinanceTerm, value: unknown) => {
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleAddTerm = () => {
    const maxSort = terms.reduce((max, t) => Math.max(max, t.sortOrder), -1);
    setTerms((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        amount: 0,
        dueDate: toLocalISO(new Date()),
        sortOrder: maxSort + 1,
        paymentStatus: "unpaid",
        ackStatus: null,
        paymentEvidence: null,
        notes: null,
      },
    ]);
  };

  const handleUpdate = async () => {
    for (const t of terms) {
      if (t.paymentStatus === "paid" && !t.paymentEvidence && !pendingFiles[t.id]) {
        toast.error(`${t.name}: Upload bukti bayar dulu sebelum set Paid`);
        return;
      }
    }
    const firstTerm = terms[0];
    if (firstTerm && (!firstTerm.amount || firstTerm.amount <= 0)) {
      toast.error(`Nominal ${firstTerm.name || "term pertama"} wajib diisi dan harus lebih dari 0.`);
      return;
    }

    setLoading(true);

    // Upload evidence for EXISTING terms (they already have a stable DB id).
    // New terms (id "new-…") are handled AFTER the save below, once the server has
    // assigned them real ids — otherwise their evidence would be silently dropped.
    for (const [termId, file] of Object.entries(pendingFiles)) {
      if (termId.startsWith("new-")) continue;
      setUploading(termId);
      const fd = new FormData();
      fd.set("bookingId", bookingId);
      fd.set("termId", termId);
      fd.set("file", file);
      try {
        const res = await fetch("/api/bookings/upload-evidence", { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        const { filePath } = await res.json() as { filePath: string };
        setTerms((prev) =>
          prev.map((t) => (t.id === termId ? { ...t, paymentEvidence: filePath } : t)),
        );
      } catch {
        toast.error(`Gagal upload bukti bayar ${file.name}`);
        setLoading(false);
        setUploading(null);
        return;
      }
      setUploading(null);
    }

    // Refund terms are system-managed — never send them back as updates. We tag
    // each remaining term with its current position in the on-screen list so the
    // server persists the post-drag order as sortOrder (display-only, no approval).
    const orderedEditable = terms
      .map((t, i) => ({ term: t, sortOrder: i }))
      .filter((x) => x.term.paymentStatus !== "refund");
    const existingTerms = orderedEditable.filter((x) => !x.term.id.startsWith("new-"));
    const newTerms = orderedEditable.filter((x) => x.term.id.startsWith("new-"));

    const result = await updateTermOfPayments(
      bookingId,
      existingTerms.map(({ term: t, sortOrder }) => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        dueDate: t.dueDate,
        paymentStatus: t.paymentStatus as "unpaid" | "paid" | "partial",
        notes: t.notes,
        paymentMethodId: termPaymentMethods[t.id] ?? null,
        sortOrder,
      })),
      newTerms.map(({ term: t, sortOrder }) => ({
        name: t.name,
        amount: t.amount,
        dueDate: t.dueDate,
        paymentMethodId: termPaymentMethods[t.id] ?? null,
        sortOrder,
      })),
      { discountName, discountAmount },
    );

    if (!result.success) {
      setLoading(false);
      toast.error(result.error);
      return;
    }

    // Upload evidence for NEWLY-created terms. The server assigned each a stable id;
    // previously this was skipped entirely, so a new paid term's proof was lost
    // without any error. (C-03)
    //
    // Robust matching: the brand-new DB rows are exactly those whose id was NOT
    // present before the save (excludes existing + refund terms, so a refund term's
    // sortOrder can't be mistaken for a new term's). We then align new DB rows to our
    // new client terms by ascending sortOrder — unique among the new set.
    const newTermsWithFile = newTerms.filter(({ term: t }) => pendingFiles[t.id]);
    if (newTermsWithFile.length > 0) {
      try {
        const knownIds = new Set(terms.filter((t) => !t.id.startsWith("new-")).map((t) => t.id));
        const res = await fetch(`/api/bookings/${bookingId}/terms`);
        if (!res.ok) throw new Error("fetch terms failed");
        const dbTerms = (await res.json()) as Array<{ id: string; sortOrder: number }>;
        const freshDbId = new Map(
          dbTerms.filter((r) => !knownIds.has(r.id)).map((r) => [r.sortOrder, r.id]),
        );

        for (const { term: t, sortOrder } of newTermsWithFile) {
          const dbId = freshDbId.get(sortOrder);
          const file = pendingFiles[t.id];
          if (!dbId || !file) continue;
          setUploading(t.id);
          const fd = new FormData();
          fd.set("bookingId", bookingId);
          fd.set("termId", dbId);
          fd.set("file", file);
          const up = await fetch("/api/bookings/upload-evidence", { method: "POST", body: fd });
          if (!up.ok) throw new Error(`upload failed for ${t.name}`);
          setUploading(null);
        }
      } catch {
        setUploading(null);
        setLoading(false);
        // The terms themselves are saved; only the new-term evidence upload failed.
        toast.error("Term tersimpan, tapi bukti bayar term baru gagal di-upload. Buka lagi & upload ulang.");
        qc.invalidateQueries({ queryKey: ["bookings"] });
        qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
        return;
      }
    }

    setLoading(false);
    toast.success("TOP berhasil diupdate");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
    // Continue flow: advance to the next step. Standalone usage omits onSaved, so
    // the drawer stays open and the user closes it manually.
    onSaved?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 px-1">
        {/* Package price */}
        <div>
          <span className="text-sm font-medium text-foreground">Total Harga Package</span>
          <Input disabled value={`Rp${fmtRp(priceAfterDiscount)}`} className="mt-1 w-full" />
        </div>

        {/* Discount */}
        <div className="flex flex-col gap-2 border-y py-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nama bonus (e.g. Discount)"
              value={discountName}
              onChange={(e) => setDiscountName(e.target.value)}
              disabled={!discountEditing}
              className="border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto w-full"
            />
            <button
              type="button"
              onClick={() => setDiscountEditing((p) => !p)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Pen weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <Input
            placeholder="IDR. 0"
            value={discountAmount ? fmtRp(discountAmount) : ""}
            onChange={(e) =>
              setDiscountAmount(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
            }
            inputMode="numeric"
            disabled={!discountEditing}
            className="rounded-none w-full"
          />
          {discountEditing && (
            <p className="text-xs text-muted-foreground">
              Edit discount lalu klik Update untuk menyimpan.
            </p>
          )}
        </div>

        {/* Promo Program — hidden until wired to real DB (discount_programs table) */}
        {false && <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Program Discount</label>
          <Popover open={promoOpen} onOpenChange={setPromoOpen}>
            <PopoverTrigger
              className={cn(
                "w-full flex items-center justify-between rounded-xl border bg-background px-3 h-10 text-sm shadow-sm transition-colors hover:bg-accent",
                selectedPromoIds.length === 0 && "text-muted-foreground",
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <TagPrice weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
                {selectedPromoIds.length === 0 ? (
                  <span>Pilih program...</span>
                ) : (
                  <span className="text-foreground">{selectedPromoIds.length} program dipilih</span>
                )}
              </div>
              <AltArrowDown weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />
            </PopoverTrigger>
            <PopoverContent className="p-0 w-72" align="start">
              <Command>
                <CommandInput placeholder="Cari program..." />
                <CommandList>
                  <CommandEmpty>Program tidak ditemukan.</CommandEmpty>
                  <CommandGroup>
                    {DUMMY_PROMOS.map((p) => {
                      const isSelected = selectedPromoIds.includes(p.id);
                      return (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => togglePromo(p.id)}
                        >
                          <div className="flex items-start gap-2 w-full py-0.5">
                            <TagPrice weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{p.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                                  {p.discountType === "PERCENTAGE" ? `${p.discountValue}%` : `Rp ${(p.discountValue / 1_000_000).toFixed(1)}jt`}
                                </Badge>
                                {p.minTransaction > 0 && (
                                  <span className="text-xs text-muted-foreground">min. Rp{(p.minTransaction / 1_000_000).toFixed(0)}jt</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                s/d {p.periodEnd.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            {isSelected && <CheckCircle weight="BoldDuotone" className="ml-auto h-4 w-4 text-primary shrink-0 mt-0.5" />}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Nominal Pembayaran — one input for all promos (uang masuk / cashflow) */}
          {selectedPromos.length > 0 && (
            <div className="mt-3">
              <label className="text-sm font-medium text-foreground mb-1 block">Nominal Pembayaran</label>
              <Input
                value={paymentAmount ? fmtRp(paymentAmount) : ""}
                onChange={(e) =>
                  setPaymentAmount(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
                }
                placeholder="IDR. 0"
                inputMode="numeric"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">Uang masuk dari client (cashflow)</p>
            </div>
          )}

          {/* Promo Cards (one per selected program) */}
          {selectedPromos.length > 0 && (
            <div className="mt-3 space-y-2">
              {selectedPromos.map((p) => (
                <div key={p.id} className="rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <TagPrice weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="default">
                            {p.discountType === "PERCENTAGE"
                              ? `${p.discountValue}%`
                              : `Rp ${(p.discountValue / 1_000_000).toFixed(1)} jt`}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => togglePromo(p.id)}
                            className="rounded-full p-0.5 hover:bg-muted transition-colors"
                          >
                            <CloseCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {p.minTransaction > 0 && (
                          <p>Min. transaksi: Rp {(p.minTransaction / 1_000_000).toFixed(0)} jt</p>
                        )}
                        <p>
                          Berlaku:{" "}
                          {p.periodStart.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} -{" "}
                          {p.periodEnd.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>

                      {/* Potongan — auto dari pembayaran, bisa override manual */}
                      <div className="mt-2 pt-2 border-t">
                        <label className="text-xs font-medium text-foreground mb-1 block">Potongan</label>
                        <Input
                          value={potonganOf(p) ? fmtRp(potonganOf(p)) : ""}
                          onChange={(e) =>
                            setPromoOverrides((prev) => ({
                              ...prev,
                              [p.id]: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                            }))
                          }
                          placeholder="IDR. 0"
                          inputMode="numeric"
                          className="w-full h-8 text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.discountType === "PERCENTAGE"
                            ? `${p.discountValue}% × Rp${fmtRp(paymentAmount)} = Rp${fmtRp(computePotongan(p, paymentAmount))}`
                            : "Nominal tetap"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* Terms */}
        <div>
          <span className="text-sm font-medium text-foreground mb-2 block">Term of Payments</span>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={terms.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {terms.map((term, idx) => {
              const locked = lockedIds.includes(term.id);
              const isAcknowledged = term.ackStatus === "acknowledged";
              const isRefund = term.paymentStatus === "refund";
              const isNew = term.id.startsWith("new-");
              const isDP = idx === 0;
              const isDPInvalid = isDP && (!term.amount || term.amount <= 0);
              const isLockable = lockedIds.includes(term.id);
              const isUnlocked = unlockedTerms.has(term.id);
              const collapsed = collapsedTerms.has(term.id);
              const statusLabel =
                term.paymentStatus.charAt(0).toUpperCase() + term.paymentStatus.slice(1);
              return (
                <SortableTermItem key={term.id} id={term.id}>
                  {({ attributes, listeners }) => (
                <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                  {/* Accordion header — click toggles collapse */}
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/40 transition-colors"
                    onClick={() => toggleCollapse(term.id)}
                  >
                    <button
                      type="button"
                      {...attributes}
                      {...listeners}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-grab active:cursor-grabbing touch-none"
                      tabIndex={-1}
                      aria-label="Drag to reorder"
                    >
                      <AlignVerticalSpacing weight="BoldDuotone" className="h-4 w-4" />
                    </button>
                    <AltArrowDown
                      weight="BoldDuotone"
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        !collapsed && "rotate-180",
                      )}
                    />
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {term.name || "Term"}
                      </span>
                      {isDP && (
                        <span className="text-destructive text-xs font-medium shrink-0">*</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Status badge */}
                      {isRefund ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-[var(--brand-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--brand-gold)]">
                          Refund
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium",
                            term.paymentStatus === "paid"
                              ? "bg-muted text-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isAcknowledged && <CheckCircle weight="BoldDuotone" className="h-3 w-3" />}
                          {isAcknowledged ? "Acknowledged" : statusLabel}
                        </span>
                      )}
                      {/* Edit-paid pencil toggle — only for locked terms */}
                      {isLockable && !isRefund && (
                        <button
                          type="button"
                          onClick={() => toggleUnlock(term.id)}
                          className={cn(
                            "shrink-0 rounded-lg p-1.5 transition-colors",
                            isUnlocked
                              ? "text-[var(--brand-gold)] bg-[var(--brand-gold)]/10"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                          aria-label={isUnlocked ? "Kunci term" : "Edit term"}
                        >
                          <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {/* Delete */}
                      {terms.length > 1 && !locked && (
                        <button
                          type="button"
                          onClick={() =>
                            setTerms((prev) => prev.filter((t) => t.id !== term.id))
                          }
                          className="text-muted-foreground hover:text-destructive shrink-0 flex items-center justify-center h-8 w-8"
                        >
                          <TrashBinTrash
                            weight="BoldDuotone"
                            className="h-4 w-4 text-muted-foreground"
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Accordion body */}
                  {!collapsed && (
                  <div className="px-3 pb-3 space-y-2 border-t pt-3">
                  {/* Term name — inline editable (+ status select for existing terms) */}
                  {!isRefund && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={term.name}
                        onChange={(e) => handleFieldChange(term.id, "name", e.target.value)}
                        placeholder="Term name"
                        disabled={locked}
                        className="border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto w-full"
                      />
                      {!isNew && (
                        <Select
                          value={term.paymentStatus}
                          onValueChange={(v) => handleFieldChange(term.id, "paymentStatus", v)}
                          disabled={locked}
                        >
                          <SelectTrigger className="w-24 h-7 shrink-0">
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                term.paymentStatus === "paid"
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {statusLabel}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_STATUS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Amount + Date row */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 sm:items-center">
                    <div className="w-full sm:flex-2">
                      <Input
                        value={term.amount ? fmtRp(term.amount) : ""}
                        onChange={(e) =>
                          handleFieldChange(
                            term.id,
                            "amount",
                            parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                          )
                        }
                        placeholder="IDR. 0"
                        inputMode="numeric"
                        disabled={locked}
                        className="w-full"
                      />
                    </div>
                    <div className="w-full sm:flex-1">
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !term.dueDate && "text-muted-foreground",
                              )}
                              disabled={locked}
                            >
                              <CalendarIcon
                                weight="BoldDuotone"
                                className={cn("mr-2", "h-4", "w-4", "text-muted-foreground")}
                              />
                              {term.dueDate
                                ? format(new Date(term.dueDate), "dd MMM yyyy")
                                : "Select Date"}
                            </Button>
                          }
                        />
                        <PopoverContent className={cn("w-auto", "p-0")} align="start">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            selected={term.dueDate ? new Date(term.dueDate) : undefined}
                            onSelect={(date) =>
                              handleFieldChange(
                                term.id,
                                "dueDate",
                                date ? toLocalISO(date) : "",
                              )
                            }
                            fromYear={new Date().getFullYear() - 10}
                            toYear={new Date().getFullYear() + 10}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Payment method (bank tujuan) per term */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Metode Pembayaran
                    </label>
                    <BankAccountSelect
                      value={termPaymentMethods[term.id] ?? ""}
                      onChange={(v) =>
                        setTermPaymentMethods((prev) => ({ ...prev, [term.id]: v }))
                      }
                      placeholder="Pilih metode pembayaran"
                      disabled={locked}
                      crossVenue
                      disableAdd
                    />
                  </div>

                  {/* Upload evidence */}
                  {term.paymentStatus !== "partial" && !locked && !isNew && (
                    <div
                      className={cn(
                        "relative",
                        "flex",
                        "items-center",
                        "gap-2",
                        "px-3",
                        "py-2",
                        "border",
                        "rounded-md",
                        "bg-muted/30",
                        "text-muted-foreground",
                        "cursor-pointer",
                        "hover:bg-muted/50",
                        "text-xs",
                      )}
                    >
                      {(() => {
                        const evidenceSrc = pendingFiles[term.id] ?? term.paymentEvidence;
                        if (evidenceSrc) {
                          return (
                            <EvidencePreview
                              src={evidenceSrc}
                              onOpen={() => {
                                const file = pendingFiles[term.id];
                                if (file) {
                                  const url = URL.createObjectURL(file);
                                  window.open(url, "_blank");
                                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                                } else if (term.paymentEvidence) {
                                  window.open(toFullUrl(term.paymentEvidence), "_blank");
                                }
                              }}
                            />
                          );
                        }
                        return (
                          <FileText
                            weight="BoldDuotone"
                            className={cn(
                              "h-3.5",
                              "w-3.5",
                              "shrink-0",
                              "text-muted-foreground",
                            )}
                          />
                        );
                      })()}
                      {pendingFiles[term.id] || term.paymentEvidence ? (
                        <button
                          type="button"
                          className={cn(
                            "relative",
                            "z-10",
                            "flex-1",
                            "truncate",
                            "text-left",
                            "hover:underline",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            const file = pendingFiles[term.id];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              window.open(url, "_blank");
                              setTimeout(() => URL.revokeObjectURL(url), 10000);
                            } else if (term.paymentEvidence) {
                              window.open(toFullUrl(term.paymentEvidence), "_blank");
                            }
                          }}
                        >
                          {pendingFiles[term.id]?.name ??
                            term.paymentEvidence?.split("/").pop()}
                        </button>
                      ) : (
                        <span className={cn("flex-1", "truncate")}>Upload bukti pembayaran</span>
                      )}
                      {(pendingFiles[term.id] || term.paymentEvidence) && (
                        <button
                          type="button"
                          className={cn(
                            "shrink-0",
                            "hover:text-destructive",
                            "z-10",
                            "relative",
                          )}
                          onClick={() => {
                            setPendingFiles((prev) => {
                              const n = { ...prev };
                              delete n[term.id];
                              return n;
                            });
                            handleFieldChange(term.id, "paymentEvidence", null);
                          }}
                        >
                          <CloseCircle weight="BoldDuotone" className="h-3 w-3" />
                        </button>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setPendingFiles((prev) => ({
                              ...prev,
                              [term.id]: e.target.files![0],
                            }));
                          }
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}

                  {/* Partial payments */}
                  {term.paymentStatus === "partial" &&
                    !isNew &&
                    (() => {
                      const payments = partialPayments[term.id] ?? [];
                      const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
                      const remaining = term.amount - totalPaid;
                      const isExpanded = expandedTerms.has(term.id);
                      const toggleExpand = () =>
                        setExpandedTerms((prev) => {
                          const next = new Set(prev);
                          if (next.has(term.id)) {
                            next.delete(term.id);
                          } else {
                            next.add(term.id);
                          }
                          return next;
                        });
                      return (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={toggleExpand}
                            className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground hover:text-foreground"
                          >
                            <AltArrowDown
                              weight="BoldDuotone"
                              className={cn(
                                "h-3.5 w-3.5 transition-transform",
                                isExpanded && "rotate-180",
                              )}
                            />
                            <span>Pembayaran Partial ({payments.length})</span>
                            <span
                              className={cn(
                                "ml-auto font-medium",
                                remaining > 0
                                  ? "text-muted-foreground"
                                  : remaining === 0
                                    ? "text-foreground"
                                    : "text-destructive",
                              )}
                            >
                              Sisa: Rp{fmtRp(Math.abs(remaining))}
                              {remaining === 0 ? " ✓" : ""}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="space-y-2 ml-2 pl-3 border-l-2 border-border">
                              {payments.map((p, pi) => (
                                <div
                                  key={p.tempId}
                                  className="space-y-1.5 bg-muted/50 rounded-md p-2.5"
                                >
                                  {/* Row 1: # + Nominal + Date + Delete */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                                      #{pi + 1}
                                    </span>
                                    <Input
                                      value={p.amount ? fmtRp(p.amount) : ""}
                                      onChange={(e) => {
                                        const n =
                                          parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                                        setPartialPayments((prev) => ({
                                          ...prev,
                                          [term.id]: (prev[term.id] ?? []).map((x) =>
                                            x.tempId === p.tempId ? { ...x, amount: n } : x,
                                          ),
                                        }));
                                      }}
                                      placeholder="Nominal"
                                      inputMode="numeric"
                                      className="h-8 text-xs flex-1 min-w-0"
                                    />
                                    <Popover>
                                      <PopoverTrigger
                                        render={
                                          <Button
                                            variant="outline"
                                            className={cn(
                                              "h-8 text-xs px-2 shrink-0",
                                              !p.paidAt && "text-muted-foreground",
                                            )}
                                          >
                                            <CalendarIcon
                                              weight="BoldDuotone"
                                              className="h-3 w-3 mr-1 text-muted-foreground"
                                            />
                                            {p.paidAt
                                              ? format(new Date(p.paidAt), "dd MMM yy")
                                              : "Tgl"}
                                          </Button>
                                        }
                                      />
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          captionLayout="dropdown"
                                          selected={
                                            p.paidAt ? new Date(p.paidAt) : undefined
                                          }
                                          onSelect={(d) =>
                                            setPartialPayments((prev) => ({
                                              ...prev,
                                              [term.id]: (prev[term.id] ?? []).map((x) =>
                                                x.tempId === p.tempId
                                                  ? { ...x, paidAt: d ? toLocalISO(d) : "" }
                                                  : x,
                                              ),
                                            }))
                                          }
                                        />
                                      </PopoverContent>
                                    </Popover>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive shrink-0 flex items-center justify-center min-h-8 min-w-8"
                                      onClick={async () => {
                                        if (p.dbId) {
                                          const r = await deletePartialPayment(p.dbId);
                                          if (!r.success) {
                                            toast.error(r.error);
                                            return;
                                          }
                                          toast.success("Pembayaran dihapus");
                                        }
                                        setPartialPayments((prev) => ({
                                          ...prev,
                                          [term.id]: (prev[term.id] ?? []).filter(
                                            (x) => x.tempId !== p.tempId,
                                          ),
                                        }));
                                      }}
                                    >
                                      <TrashBinTrash
                                        weight="BoldDuotone"
                                        className="h-3.5 w-3.5 text-muted-foreground"
                                      />
                                    </button>
                                  </div>
                                  {/* Row 2: Upload bukti */}
                                  <div
                                    className={cn(
                                      "relative",
                                      "flex",
                                      "items-center",
                                      "gap-2",
                                      "px-2",
                                      "py-1.5",
                                      "border",
                                      "rounded-md",
                                      "bg-background",
                                      "text-muted-foreground",
                                      "cursor-pointer",
                                      "hover:bg-muted/30",
                                      "text-xs",
                                    )}
                                  >
                                    {p.evidence ? (
                                      <EvidencePreview
                                        src={p.evidence}
                                        onOpen={() => {
                                          if (typeof p.evidence === "string") {
                                            window.open(toFullUrl(p.evidence), "_blank");
                                          } else if (p.evidence) {
                                            const url = URL.createObjectURL(p.evidence);
                                            window.open(url, "_blank");
                                            setTimeout(() => URL.revokeObjectURL(url), 10000);
                                          }
                                        }}
                                      />
                                    ) : (
                                      <FileText
                                        weight="BoldDuotone"
                                        className="h-3 w-3 shrink-0 text-muted-foreground"
                                      />
                                    )}
                                    {p.evidence ? (
                                      <button
                                        type="button"
                                        className="relative z-10 flex-1 truncate text-left hover:underline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (typeof p.evidence === "string") {
                                            window.open(toFullUrl(p.evidence), "_blank");
                                          } else if (p.evidence) {
                                            const url = URL.createObjectURL(p.evidence);
                                            window.open(url, "_blank");
                                            setTimeout(() => URL.revokeObjectURL(url), 10000);
                                          }
                                        }}
                                      >
                                        {typeof p.evidence === "string"
                                          ? p.evidence.split("/").pop()
                                          : p.evidence.name}
                                      </button>
                                    ) : (
                                      <span className="flex-1 truncate">
                                        Upload bukti pembayaran
                                      </span>
                                    )}
                                    {p.evidence && (
                                      <button
                                        type="button"
                                        className="shrink-0 hover:text-destructive z-10 relative"
                                        onClick={() =>
                                          setPartialPayments((prev) => ({
                                            ...prev,
                                            [term.id]: (prev[term.id] ?? []).map((x) =>
                                              x.tempId === p.tempId
                                                ? { ...x, evidence: null }
                                                : x,
                                            ),
                                          }))
                                        }
                                      >
                                        <CloseCircle
                                          weight="BoldDuotone"
                                          className="h-2.5 w-2.5"
                                        />
                                      </button>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*,application/pdf"
                                      className="absolute inset-0 opacity-0 cursor-pointer"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                          setPartialPayments((prev) => ({
                                            ...prev,
                                            [term.id]: (prev[term.id] ?? []).map((x) =>
                                              x.tempId === p.tempId
                                                ? { ...x, evidence: f }
                                                : x,
                                            ),
                                          }));
                                        }
                                        e.target.value = "";
                                      }}
                                    />
                                  </div>
                                  {/* Row 3: Catatan */}
                                  <Textarea
                                    value={p.notes}
                                    onChange={(e) =>
                                      setPartialPayments((prev) => ({
                                        ...prev,
                                        [term.id]: (prev[term.id] ?? []).map((x) =>
                                          x.tempId === p.tempId
                                            ? { ...x, notes: e.target.value }
                                            : x,
                                        ),
                                      }))
                                    }
                                    placeholder="Catatan..."
                                    rows={2}
                                    className="text-xs resize-none"
                                  />
                                </div>
                              ))}
                              <div className="flex items-center justify-end">
                                <button
                                  type="button"
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setPartialPayments((prev) => ({
                                      ...prev,
                                      [term.id]: [
                                        ...(prev[term.id] ?? []),
                                        {
                                          tempId: `new-${Date.now()}`,
                                          amount: 0,
                                          paidAt: toLocalISO(new Date()),
                                          evidence: null,
                                          notes: "",
                                        },
                                      ],
                                    }))
                                  }
                                >
                                  <AddCircle
                                    weight="BoldDuotone"
                                    className="h-3 w-3 text-muted-foreground"
                                  />
                                  Tambah Pembayaran
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  {/* Locked — show evidence read-only */}
                  {locked && term.paymentEvidence && (
                    <div
                      className={cn(
                        "flex",
                        "items-center",
                        "gap-2",
                        "px-3",
                        "py-2",
                        "border",
                        "rounded-md",
                        "bg-secondary",
                        "text-foreground",
                        "text-xs",
                        "cursor-pointer",
                      )}
                      onClick={() => window.open(toFullUrl(term.paymentEvidence!), "_blank")}
                    >
                      <EvidencePreview
                        src={term.paymentEvidence}
                        onOpen={() => window.open(toFullUrl(term.paymentEvidence!), "_blank")}
                      />
                      <span className={cn("flex-1", "truncate", "hover:underline")}>
                        {term.paymentEvidence.split("/").pop()}
                      </span>
                    </div>
                  )}

                  {isDPInvalid && (
                    <p className="text-xs text-destructive">Nominal DP wajib diisi</p>
                  )}
                  </div>
                  )}
                </div>
                  )}
                </SortableTermItem>
              );
            })}
          </div>
            </SortableContext>
          </DndContext>

          {/* Add button */}
          <div className={cn("flex", "gap-2", "mt-4")}>
            <Button
              type="button"
              variant="outline"
              className={cn("flex-1", "border-dashed", "bg-muted/20")}
              onClick={handleAddTerm}
              disabled={loading}
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-2 text-muted-foreground" />
              Tambah Payment
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">Harga Paket:</span>
            <span className="text-sm font-medium text-foreground">Rp{fmtRp(packagePrice)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-destructive">
              {discountName || "Discount"}:
            </span>
            <span className="text-sm font-medium text-destructive">
              - Rp{fmtRp(discountAmount)}
            </span>
          </div>
          {false && totalPromo > 0 && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-[var(--brand-gold)]">Potongan Promo:</span>
              <span className="text-sm font-medium text-[var(--brand-gold)]">
                - Rp{fmtRp(totalPromo)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center mb-2 border-t pt-2">
            <span className="text-sm font-medium text-foreground">Harga Setelah Discount:</span>
            <span className="text-sm font-medium text-foreground">
              Rp{fmtRp(priceAfterDiscount)}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">Total Input:</span>
            <span className="text-sm font-medium text-foreground">Rp{fmtRp(totalTerms)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-foreground">Selisih:</span>
            <span
              className={cn(
                "text-sm font-medium",
                difference !== 0 ? "text-destructive" : "text-foreground",
              )}
            >
              Rp{fmtRp(Math.abs(difference))}
              {difference < 0 ? " (Kurang)" : difference > 0 ? " (Lebih)" : " (Sesuai)"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-background pt-4">
        {/* Mini price summary — Harga Paket | Input User | Selisih */}
        <div className="rounded-xl bg-muted px-3 py-2 mb-2 grid grid-cols-3 gap-x-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-muted-foreground">Harga Paket</span>
            <span className="text-xs font-semibold text-foreground truncate">Rp{fmtRp(priceAfterDiscount)}</span>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-muted-foreground">Input User</span>
            <span className="text-xs font-semibold text-foreground truncate">Rp{fmtRp(totalTerms)}</span>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-muted-foreground">Selisih</span>
            <span
              className={cn("flex items-center gap-1 text-xs font-semibold truncate", difference !== 0 ? "text-destructive cursor-pointer" : "text-foreground")}
              onClick={() => {
                if (difference !== 0) {
                  navigator.clipboard.writeText(fmtRp(Math.abs(difference)));
                  toast.success("Selisih disalin");
                }
              }}
            >
              {difference === 0 ? "Sesuai" : (
                <>
                  {`${difference < 0 ? "-" : "+"} Rp${fmtRp(Math.abs(difference))}`}
                  <Copy weight="BoldDuotone" className="h-3 w-3 shrink-0" />
                </>
              )}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {onPrevious && (
            <Button variant="outline" className="flex-1" onClick={onPrevious}>
              Previous
            </Button>
          )}
          <Button
            className={onPrevious ? "flex-1" : "w-full"}
            onClick={handleUpdate}
            disabled={loading || !isChanged}
          >
            {loading ? "Menyimpan..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Dummy Promo Data ──────────────────────────────────────────────────────── */

const DUMMY_PROMOS = [
  {
    id: "promo-1",
    name: "June Surprise",
    discountType: "PERCENTAGE" as const,
    discountValue: 10,
    minTransaction: 30_000_000,
    periodStart: new Date("2026-06-01"),
    periodEnd: new Date("2026-06-30"),
  },
  {
    id: "promo-2",
    name: "Early Bird Q3",
    discountType: "NOMINAL" as const,
    discountValue: 5_000_000,
    minTransaction: 50_000_000,
    periodStart: new Date("2026-07-01"),
    periodEnd: new Date("2026-09-30"),
  },
];

/* ─── EditTopDrawer (props-langsung) ──────────────────────────────────────── */

export interface EditTopDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
  initialTerms: FinanceTerm[];
  packagePrice: number;
  discountName: string | null;
  discountAmount: number;
}

export function EditTopDrawer({
  isOpen,
  onClose,
  bookingId,
  customerName,
  initialTerms,
  packagePrice,
  discountName,
  discountAmount,
}: EditTopDrawerProps): React.ReactElement {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Term of Payment — ${customerName}`}>
      <TopContent
        bookingId={bookingId}
        initialTerms={initialTerms}
        packagePrice={packagePrice}
        discountName={discountName}
        discountAmount={discountAmount}
      />
    </Drawer>
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
 * continue flow). `active` gates the fetch (was `isOpen`).
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
  /** Continue flow only: advance to the next step after a successful save.
   *  Standalone usage (Finance AR / row menu) omits it and the drawer stays open. */
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

  return (
    <TopContent
      bookingId={data.id}
      initialTerms={data.terms}
      packagePrice={data.packagePrice}
      discountName={data.discountName}
      discountAmount={data.discountAmount}
      saveLabel={saveLabel}
      onPrevious={onPrevious}
      onSaved={onSaved}
    />
  );
}
