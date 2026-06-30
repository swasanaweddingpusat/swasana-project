"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AltArrowDown, Magnifer, AddCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";

// --- Types -------------------------------------------------------------------

export interface ComplimentarySelectOption {
  id: string;
  name: string;
  /** Optional badge shown on the right (e.g. formatted price). */
  badge?: string;
  /** Optional description shown below the name (max 2 lines, ellipsis). */
  description?: string;
}

interface ComplimentarySelectProps {
  options: ComplimentarySelectOption[];
  value?: string;
  onChange: (id: string) => void;
  /**
   * Called when the user clicks the "Tambah" entry in the dropdown.
   * `searchText` is the current search input. When omitted, the "Tambah" entry
   * is never shown (e.g. when the caller lacks create permission).
   */
  onAddTrigger?: (searchText: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

// --- Component ---------------------------------------------------------------

export function ComplimentarySelect({
  options,
  value,
  onChange,
  onAddTrigger,
  placeholder = "Pilih dari daftar complimentary...",
  searchPlaceholder = "Cari complimentary...",
  emptyText = "Tidak ada complimentary",
  disabled = false,
  className,
}: ComplimentarySelectProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find((o) => o.id === value);

  const filtered = safeOptions.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Show "Tambah" entry when: onAddTrigger provided, search non-empty, no exact-match
  const showAddEntry =
    onAddTrigger !== undefined &&
    search.trim().length > 0 &&
    !safeOptions.some(
      (o) => o.name.toLowerCase() === search.trim().toLowerCase(),
    );

  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);

  // Compute portal position when open state changes
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

  // Close on outside click
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

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelect = (id: string): void => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  const handleAddTrigger = (): void => {
    if (!onAddTrigger) return;
    onAddTrigger(search.trim());
    setOpen(false);
    setSearch("");
  };

  const searchInput = (
    <div className={cn("flex", "items-center", "px-3")}>
      <Magnifer
        weight="BoldDuotone"
        className={cn("mr-2", "h-4", "w-4", "shrink-0", "opacity-50")}
      />
      <input
        ref={inputRef}
        className={cn(
          "flex",
          "h-10",
          "w-full",
          "bg-transparent",
          "py-3",
          "text-sm",
          "outline-none",
          "placeholder:text-muted-foreground",
        )}
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
  );

  const dropdown =
    open && pos ? (
      <div
        ref={portalRef}
        style={{
          position: "fixed",
          ...(pos.openUp
            ? {
                bottom: window.innerHeight - pos.top + 4,
                left: pos.left,
                width: pos.width,
              }
            : { top: pos.top, left: pos.left, width: pos.width }),
          zIndex: 9999,
        }}
        className={cn(
          "rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
          pos.openUp && "flex flex-col-reverse",
        )}
      >
        {/* Search input -- top when opening down, bottom when opening up */}
        {!pos.openUp && (
          <div className="border-b">{searchInput}</div>
        )}

        {/* Option list */}
        <div className={cn("max-h-50", "overflow-y-auto", "p-1")}>
          {filtered.length === 0 && !showAddEntry && (
            <p
              className={cn(
                "py-4",
                "text-center",
                "text-sm",
                "text-muted-foreground",
              )}
            >
              {emptyText}
            </p>
          )}
          {filtered.map((opt) => (
            <div
              key={opt.id}
              className={cn(
                "flex",
                "flex-col",
                "items-stretch",
                "rounded-sm",
                "px-2",
                "py-1.5",
                "text-sm",
                "cursor-pointer",
                "hover:bg-accent",
                "hover:text-accent-foreground",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt.id);
              }}
            >
              {/* Row 1: name + badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{opt.name}</span>
                {opt.badge && (
                  <span className="ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
                    {opt.badge}
                  </span>
                )}
              </div>
              {/* Row 2: description (only when present and non-empty) */}
              {opt.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {opt.description}
                </p>
              )}
            </div>
          ))}

          {/* "Tambah" entry -- appears at bottom when no exact-match and onAddTrigger provided */}
          {showAddEntry && (
            <div
              className={cn(
                "flex",
                "items-center",
                "gap-1.5",
                "rounded-sm",
                "px-2",
                "py-1.5",
                "text-sm",
                "cursor-pointer",
                "text-primary",
                "hover:bg-accent",
                "hover:text-accent-foreground",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddTrigger();
              }}
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4 shrink-0" />
              <span>Tambah &ldquo;{search.trim()}&rdquo;</span>
            </div>
          )}
        </div>

        {pos.openUp && (
          <div className="border-t">{searchInput}</div>
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
            !selectedOption && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.name : placeholder}
          </span>
          <AltArrowDown
            weight="BoldDuotone"
            className={cn(
              "ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      {dropdown && typeof document !== "undefined"
        ? createPortal(dropdown, document.body)
        : null}
    </>
  );
}
