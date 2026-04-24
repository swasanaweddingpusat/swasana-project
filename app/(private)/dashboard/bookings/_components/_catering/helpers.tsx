"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { CateringSection } from "@/types/catering";

// ─── CurrencyInput ────────────────────────────────────────────────────────────

export function CurrencyInput({ value, onChange, className, placeholder = "0" }: {
  value: number | undefined;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [raw, setRaw] = React.useState(value ? value.toLocaleString("id-ID") : "");
  React.useEffect(() => { setRaw(value ? value.toLocaleString("id-ID") : ""); }, [value]);
  return (
    <div className={`relative flex items-center ${className ?? ""}`}>
      <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none select-none">Rp</span>
      <input type="text" inputMode="numeric" value={raw} placeholder={placeholder}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, "")) || 0; setRaw(n ? n.toLocaleString("id-ID") : ""); onChange(n); }}
        className="h-6 text-xs text-right pr-1.5 pl-6 border border-input rounded-md w-full bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
    </div>
  );
}

// ─── AddSectionButton ─────────────────────────────────────────────────────────

export function AddSectionButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setName(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  React.useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const commit = () => { const t = name.trim(); if (!t) { setOpen(false); setName(""); return; } onAdd(t); setOpen(false); setName(""); };

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors border border-dashed border-gray-200 w-full justify-center">
      <Plus className="h-3.5 w-3.5" /> Tambah Section
    </button>
  );

  return (
    <div ref={ref} className="border border-gray-200 rounded-lg bg-white p-3 shadow-sm">
      <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setOpen(false); setName(""); } }}
        placeholder="Nama section..." className="w-full text-sm font-semibold border-0 border-b border-gray-200 outline-none pb-1 mb-2 bg-transparent" />
      <div className="flex gap-1.5 mt-2.5 justify-end">
        <button type="button" onClick={() => { setOpen(false); setName(""); }} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Batal</button>
        <Button type="button" size="sm" className="h-7 text-xs px-3" onClick={commit}>Tambah</Button>
      </div>
    </div>
  );
}

// ─── InlineAddItemForm ────────────────────────────────────────────────────────

export function InlineAddItemForm({ onConfirm, onCancel }: {
  mode?: string;
  onConfirm: (title: string, qty: number, unit: string, price: number) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [qty, setQty] = React.useState<number | "">(``);
  const [unit, setUnit] = React.useState("");
  const [price, setPrice] = React.useState<number | undefined>(undefined);
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);

  return (
    <div className="flex items-center gap-1.5 py-1 px-1 bg-blue-50/50 rounded border border-blue-100">
      <Input ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama item" className="h-6 text-xs flex-1 min-w-25"
        onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { onConfirm(title.trim(), Number(qty) || 0, unit, price ?? 0); } if (e.key === "Escape") onCancel(); }} />
      <Input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value) || "")} placeholder="Qty" className="h-6 text-xs w-14 text-center" />
      <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="h-6 text-xs w-14" />
      <CurrencyInput value={price} onChange={setPrice} className="w-24 shrink-0" />
      <Button type="button" size="sm" className="h-6 text-[10px] px-2" onClick={() => { if (title.trim()) onConfirm(title.trim(), Number(qty) || 0, unit, price ?? 0); }}>+</Button>
      <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
    </div>
  );
}

// ─── AddGroupButton ───────────────────────────────────────────────────────────

export function AddGroupButton({ section, onAddNormal, onAddMenuPilihan }: {
  section: CateringSection;
  onAddNormal: () => void;
  onAddMenuPilihan?: (sourceGroupId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const normalGroups = section.nodes.filter((n) => n.type === "group" && !n.is_menu_pilihan);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">
        <Plus className="h-3 w-3" /> Group
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-45">
          <button type="button" onClick={() => { onAddNormal(); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">+ Group Baru</button>
          {normalGroups.length > 0 && onAddMenuPilihan && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <p className="px-3 py-1 text-[10px] text-gray-400 font-medium">Menu Pilihan dari:</p>
              {normalGroups.map((g) => (
                <button key={g.id} type="button" onClick={() => { onAddMenuPilihan(g.id); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 truncate">{g.title || "Untitled"}</button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
