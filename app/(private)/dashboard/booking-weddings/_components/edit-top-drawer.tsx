"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { Drawer } from "@/components/shared/drawer";
import { CalendarIcon, ChevronDown, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateTermOfPayments } from "@/actions/term-of-payment";
import { deletePartialPayment } from "@/actions/partial-payment";
import { useQueryClient } from "@tanstack/react-query";

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

const PAYMENT_STATUS = ["paid", "partial", "unpaid"] as const;

interface PartialPayment {
  tempId: string;
  dbId?: string;
  amount: number;
  paidAt: string;
  evidence: File | string | null;
  notes: string;
}

interface Term {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
  paymentStatus: "unpaid" | "paid" | "partial";
  paymentEvidence: string | null;
  notes: string | null;
  partialPayments?: { id: string; amount: number; paidAt: Date | string; evidence: string | null; notes: string | null }[];
}

interface EditTopDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
  initialTerms: Term[];
  packagePrice: number;
  discountName: string | null;
  discountAmount: number;
}

function fmtRp(n: number) {
  return n.toLocaleString("id-ID");
}

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

export function EditTopDrawer({ isOpen, onClose, bookingId, customerName, initialTerms, packagePrice, discountName: initialDiscountName, discountAmount: initialDiscountAmount }: EditTopDrawerProps) {
  const qc = useQueryClient();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [partialPayments, setPartialPayments] = useState<Record<string, PartialPayment[]>>({});
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
  const [_uploading, setUploading] = useState<string | null>(null);

  // Discount state
  const [discountName, setDiscountName] = useState(initialDiscountName ?? "Discount");
  const [discountAmount, setDiscountAmount] = useState(initialDiscountAmount);
  const [discountEditing, setDiscountEditing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, initialTerms, initialDiscountName, initialDiscountAmount]);

  const lockedIds = useMemo(() => initialTerms.filter((t) => t.paymentStatus === "paid").map((t) => t.id), [initialTerms]);
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
      return t.name !== init.name || Number(t.amount) !== Number(init.amount) || t.dueDate !== init.dueDate || t.paymentStatus !== init.paymentStatus || (t.notes ?? "") !== (init.notes ?? "");
    });
  }, [terms, initialTerms, discountName, initialDiscountName, discountAmount, initialDiscountAmount]);

  const handleFieldChange = (id: string, field: keyof Term, value: unknown) => {
    setTerms((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleAddTerm = () => {
    const maxSort = terms.reduce((max, t) => Math.max(max, t.sortOrder), -1);
    setTerms((prev) => [...prev, {
      id: `new-${Date.now()}`,
      name: "",
      amount: 0,
      dueDate: toLocalISO(new Date()),
      sortOrder: maxSort + 1,
      paymentStatus: "unpaid",
      paymentEvidence: null,
      notes: null,
    }]);
  };

  const handleUpdate = async () => {
    for (const t of terms) {
      if (t.paymentStatus === "paid" && !t.paymentEvidence && !pendingFiles[t.id]) {
        toast.error(`${t.name}: Upload bukti bayar dulu sebelum set Paid`);
        return;
      }
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
        const { filePath } = await res.json();
        setTerms((prev) => prev.map((t) => t.id === termId ? { ...t, paymentEvidence: filePath } : t));
      } catch {
        toast.error(`Gagal upload bukti bayar ${file.name}`);
        setLoading(false); setUploading(null);
        return;
      }
      setUploading(null);
    }

    const existingTerms = terms.filter((t) => !t.id.startsWith("new-"));
    const newTerms = terms.filter((t) => t.id.startsWith("new-"));

    const result = await updateTermOfPayments(bookingId, existingTerms.map((t) => ({
      id: t.id, name: t.name, amount: t.amount, dueDate: t.dueDate, paymentStatus: t.paymentStatus, notes: t.notes,
    })), newTerms.map((t) => ({
      name: t.name, amount: t.amount, dueDate: t.dueDate,
    })), { discountName, discountAmount });

    setLoading(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("TOP berhasil diupdate");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Edit TOP - ${customerName}`}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {/* Package price */}
          <div>
            <span className={cn("text-sm", "font-medium", "text-gray-700")}>Total Harga Package</span>
            <Input disabled value={`Rp${fmtRp(priceAfterDiscount)}`} className="mt-1" />
          </div>

          {/* Discount */}
          <div className={cn("flex", "flex-col", "gap-2", "border-y", "py-4")}>
            <div className={cn("flex", "items-center", "gap-2")}>
              <Input
                placeholder="Nama bonus (e.g. Discount)"
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                disabled={!discountEditing}
                className={cn("border-0", "p-0", "text-sm", "font-medium", "text-gray-700", "bg-transparent", "shadow-none", "focus-visible:ring-0", "h-auto")}
              />
              <button type="button" onClick={() => setDiscountEditing((p) => !p)} className={cn("shrink-0", "text-muted-foreground", "hover:text-foreground")}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              placeholder="IDR. 0"
              value={discountAmount ? fmtRp(discountAmount) : ""}
              onChange={(e) => setDiscountAmount(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
              inputMode="numeric"
              disabled={!discountEditing}
              className="rounded-none"
            />
            {discountEditing && (
              <p className={cn("text-xs", "text-gray-500")}>Edit discount lalu klik Update untuk menyimpan.</p>
            )}
          </div>

          {/* Terms */}
          <div>
            <span className={cn("text-sm", "font-medium", "text-gray-700", "mb-2", "block")}>Term of Payments</span>
            <div className="space-y-4">
              {terms.map((term, idx) => {
                const locked = lockedIds.includes(term.id);
                const isNew = term.id.startsWith("new-");
                return (
                  <div key={term.id} className="space-y-2">
                    {/* Term name — inline editable */}
                    <div className={cn("flex", "items-center", "gap-2")}>
                      <Input
                        value={term.name}
                        onChange={(e) => handleFieldChange(term.id, "name", e.target.value)}
                        placeholder="Term name"
                        disabled={locked}
                        className={cn("border-0", "p-0", "text-sm", "font-medium", "text-gray-700", "bg-transparent", "shadow-none", "focus-visible:ring-0", "h-auto")}
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        {!isNew && (
                          <Select value={term.paymentStatus} onValueChange={(v) => handleFieldChange(term.id, "paymentStatus", v)} disabled={locked}>
                            <SelectTrigger className="w-24 h-7">
                              <span className={cn("text-xs font-semibold", term.paymentStatus === "paid" ? "text-foreground" : "text-muted-foreground")}>
                                {term.paymentStatus.charAt(0).toUpperCase() + term.paymentStatus.slice(1)}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_STATUS.map((s) => (
                                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {terms.length > 1 && !locked && (
                          <button type="button" onClick={() => setTerms((prev) => prev.filter((t) => t.id !== term.id))} className={cn("text-red-400", "hover:text-red-600", "shrink-0")}>
                            <Trash2 className={cn("h-3.5", "w-3.5")} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Amount + Date row */}
                    <div className={cn("flex", "gap-3", "items-center")}>
                      <div className="flex-2">
                        <Input
                          value={term.amount ? fmtRp(term.amount) : ""}
                          onChange={(e) => handleFieldChange(term.id, "amount", parseInt(e.target.value.replace(/\D/g, "")) || 0)}
                          placeholder="IDR. 0"
                          inputMode="numeric"
                          disabled={locked}
                        />
                      </div>
                      <div className="flex-1">
                        <Popover>
                          <PopoverTrigger render={
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !term.dueDate && "text-muted-foreground")} disabled={locked}>
                              <CalendarIcon className={cn("mr-2", "h-4", "w-4")} />
                              {term.dueDate ? format(new Date(term.dueDate), "dd MMM yyyy") : "Select Date"}
                            </Button>
                          } />
                          <PopoverContent className={cn("w-auto", "p-0")} align="start">
                            <Calendar
                              mode="single"
                              captionLayout="dropdown"
                              selected={term.dueDate ? new Date(term.dueDate) : undefined}
                              onSelect={(date) => handleFieldChange(term.id, "dueDate", date ? date.toISOString() : "")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Upload evidence — all statuses except partial (partial has its own per sub-payment) */}
                    {term.paymentStatus !== "partial" && !locked && !isNew && (
                      <div className={cn("relative", "flex", "items-center", "gap-2", "px-3", "py-2", "border", "rounded-md", "bg-muted/30", "text-muted-foreground", "cursor-pointer", "hover:bg-muted/50", "text-xs")}>
                        {(() => {
                          const evidenceSrc = pendingFiles[term.id] ?? term.paymentEvidence;
                          if (evidenceSrc) {
                            return (
                              <EvidencePreview src={evidenceSrc} onOpen={() => {
                                const file = pendingFiles[term.id];
                                if (file) { const url = URL.createObjectURL(file); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); }
                                else if (term.paymentEvidence) { window.open(toFullUrl(term.paymentEvidence), "_blank"); }
                              }} />
                            );
                          }
                          return <FileText className={cn("h-3.5", "w-3.5", "shrink-0")} />;
                        })()}
                        {(pendingFiles[term.id] || term.paymentEvidence) ? (
                          <button type="button" className={cn("relative", "z-10", "flex-1", "truncate", "text-left", "hover:underline")} onClick={(e) => { e.stopPropagation(); const file = pendingFiles[term.id]; if (file) { const url = URL.createObjectURL(file); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); } else if (term.paymentEvidence) { window.open(toFullUrl(term.paymentEvidence), "_blank"); } }}>{pendingFiles[term.id]?.name ?? term.paymentEvidence?.split("/").pop()}</button>
                        ) : (
                          <span className={cn("flex-1", "truncate")}>Upload bukti pembayaran</span>
                        )}
                        {(pendingFiles[term.id] || term.paymentEvidence) && (
                          <button type="button" className={cn("shrink-0", "hover:text-destructive", "z-10", "relative")} onClick={() => { setPendingFiles((prev) => { const n = { ...prev }; delete n[term.id]; return n; }); handleFieldChange(term.id, "paymentEvidence", null); }}><X className="h-3 w-3" /></button>
                        )}
                        <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.files?.[0]) setPendingFiles((prev) => ({ ...prev, [term.id]: e.target.files![0] })); e.target.value = ""; }} />
                      </div>
                    )}

                    {/* Partial payments */}
                    {term.paymentStatus === "partial" && !isNew && (() => {
                      const payments = partialPayments[term.id] ?? [];
                      const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
                      const remaining = term.amount - totalPaid;
                      const isExpanded = expandedTerms.has(term.id);
                      const toggleExpand = () => setExpandedTerms((prev) => { const next = new Set(prev); if (next.has(term.id)) { next.delete(term.id); } else { next.add(term.id); } return next; });
                      return (
                        <div className="space-y-2">
                          <button type="button" onClick={toggleExpand} className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground hover:text-foreground">
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                            <span>Pembayaran Partial ({payments.length})</span>
                            <span className={cn("ml-auto font-medium", remaining > 0 ? "text-orange-600" : remaining === 0 ? "text-foreground" : "text-destructive")}>Sisa: Rp{fmtRp(Math.abs(remaining))}{remaining === 0 ? " ✓" : ""}</span>
                          </button>
                          {isExpanded && (
                          <div className="space-y-2 ml-2 pl-3 border-l-2 border-gray-200">
                          {payments.map((p, pi) => (
                            <div key={p.tempId} className="space-y-1.5 bg-gray-50 rounded-md p-2.5">
                              {/* Row 1: # + Nominal + Date + Delete */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500 shrink-0">#{pi + 1}</span>
                                <Input value={p.amount ? fmtRp(p.amount) : ""} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, "")) || 0; setPartialPayments((prev) => ({ ...prev, [term.id]: (prev[term.id] ?? []).map((x) => x.tempId === p.tempId ? { ...x, amount: n } : x) })); }} placeholder="Nominal" inputMode="numeric" className="h-7 text-xs flex-1" />
                                <Popover>
                                  <PopoverTrigger render={<Button variant="outline" className={cn("h-7 text-xs px-2", !p.paidAt && "text-muted-foreground")}><CalendarIcon className="h-3 w-3 mr-1" />{p.paidAt ? format(new Date(p.paidAt), "dd MMM yy") : "Tgl"}</Button>} />
                                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" selected={p.paidAt ? new Date(p.paidAt) : undefined} onSelect={(d) => setPartialPayments((prev) => ({ ...prev, [term.id]: (prev[term.id] ?? []).map((x) => x.tempId === p.tempId ? { ...x, paidAt: d ? toLocalISO(d) : "" } : x) }))} /></PopoverContent>
                                </Popover>
                                <button type="button" className="text-red-400 hover:text-red-600 shrink-0" onClick={async () => { if (p.dbId) { const r = await deletePartialPayment(p.dbId); if (!r.success) { toast.error(r.error); return; } toast.success("Pembayaran dihapus"); } setPartialPayments((prev) => ({ ...prev, [term.id]: (prev[term.id] ?? []).filter((x) => x.tempId !== p.tempId) })); }}><Trash2 className="h-3 w-3" /></button>
                              </div>
                              {/* Row 2: Upload bukti */}
                              <div className={cn("relative", "flex", "items-center", "gap-2", "px-2", "py-1.5", "border", "rounded-md", "bg-white", "text-muted-foreground", "cursor-pointer", "hover:bg-muted/30", "text-xs")}>
                                {p.evidence ? (
                                  <EvidencePreview src={p.evidence} onOpen={() => {
                                    if (typeof p.evidence === "string") { window.open(toFullUrl(p.evidence), "_blank"); }
                                    else if (p.evidence) { const url = URL.createObjectURL(p.evidence); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); }
                                  }} />
                                ) : (
                                  <FileText className="h-3 w-3 shrink-0" />
                                )}
                                {p.evidence ? (
                                  <button type="button" className="relative z-10 flex-1 truncate text-left hover:underline" onClick={(e) => { e.stopPropagation(); if (typeof p.evidence === "string") { window.open(toFullUrl(p.evidence), "_blank"); } else if (p.evidence) { const url = URL.createObjectURL(p.evidence); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); } }}>{typeof p.evidence === "string" ? p.evidence.split("/").pop() : p.evidence.name}</button>
                                ) : (
                                  <span className="flex-1 truncate">Upload bukti pembayaran</span>
                                )}
                                {p.evidence && <button type="button" className="shrink-0 hover:text-destructive z-10 relative" onClick={() => setPartialPayments((prev) => ({ ...prev, [term.id]: (prev[term.id] ?? []).map((x) => x.tempId === p.tempId ? { ...x, evidence: null } : x) }))}><X className="h-2.5 w-2.5" /></button>}
                                <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPartialPayments((prev) => ({ ...prev, [term.id]: (prev[term.id] ?? []).map((x) => x.tempId === p.tempId ? { ...x, evidence: f } : x) })); e.target.value = ""; }} />
                              </div>
                              {/* Row 3: Catatan */}
                              <Textarea value={p.notes} onChange={(e) => setPartialPayments((prev) => ({ ...prev, [term.id]: (prev[term.id] ?? []).map((x) => x.tempId === p.tempId ? { ...x, notes: e.target.value } : x) }))} placeholder="Catatan..." rows={2} className="text-xs resize-none" />
                            </div>
                          ))}
                          <div className="flex items-center justify-end">
                            <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setPartialPayments((prev) => ({ ...prev, [term.id]: [...(prev[term.id] ?? []), { tempId: `new-${Date.now()}`, amount: 0, paidAt: toLocalISO(new Date()), evidence: null, notes: "" }] }))}><Plus className="h-3 w-3" /> Tambah Pembayaran</button>
                          </div>
                          </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Locked paid — show evidence read-only */}
                    {locked && term.paymentEvidence && (
                      <div className={cn("flex", "items-center", "gap-2", "px-3", "py-2", "border", "rounded-md", "bg-secondary", "text-foreground", "text-xs", "cursor-pointer")} onClick={() => window.open(toFullUrl(term.paymentEvidence!), "_blank")}>
                        <EvidencePreview src={term.paymentEvidence} onOpen={() => window.open(toFullUrl(term.paymentEvidence!), "_blank")} />
                        <span className={cn("flex-1", "truncate", "hover:underline")}>{term.paymentEvidence.split("/").pop()}</span>
                      </div>
                    )}

                    {/* Divider */}
                    {idx < terms.length - 1 && <div className={cn("border-b", "border-gray-100", "pt-1")} />}
                  </div>
                );
              })}
            </div>

            {/* Add button */}
            <div className={cn("flex", "gap-2", "mt-4")}>
              <Button type="button" variant="outline" className="flex-1" onClick={handleAddTerm} disabled={loading}>
                Tambah Payment
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className={cn("p-3", "bg-gray-50", "rounded-lg")}>
            <div className={cn("flex", "justify-between", "items-center", "mb-2")}>
              <span className={cn("text-sm", "font-medium", "text-gray-700")}>Harga Paket:</span>
              <span className={cn("text-sm", "font-medium", "text-gray-700")}>Rp{fmtRp(packagePrice)}</span>
            </div>
            <div className={cn("flex", "justify-between", "items-center", "mb-2")}>
              <span className={cn("text-sm", "font-medium", "text-red-600")}>{discountName || "Discount"}:</span>
              <span className={cn("text-sm", "font-medium", "text-red-600")}>- Rp{fmtRp(discountAmount)}</span>
            </div>
            <div className={cn("flex", "justify-between", "items-center", "mb-2", "border-t", "pt-2")}>
              <span className={cn("text-sm", "font-medium", "text-gray-700")}>Harga Setelah Discount:</span>
              <span className={cn("text-sm", "font-medium", "text-gray-700")}>Rp{fmtRp(priceAfterDiscount)}</span>
            </div>
            <div className={cn("flex", "justify-between", "items-center", "mb-2")}>
              <span className={cn("text-sm", "font-medium", "text-gray-700")}>Total Input:</span>
              <span className={cn("text-sm", "font-medium", "text-gray-700")}>Rp{fmtRp(totalTerms)}</span>
            </div>
            <div className={cn("flex", "justify-between", "items-center")}>
              <span className={cn("text-sm", "font-medium", "text-gray-700")}>Selisih:</span>
              <span className={cn("text-sm font-medium", difference !== 0 ? "text-red-600" : "text-foreground")}>
                Rp{fmtRp(Math.abs(difference))}{difference < 0 ? " (Kurang)" : difference > 0 ? " (Lebih)" : " (Sesuai)"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white pt-4">
          <Button className="w-full" onClick={handleUpdate} disabled={loading || !isChanged}>
            {loading ? "Updating..." : "Update"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
