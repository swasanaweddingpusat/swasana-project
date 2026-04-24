"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, Search, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PaymentMethod {
  id: string;
  bankName: string;
  bankAccountNumber: string;
  bankRecipient: string;
}

interface Props {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDropdownWidth?: number;
  venueId?: string;
}

export function BankAccountSelect({ value, onChange, placeholder = "Pilih rekening...", disabled, className, minDropdownWidth = 320, venueId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);
  const [form, setForm] = React.useState({ bankName: "", bankAccountNumber: "", bankRecipient: "" });
  const [saving, setSaving] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: () => fetch("/api/payment-methods").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const selected = paymentMethods.find((pm) => pm.id === value);
  const filtered = paymentMethods.filter((pm) =>
    `${pm.bankName} ${pm.bankRecipient} ${pm.bankAccountNumber}`.toLowerCase().includes(search.toLowerCase())
  );

  React.useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < dropdownHeight && rect.top > spaceBelow;
      setPos({ top: openUp ? rect.top : rect.bottom + 4, left: rect.left, width: Math.max(rect.width, minDropdownWidth), openUp });
    } else {
      setPos(null);
      setShowAdd(false);
      setSearch("");
      setForm({ bankName: "", bankAccountNumber: "", bankRecipient: "" });
    }
  }, [open, minDropdownWidth]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || portalRef.current?.contains(t)) return;
      setOpen(false);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSave = async () => {
    if (!form.bankName || !form.bankAccountNumber || !form.bankRecipient) {
      toast.error("Semua field wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const { createPaymentMethod } = await import("@/actions/payment-method");
      const result = await createPaymentMethod({ ...form, venueId: venueId ?? null });
      if (!result.success || !result.data) { toast.error(result.error ?? "Gagal menyimpan"); return; }
      toast.success("Rekening berhasil ditambahkan");
      await qc.invalidateQueries({ queryKey: ["payment-methods"] });
      onChange(result.data.id);
      setOpen(false);
    } catch { toast.error("Gagal menyimpan rekening"); }
    setSaving(false);
  };

  const dropdown = open && pos ? (
    <div
      ref={portalRef}
      style={{ position: "fixed", top: pos.openUp ? undefined : pos.top, bottom: pos.openUp ? window.innerHeight - pos.top + 4 : undefined, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {!showAdd ? (
        <>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
            <input
              autoFocus
              className="flex h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Cari rekening..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">Tidak ada rekening</p>
            )}
            {filtered.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                onClick={() => { onChange(pm.id); setOpen(false); }}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{pm.bankName} — {pm.bankRecipient}</p>
                  <p className="text-xs text-muted-foreground">{pm.bankAccountNumber}</p>
                </div>
                {value === pm.id && <Check className="h-4 w-4 shrink-0 ml-2" />}
              </div>
            ))}
          </div>
          <div className="border-t p-1">
            <button
              type="button"
              className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent text-muted-foreground"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah rekening baru
            </button>
          </div>
        </>
      ) : (
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold">Rekening Baru</p>
            <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Input placeholder="Nama bank" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} className="h-8 text-xs" />
          <Input placeholder="No. rekening" value={form.bankAccountNumber} onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, "").slice(0, 16) }))} inputMode="numeric" maxLength={16} className="h-8 text-xs" />
          <Input placeholder="Nama pemilik rekening" value={form.bankRecipient} onChange={(e) => setForm((f) => ({ ...f, bankRecipient: e.target.value }))} className="h-8 text-xs" />
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setShowAdd(false)} disabled={saving}>Batal</Button>
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
          "hover:bg-accent/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {selected ? `${selected.bankName} — ${selected.bankRecipient}` : placeholder}
        </span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </button>
      {typeof window !== "undefined" && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
