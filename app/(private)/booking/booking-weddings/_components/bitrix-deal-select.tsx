"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle, AltArrowDown, Magnifer, UserCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";

interface BitrixDealOption {
  id: string;
  client: string | null;
  title: string;
  assignedBy: string | null;
  stage: string;
  stageColor: string | null;
}

interface BitrixDealSelectProps {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

const EMPTY: BitrixDealOption[] = [];

function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#0f4159";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f4159" : "#ffffff";
}

/**
 * Searchable dropdown that resolves a Bitrix24 deal by client name and shows the
 * PIC + stage alongside. Selecting an option fills the customer's Bitrix ID with
 * the deal id. Powered by GET /api/bitrix/deals?q=... (title search).
 */
export function BitrixDealSelect({
  value,
  onChange,
  placeholder = "Pilih transaksi Bitrix...",
  searchPlaceholder = "Cari nama client...",
  disabled = false,
  className,
}: BitrixDealSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<BitrixDealOption[]>(EMPTY);
  const [loading, setLoading] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState<string>("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  // Resolve the selected deal's label when the value is pre-filled (e.g. from a
  // lead/customer) without opening the dropdown.
  React.useEffect(() => {
    if (!value || selectedLabel) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams({ start: "0" });
        params.set("filter[ID]", value);
        const res = await fetch(`/api/bitrix/deals?${params.toString()}`, { signal: controller.signal });
        const json = (await res.json()) as { items?: BitrixDealOption[] };
        const found = json.items?.[0];
        if (!controller.signal.aborted && found) setSelectedLabel(found.client ?? found.title);
      } catch {
        // Non-fatal — falls back to showing the raw id.
      }
    })();
    return () => controller.abort();
  }, [value, selectedLabel]);

  // Debounced search against the deals route (server-side %TITLE match).
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({ start: "0" });
        if (search.trim()) params.set("q", search.trim());
        const res = await fetch(`/api/bitrix/deals?${params.toString()}`, { signal: controller.signal });
        const json = (await res.json()) as { items?: BitrixDealOption[] };
        if (!controller.signal.aborted) {
          setOptions(Array.isArray(json.items) ? json.items : []);
          setLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [open, search]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Compute dropdown position (state, not refs during render).
  React.useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 280;
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

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
      setSearch("");
    };
    const timer = setTimeout(() => document.addEventListener("click", handler, true), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const handleSelect = (opt: BitrixDealOption) => {
    onChange(opt.id);
    setSelectedLabel(opt.client ?? opt.title);
    setOpen(false);
    setSearch("");
  };

  const dropdown = open && pos ? (
    <div
      ref={portalRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
      className={cn(
        "rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
      )}
    >
      <div className={cn("flex", "items-center", "border-b", "px-3")}>
        <Magnifer weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "shrink-0", "opacity-50")} />
        <input
          ref={inputRef}
          className={cn("flex", "h-10", "w-full", "bg-transparent", "py-3", "text-sm", "outline-none", "placeholder:text-muted-foreground")}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setSearch("");
            }
          }}
        />
      </div>
      <div className={cn("max-h-64", "overflow-y-auto", "p-1")}>
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Mencari...</p>
        ) : options.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada transaksi ditemukan</p>
        ) : (
          options.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm cursor-pointer hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
            >
              <div className="flex min-w-0 items-start gap-2">
                <CheckCircle
                  weight="BoldDuotone"
                  className={cn("mt-0.5 h-4 w-4 shrink-0", value === opt.id ? "opacity-100" : "opacity-0")}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{opt.client ?? opt.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserCircle weight="BoldDuotone" className="h-3 w-3 shrink-0" />
                    <span className="truncate">{opt.assignedBy ?? "-"}</span>
                  </p>
                </div>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={
                  opt.stageColor
                    ? { backgroundColor: opt.stageColor, color: contrastText(opt.stageColor) }
                    : undefined
                }
              >
                {opt.stage}
              </span>
            </div>
          ))
        )}
      </div>
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
            !selectedLabel && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <AltArrowDown weight="BoldDuotone" className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {dropdown && typeof document !== "undefined" ? createPortal(dropdown, document.body) : null}
    </>
  );
}
