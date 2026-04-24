"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Drawer } from "@/components/shared/drawer";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateTermOfPayments, addTermOfPayment } from "@/actions/term-of-payment";
import { useQueryClient } from "@tanstack/react-query";

const PAYMENT_STATUS = ["paid", "partial", "unpaid"] as const;

interface Term {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
  paymentStatus: "unpaid" | "paid" | "partial";
  paymentEvidence: string | null;
  notes: string | null;
}

interface EditTopDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
  initialTerms: Term[];
  packagePrice: number;
}

function fmtRp(n: number) {
  return n.toLocaleString("id-ID");
}

export function EditTopDrawer({ isOpen, onClose, bookingId, customerName, initialTerms, packagePrice }: EditTopDrawerProps) {
  const qc = useQueryClient();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addDate, setAddDate] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTerms(initialTerms.map((t) => ({ ...t, amount: Number(t.amount) })));
      setShowAdd(false); setAddName(""); setAddAmount(""); setAddDate("");
      setPendingFiles({});
    }
  }, [isOpen, initialTerms]);

  const lockedIds = useMemo(() => initialTerms.filter((t) => t.paymentStatus === "paid").map((t) => t.id), [initialTerms]);
  const totalAmount = terms.reduce((s, t) => s + (t.amount || 0), 0);
  const paidAmount = terms.filter((t) => t.paymentStatus === "paid").reduce((s, t) => s + (t.amount || 0), 0);
  const sisaBayar = packagePrice - paidAmount;

  const isChanged = useMemo(() => {
    if (terms.length !== initialTerms.length) return true;
    return terms.some((t, i) => {
      const init = initialTerms[i];
      return Number(t.amount) !== Number(init.amount) || t.dueDate !== init.dueDate || t.paymentStatus !== init.paymentStatus || (t.notes ?? "") !== (init.notes ?? "");
    });
  }, [terms, initialTerms]);

  const handleFieldChange = (id: string, field: keyof Term, value: unknown) => {
    setTerms((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleUpdate = async () => {
    // Validate: paid terms must have evidence
    for (const t of terms) {
      if (t.paymentStatus === "paid" && !t.paymentEvidence && !pendingFiles[t.id]) {
        toast.error(`${t.name}: Upload bukti bayar dulu sebelum set Paid`);
        return;
      }
    }

    setLoading(true);

    // Upload pending files first
    for (const [termId, file] of Object.entries(pendingFiles)) {
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

    const result = await updateTermOfPayments(bookingId, terms.map((t) => ({
      id: t.id, amount: t.amount, dueDate: t.dueDate, paymentStatus: t.paymentStatus, notes: t.notes,
    })));
    setLoading(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("TOP berhasil diupdate");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    onClose();
  };

  const handleAddSkema = async () => {
    if (!addName.trim() || !addDate) { toast.error("Nama dan tanggal wajib diisi"); return; }
    setLoading(true);
    const result = await addTermOfPayment(bookingId, { name: addName.trim(), amount: parseInt(addAmount.replace(/\D/g, "")) || 0, dueDate: new Date(addDate).toISOString() });
    setLoading(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Skema ditambahkan");
    setShowAdd(false); setAddName(""); setAddAmount(""); setAddDate("");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Edit TOP - ${customerName}`}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {/* Summary */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#7D8B9E] font-semibold">{terms.length} Skema Pembayaran</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#7D8B9E] font-semibold">Harga Package :</span>
              <span className="font-semibold">IDR. {fmtRp(packagePrice)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#7D8B9E] font-semibold">Total Input :</span>
              <span className="font-semibold">IDR. {fmtRp(totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#7D8B9E] font-semibold">Sisa Bayar :</span>
              <span className="font-semibold text-red-600">IDR. {fmtRp(sisaBayar)}</span>
            </div>
          </div>

          {/* Terms */}
          {terms.map((term, idx) => {
            const locked = lockedIds.includes(term.id);
            return (
              <div key={term.id} className={cn("pb-4", idx < terms.length - 1 && "border-b")}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm">{term.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Status:</span>
                    <Select value={term.paymentStatus} onValueChange={(v) => handleFieldChange(term.id, "paymentStatus", v)} disabled={locked}>
                      <SelectTrigger className="w-28 h-8">
                        <span className={cn("text-xs font-semibold", term.paymentStatus === "paid" ? "text-green-600" : term.paymentStatus === "partial" ? "text-blue-600" : "text-black")}>
                          {term.paymentStatus.charAt(0).toUpperCase() + term.paymentStatus.slice(1)}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUS.map((s) => (
                          <SelectItem key={s} value={s}>
                            <span className={cn("font-semibold", s === "paid" ? "text-green-600" : s === "partial" ? "text-blue-600" : "text-black")}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <Input
                    className="flex-1"
                    value={term.amount ? fmtRp(term.amount) : ""}
                    onChange={(e) => handleFieldChange(term.id, "amount", parseInt(e.target.value.replace(/\D/g, "")) || 0)}
                    disabled={locked}
                    placeholder="IDR. 0"
                    inputMode="numeric"
                  />
                  <Input
                    type="date"
                    className="flex-1"
                    value={term.dueDate ? format(new Date(term.dueDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => handleFieldChange(term.id, "dueDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
                    disabled={locked}
                  />
                </div>
                {term.paymentStatus === "partial" && (
                  <Input className="mt-1" placeholder="Catatan untuk finance..." value={term.notes ?? ""} onChange={(e) => handleFieldChange(term.id, "notes", e.target.value)} />
                )}
                {/* Bukti bayar — show when paid or partial */}
                {(term.paymentStatus === "paid" || term.paymentStatus === "partial") && !locked && (
                  <div className="mt-2">
                    {term.paymentEvidence || pendingFiles[term.id] ? (
                      <div className="flex items-center w-full px-3 py-2 border rounded-md bg-[#FAFAFA] text-[#667085] gap-2">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="flex-1 truncate text-sm">{pendingFiles[term.id]?.name ?? term.paymentEvidence?.split("/").pop() ?? "file"}</span>
                        <label className="text-red-600 underline cursor-pointer text-sm shrink-0">
                          Replace
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setPendingFiles((prev) => ({ ...prev, [term.id]: e.target.files![0] })); }} />
                        </label>
                      </div>
                    ) : (
                      <div className="relative flex items-center w-full px-3 py-2 border rounded-md bg-[#FAFAFA] text-[#667085] gap-2 cursor-pointer">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">Upload bukti bayar</span>
                        <input type="file" accept="image/*,application/pdf" className="absolute inset-0 cursor-pointer opacity-0" style={{ width: "100%", height: "100%" }} onChange={(e) => { if (e.target.files?.[0]) setPendingFiles((prev) => ({ ...prev, [term.id]: e.target.files![0] })); }} />
                      </div>
                    )}
                    {uploading === term.id && <span className="text-xs text-gray-500 mt-1">Uploading...</span>}
                  </div>
                )}
                {/* Locked paid — show evidence read-only */}
                {locked && term.paymentEvidence && (
                  <div className="flex items-center w-full px-3 py-2 border rounded-md bg-[#F3F4F6] text-black gap-2 mt-2">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate text-sm">{term.paymentEvidence.split("/").pop()}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Skema */}
          {showAdd ? (
            <div className="border rounded-lg p-3 space-y-2">
              <Input placeholder="Nama skema" value={addName} onChange={(e) => setAddName(e.target.value)} />
              <Input placeholder="IDR. 0" value={addAmount ? fmtRp(parseInt(addAmount.replace(/\D/g, "")) || 0) : ""} onChange={(e) => setAddAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
              <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Batal</Button>
                <Button className="flex-1" onClick={handleAddSkema} disabled={loading}>Tambah</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>Tambahkan Skema</Button>
          )}
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
