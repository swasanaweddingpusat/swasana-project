"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  id: string;
  name: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onAdd?: (name: string) => Promise<void> | void;
  addingLabel?: string;
  disabled?: boolean;
  className?: string;
  minDropdownWidth?: number;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih opsi...",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada data",
  onAdd,
  addingLabel = "Menambahkan...",
  disabled = false,
  className,
  minDropdownWidth,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const showAddButton =
    onAdd &&
    search.trim() &&
    !options.some((o) => o.name.toLowerCase() === search.trim().toLowerCase());

  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 250;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      setPos({
        top: openUp ? rect.top : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openUp,
      });
    } else {
      setPos(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
      setSearch("");
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", handler, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  const handleAdd = async () => {
    if (!onAdd || !search.trim() || isAdding) return;
    setIsAdding(true);
    try {
      await onAdd(search.trim());
      setSearch("");
      setOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  const dropdown = open && pos ? (
    <div
      ref={portalRef}
      style={{
        position: "fixed",
        ...(pos.openUp
          ? { bottom: window.innerHeight - pos.top + 4, left: pos.left, width: Math.max(pos.width, minDropdownWidth ?? 0) }
          : { top: pos.top, left: pos.left, width: Math.max(pos.width, minDropdownWidth ?? 0) }),
        zIndex: 9999,
      }}
      className={cn(
        "rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        pos.openUp && "flex flex-col-reverse"
      )}
    >
      {!pos.openUp && (
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setOpen(false); setSearch(""); }
            }}
          />
        </div>
      )}
      <div className="max-h-50 overflow-y-auto p-1">
        {filtered.length === 0 && !showAddButton && (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        )}
        {filtered.map((opt) => (
          <div
            key={opt.id}
            className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.id); }}
          >
            <div className="flex items-center min-w-0">
              <Check className={cn("mr-2 h-4 w-4 shrink-0", value === opt.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{opt.name}</span>
            </div>
            {opt.badge && (
              <span className="ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500">
                {opt.badge}
              </span>
            )}
          </div>
        ))}
        {showAddButton && (
          <div
            className="flex items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer text-blue-600 hover:bg-accent"
            onMouseDown={(e) => { e.preventDefault(); handleAdd(); }}
          >
            {isAdding ? addingLabel : `+ Tambah "${search.trim()}"`}
          </div>
        )}
      </div>
      {pos.openUp && (
        <div className="flex items-center border-t px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setOpen(false); setSearch(""); }
            }}
          />
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selectedOption && "text-muted-foreground"
          )}
        >
          <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
          <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {dropdown}
    </>
  );
}
