"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  id: string;
  name: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada data",
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.filter((o) => value.includes(o.id));
  const filtered = options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div
        className={cn(
          "min-h-9 w-full flex flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm cursor-pointer",
          disabled && "opacity-50 pointer-events-none",
          open && "ring-2 ring-ring/50 border-ring"
        )}
        onClick={() => setOpen((p) => !p)}
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground px-1 py-0.5">{placeholder}</span>
        ) : (
          selected.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs">
              {o.name}
              <button type="button" onClick={(e) => remove(o.id, e)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform", open && "rotate-180")} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent py-2 px-2 text-sm outline-none placeholder:text-muted-foreground"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-3">{emptyText}</p>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.id}
                  className={cn("flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent", value.includes(o.id) && "bg-accent/50")}
                  onClick={() => toggle(o.id)}
                >
                  <div className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", value.includes(o.id) ? "bg-primary border-primary" : "border-input")}>
                    {value.includes(o.id) && <X className="h-2.5 w-2.5 text-primary-foreground" style={{ transform: "rotate(45deg)" }} />}
                  </div>
                  {o.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
