"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { AltArrowDown, CalendarDate, CheckCircle, TicketSale } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import {
  computePromoDiscount,
  type ActivePromoOption,
} from "@/hooks/use-active-promos";

interface VoucherProgramSelectProps {
  programs: ActivePromoOption[];
  value: string | null;
  /** null = "Tanpa promo". */
  onChange: (id: string | null) => void;
  /** Nominal GROSS yang lagi diketik — buat hitung preview potongan per tiket. */
  amount: number;
  disabled?: boolean;
  className?: string;
}

/** Nilai diskon buat stub tiket — persentase apa adanya, nominal dipadatkan. */
function stubValue(p: ActivePromoOption): string {
  if (p.discountType === "PERCENTAGE") return `${p.discountValue}%`;
  const n = p.discountValue;
  if (n >= 1_000_000) {
    const jt = n / 1_000_000;
    return `${Number.isInteger(jt) ? jt : jt.toFixed(1)}jt`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return `${n}`;
}

/** Label diskon lengkap buat trigger (nama + nominal). */
function fullDiscount(p: ActivePromoOption): string {
  return p.discountType === "PERCENTAGE"
    ? `${p.discountValue}%`
    : `Rp${p.discountValue.toLocaleString("id-ID")}`;
}

/** Tanggal akhir berlaku, diformat lokal — null kalau tak ada / tak valid. */
function validUntil(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "d MMM yyyy", { locale: localeId });
}

/**
 * Picker Program (voucher potong-bayar) — tiap opsi ditampilkan sebagai TIKET:
 * stub nilai diskon (gold) · perforasi + notch · nama program + preview potongan.
 * Pola portal-dropdown mengikuti BankAccountSelect biar aman di dalam drawer scroll.
 */
export function VoucherProgramSelect({
  programs,
  value,
  onChange,
  amount,
  disabled,
  className,
}: VoucherProgramSelectProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);

  const selected = programs.find((p) => p.id === value) ?? null;

  React.useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 300;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < dropdownHeight && rect.top > spaceBelow;
      setPos({
        top: openUp ? rect.top : rect.bottom + 6,
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
    const handler = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || portalRef.current?.contains(t)) return;
      setOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  function pick(id: string | null): void {
    onChange(id);
    setOpen(false);
  }

  const dropdown =
    open && pos ? (
      <div
        ref={portalRef}
        style={{
          position: "fixed",
          top: pos.openUp ? undefined : pos.top,
          bottom: pos.openUp ? window.innerHeight - pos.top + 6 : undefined,
          left: pos.left,
          width: pos.width,
          zIndex: 9999,
        }}
        className="rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
      >
        {/* Tanpa promo */}
        <button
          type="button"
          onClick={() => pick(null)}
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
            "hover:bg-accent",
            value === null && "text-foreground",
            value !== null && "text-muted-foreground",
          )}
        >
          Tanpa promo
          {value === null && (
            <CheckCircle weight="BoldDuotone" className="size-4 text-[var(--brand-gold)]" />
          )}
        </button>

        {programs.length > 0 && <div className="my-1 h-px bg-border" />}

        {/* Tiket voucher */}
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto px-0.5 pb-0.5">
          {programs.map((p) => {
            const isSel = p.id === value;
            const potongan = computePromoDiscount(amount, p);
            const kas = amount - potongan;
            const berlaku = validUntil(p.periodEnd);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p.id)}
                aria-pressed={isSel}
                className={cn(
                  "group relative flex overflow-hidden rounded-xl border bg-popover text-left transition-all",
                  isSel
                    ? "border-[var(--brand-gold)] ring-1 ring-[var(--brand-gold)]/30"
                    : "border-border hover:border-[var(--brand-gold)]/50 hover:shadow-sm",
                )}
              >
                {/* Stub nilai diskon */}
                <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 bg-[var(--brand-gold)]/8 px-2 py-3">
                  <span className="font-heading text-lg leading-none text-[var(--brand-gold)]">
                    {stubValue(p)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    diskon
                  </span>
                </div>

                {/* Perforasi + notch (lubang tiket) */}
                <div className="relative w-px shrink-0 border-l border-dashed border-[var(--brand-gold)]/40">
                  <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-popover" />
                  <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-popover" />
                </div>

                {/* Body: nama + preview */}
                <div className="min-w-0 flex-1 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                    {isSel && (
                      <CheckCircle
                        weight="BoldDuotone"
                        className="mt-0.5 size-4 shrink-0 text-[var(--brand-gold)]"
                      />
                    )}
                  </div>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <TicketSale weight="BoldDuotone" className="size-3" />
                    Potong tagihan · {fullDiscount(p)}
                  </p>
                  {berlaku && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarDate weight="BoldDuotone" className="size-3" />
                      Berlaku s/d {berlaku}
                    </p>
                  )}
                  {amount > 0 && (
                    <p className="mt-1 text-xs tabular-nums text-[var(--brand-gold)]">
                      −Rp{potongan.toLocaleString("id-ID")}
                      <span className="text-muted-foreground">
                        {" "}
                        · Kas Rp{kas.toLocaleString("id-ID")}
                      </span>
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-sm transition-colors",
          "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <TicketSale
            weight="BoldDuotone"
            className={cn("size-4 shrink-0", selected ? "text-[var(--brand-gold)]" : "text-muted-foreground")}
          />
          <span className="truncate">
            {selected ? (
              <>
                {selected.name}
                <span className="ml-1.5 text-muted-foreground">({fullDiscount(selected)})</span>
              </>
            ) : (
              "Tanpa promo"
            )}
          </span>
        </span>
        <AltArrowDown
          weight="BoldDuotone"
          className={cn("size-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
        />
      </button>
      {typeof window !== "undefined" && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
