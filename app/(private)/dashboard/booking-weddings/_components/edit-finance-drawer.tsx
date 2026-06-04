"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { updateTermOfPayments } from "@/actions/term-of-payment";
import { deletePartialPayment } from "@/actions/partial-payment";
import { updatePackagePrices } from "@/actions/package-prices";
import { useQueryClient } from "@tanstack/react-query";
import { useBookingFinanceDetail } from "@/hooks/use-booking-finance-detail";

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function toFullUrl(raw: string): string {
  if (raw.startsWith("http")) return raw;
  return R2_BASE ? `${R2_BASE}/${raw}` : raw;
}

function EvidencePreview({ src, onOpen }: { src: File | string; onOpen: () => void }) {
  const [prev, setPrev] = useState(src);
  const [url, setUrl] = useState<string | null>(() => {
    if (typeof src === "string") return toFullUrl(src);
    return src.type.startsWith("image/") ? URL.createObjectURL(src) : null;
  });

  if (prev !== src) {
    if (url && typeof prev !== "string") URL.revokeObjectURL(url);
    if (typeof src === "string") {
      setUrl(toFullUrl(src));
    } else {
      setUrl(src.type.startsWith("image/") ? URL.createObjectURL(src) : null);
    }
    setPrev(src);
  }

  useEffect(() => () => { if (url && typeof prev !== "string") URL.revokeObjectURL(url); }, [url, prev]);

  if (!url) return null;
  const isImage = typeof src === "string" ? /\.(webp|jpe?g|png|gif)(\?|$)/i.test(src) : src.type.startsWith("image/");
  if (!isImage) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="relative z-10 h-10 w-10 object-cover rounded border shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpen(); }} />;
}

function fmtRp(n: number): string {
  return n.toLocaleString("id-ID");
}

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

const PAYMENT_STATUS = ["paid", "partial", "unpaid"] as const;

interface PartialPayment {
  tempId: string;
  dbId?: string;
  amount: number;
  paidAt: string;
  evidence: File | string | null;
  notes: string;
}

export interface FinanceTerm {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
  paymentStatus: "unpaid" | "paid" | "partial";
  ackStatus: string | null;
  paymentEvidence: string | null;
  notes: string | null;
  partialPayments?: {
    id: string;
    amount: number;
    paidAt: Date | string;
    evidence: string | null;
    notes: string | null;
  }[];
}

export interface FinanceCategoryRow {
  id: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
  isTakeout: boolean;
}

export interface EditBookingFinanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
  // TOP tab
  initialTerms: FinanceTerm[];
  packagePrice: number;
  discountName: string | null;
  discountAmount: number;
  // Set Harga tab (optional — tab hidden when null/empty)
  initialCategories: FinanceCategoryRow[] | null;
  margin: number;
  defaultTab?: "top" | "takeout";
}

/* ─── TOP Content ─────────────────────────────────────────────────────────── */

interface TopContentProps {
  bookingId: string;
  initialTerms: FinanceTerm[];
  packagePrice: number;
  discountName: string | null;
  discountAmount: number;
}

function TopContent({
  bookingId,
  initialTerms,
  packagePrice,
  discountName: initialDiscountName,
  discountAmount: initialDiscountAmount,
}: TopContentProps): React.ReactElement {
  const qc = useQueryClient();
  const [terms, setTerms] = useState<FinanceTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [partialPayments, setPartialPayments] = useState<Record<string, PartialPayment[]>>({});
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
  const [_uploading, setUploading] = useState<string | null>(null);

  const [discountName, setDiscountName] = useState(initialDiscountName ?? "Discount");
  const [discountAmount, setDiscountAmount] = useState(initialDiscountAmount);
  const [discountEditing, setDiscountEditing] = useState(false);

  // Reset when initialTerms changes (drawer re-opened with different booking)
  useEffect(() => {
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
      setExpandedTerms(new Set());
      setDiscountName(initialDiscountName ?? "Discount");
      setDiscountAmount(initialDiscountAmount);
      setDiscountEditing(false);
    });
  }, [initialTerms, initialDiscountName, initialDiscountAmount]);

  // Term is locked when paid OR acknowledged by finance
  const lockedIds = useMemo(
    () =>
      initialTerms
        .filter((t) => t.paymentStatus === "paid" || t.ackStatus === "acknowledged")
        .map((t) => t.id),
    [initialTerms],
  );

  const priceAfterDiscount = Math.max(0, packagePrice - discountAmount);
  const totalTerms = terms.reduce((s, t) => s + (t.amount || 0), 0);
  const difference = totalTerms - priceAfterDiscount;

  const isChanged = useMemo(() => {
    if (terms.length !== initialTerms.length) return true;
    if (discountName !== (initialDiscountName ?? "Discount")) return true;
    if (discountAmount !== initialDiscountAmount) return true;
    return terms.some((t, i) => {
      const init = initialTerms[i];
      if (!init) return true;
      return (
        t.name !== init.name ||
        Number(t.amount) !== Number(init.amount) ||
        t.dueDate !== init.dueDate ||
        t.paymentStatus !== init.paymentStatus ||
        (t.notes ?? "") !== (init.notes ?? "")
      );
    });
  }, [terms, initialTerms, discountName, initialDiscountName, discountAmount, initialDiscountAmount]);

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
    const dpTerm = terms.find((t) => t.name.trim().toUpperCase() === "DP");
    if (dpTerm && (!dpTerm.amount || dpTerm.amount <= 0)) {
      toast.error("Nominal DP wajib diisi dan harus lebih dari 0.");
      return;
    }

    setLoading(true);

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

    const existingTerms = terms.filter((t) => !t.id.startsWith("new-"));
    const newTerms = terms.filter((t) => t.id.startsWith("new-"));

    const result = await updateTermOfPayments(
      bookingId,
      existingTerms.map((t) => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        dueDate: t.dueDate,
        paymentStatus: t.paymentStatus,
        notes: t.notes,
      })),
      newTerms.map((t) => ({ name: t.name, amount: t.amount, dueDate: t.dueDate })),
      { discountName, discountAmount },
    );

    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("TOP berhasil diupdate");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    // Drawer stays open — user closes manually
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

        {/* Terms */}
        <div>
          <span className="text-sm font-medium text-foreground mb-2 block">Term of Payments</span>
          <div className="space-y-4">
            {terms.map((term, idx) => {
              const locked = lockedIds.includes(term.id);
              const isAcknowledged = term.ackStatus === "acknowledged";
              const isNew = term.id.startsWith("new-");
              const isDP = term.name.trim().toUpperCase() === "DP";
              const isDPInvalid = isDP && (!term.amount || term.amount <= 0);
              return (
                <div key={term.id} className="space-y-2">
                  {/* Term name — inline editable */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 flex-1 min-w-0">
                      <Input
                        value={term.name}
                        onChange={(e) => handleFieldChange(term.id, "name", e.target.value)}
                        placeholder="Term name"
                        disabled={locked}
                        className="border-0 p-0 text-sm font-medium text-foreground bg-transparent shadow-none focus-visible:ring-0 h-auto w-full"
                      />
                      {isDP && (
                        <span className="text-destructive text-xs font-medium shrink-0">*</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Acknowledged badge */}
                      {isAcknowledged && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <CheckCircle weight="BoldDuotone" className="h-3 w-3" />
                          Acknowledged
                        </span>
                      )}
                      {!isNew && (
                        <Select
                          value={term.paymentStatus}
                          onValueChange={(v) => handleFieldChange(term.id, "paymentStatus", v)}
                          disabled={locked}
                        >
                          <SelectTrigger className="w-24 h-7">
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                term.paymentStatus === "paid"
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {term.paymentStatus.charAt(0).toUpperCase() +
                                term.paymentStatus.slice(1)}
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
                      {terms.length > 1 && !locked && (
                        <button
                          type="button"
                          onClick={() =>
                            setTerms((prev) => prev.filter((t) => t.id !== term.id))
                          }
                          className="text-muted-foreground hover:text-destructive shrink-0 flex items-center justify-center min-h-9 min-w-9"
                        >
                          <TrashBinTrash
                            weight="BoldDuotone"
                            className="h-4 w-4 text-muted-foreground"
                          />
                        </button>
                      )}
                    </div>
                  </div>

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
                                date ? date.toISOString() : "",
                              )
                            }
                            fromYear={new Date().getFullYear() - 10}
                            toYear={new Date().getFullYear() + 10}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
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
                  {/* Divider */}
                  {idx < terms.length - 1 && <div className="border-b border-border pt-1" />}
                </div>
              );
            })}
          </div>

          {/* Add button */}
          <div className={cn("flex", "gap-2", "mt-4")}>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleAddTerm}
              disabled={loading}
            >
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
        <Button
          className="w-full"
          onClick={handleUpdate}
          disabled={loading || !isChanged}
        >
          {loading ? "Updating..." : "Update"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Set Harga Content ───────────────────────────────────────────────────── */

function calcDisplayPrice(
  categories: FinanceCategoryRow[],
  toggles: Record<string, boolean>,
  margin: number,
): number {
  const base = categories.reduce(
    (sum, c) => sum + (!c.isShow || !toggles[c.id] ? c.basePrice : 0),
    0,
  );
  return base + Math.round(base * (margin / 100));
}

interface SetHargaContentProps {
  bookingId: string;
  initialCategories: FinanceCategoryRow[];
  margin: number;
}

function SetHargaContent({
  bookingId,
  initialCategories,
  margin,
}: SetHargaContentProps): React.ReactElement {
  const qc = useQueryClient();
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    () => Object.fromEntries(initialCategories.map((c) => [c.id, c.isTakeout])),
  );
  const [loading, setLoading] = useState(false);

  const visibleCategories = initialCategories.filter((c) => c.isShow);
  const currentPrice = calcDisplayPrice(initialCategories, toggles, margin);
  const hasIncluded = initialCategories.some((c) => !toggles[c.id]);

  const handleSave = async () => {
    if (!hasIncluded) {
      toast.error("Minimal satu kategori harus tetap included.");
      return;
    }
    setLoading(true);
    const result = await updatePackagePrices({
      bookingId,
      categoryToggles: visibleCategories.map((c) => ({
        id: c.id,
        isTakeout: toggles[c.id] ?? false,
      })),
    });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menyimpan.");
      return;
    }
    toast.success("Package prices berhasil diupdate.");
    await qc.invalidateQueries({ queryKey: ["bookings"] });
    // Drawer stays open — user closes manually
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 px-1">
        <p className="text-xs text-muted-foreground">
          Tandai kategori sebagai takeout jika klien menyediakan sendiri. Harga otomatis berkurang
          dan term of payments disesuaikan.
        </p>
        {visibleCategories.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Tidak ada kategori harga untuk booking ini.
          </p>
        )}
        <div className="space-y-2">
          {visibleCategories.map((cat) => {
            const isTakeout = toggles[cat.id] ?? false;
            return (
              <div
                key={cat.id}
                className={cn("flex items-center justify-between rounded-lg border p-3")}
              >
                <div>
                  <p className="text-sm font-medium">{cat.categoryName}</p>
                  <p className="text-xs text-muted-foreground">Rp{fmtRp(cat.basePrice)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs",
                      isTakeout ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {isTakeout ? "Takeout" : "Included"}
                  </span>
                  <Switch
                    checked={isTakeout}
                    onCheckedChange={(v) =>
                      setToggles((prev) => ({ ...prev, [cat.id]: v }))
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-lg bg-muted/30 p-3 space-y-1 mt-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Harga setelah takeout</span>
            <span className="font-semibold">Rp{fmtRp(currentPrice)}</span>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 bg-background pt-4">
        <Button className="w-full" onClick={handleSave} disabled={loading || !hasIncluded}>
          {loading ? "Menyimpan..." : "Update Package Prices"}
        </Button>
      </div>
    </div>
  );
}

/* ─── EditBookingFinanceDrawer ────────────────────────────────────────────── */

export function EditBookingFinanceDrawer({
  isOpen,
  onClose,
  bookingId,
  customerName,
  initialTerms,
  packagePrice,
  discountName,
  discountAmount,
  initialCategories,
  margin,
  defaultTab = "top",
}: EditBookingFinanceDrawerProps): React.ReactElement {
  const hasTakeoutData =
    initialCategories !== null && initialCategories.length > 0;

  // Force defaultTab to "top" if no takeout data
  const resolvedDefaultTab = hasTakeoutData ? defaultTab : "top";

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Keuangan Booking — ${customerName}`}
    >
      <Tabs
        defaultValue={resolvedDefaultTab}
        className="flex flex-col h-full gap-0"
      >
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="top" className="flex-1">
            Term of Payment
          </TabsTrigger>
          {hasTakeoutData && (
            <TabsTrigger value="takeout" className="flex-1">
              Set Takeout
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="top" className="flex-1 min-h-0 overflow-hidden">
          <TopContent
            bookingId={bookingId}
            initialTerms={initialTerms}
            packagePrice={packagePrice}
            discountName={discountName}
            discountAmount={discountAmount}
          />
        </TabsContent>

        {hasTakeoutData && (
          <TabsContent value="takeout" className="flex-1 min-h-0 overflow-hidden">
            <SetHargaContent
              bookingId={bookingId}
              initialCategories={initialCategories}
              margin={margin}
            />
          </TabsContent>
        )}
      </Tabs>
    </Drawer>
  );
}

/* ─── EditBookingFinanceDrawerById ────────────────────────────────────────────
 * Lazy-loading variant: fetches booking finance detail on open.
 * Used by Finance AR table — avoids over-fetching in AR list query.
 * ─────────────────────────────────────────────────────────────────────────── */

export interface EditBookingFinanceDrawerByIdProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
  defaultTab?: "top" | "takeout";
}

export function EditBookingFinanceDrawerById({
  isOpen,
  onClose,
  bookingId,
  customerName,
  defaultTab = "top",
}: EditBookingFinanceDrawerByIdProps): React.ReactElement {
  const { data, isLoading, error } = useBookingFinanceDetail(isOpen ? bookingId : null);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Keuangan Booking — ${customerName}`}
    >
      {isLoading && (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          Memuat data...
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center justify-center h-32 text-sm text-destructive">
          Gagal memuat data. Coba tutup dan buka kembali.
        </div>
      )}
      {data && !isLoading && (
        <Tabs defaultValue={defaultTab} className="flex flex-col h-full gap-0">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="top" className="flex-1">
              Term of Payment
            </TabsTrigger>
            {data.categories !== null && data.categories.length > 0 && (
              <TabsTrigger value="takeout" className="flex-1">
                Set Takeout
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="top" className="flex-1 min-h-0 overflow-hidden">
            <TopContent
              bookingId={data.id}
              initialTerms={data.terms}
              packagePrice={data.packagePrice}
              discountName={data.discountName}
              discountAmount={data.discountAmount}
            />
          </TabsContent>

          {data.categories !== null && data.categories.length > 0 && (
            <TabsContent value="takeout" className="flex-1 min-h-0 overflow-hidden">
              <SetHargaContent
                bookingId={data.id}
                initialCategories={data.categories}
                margin={data.margin}
              />
            </TabsContent>
          )}
        </Tabs>
      )}
    </Drawer>
  );
}
