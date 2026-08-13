"use client";

import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtRp } from "./ar-format";
import type { ARBooking, ARTermin } from "@/types/finance";
import { Printer } from "@solar-icons/react";

// ─── Dummy org constants ──────────────────────────────────────────────────────
const ORG_NAME = "SAMISARA";
const ORG_SUB = "Wedding & Event";

// Label jenis invoice (entity Invoice.type) → tampilan.
const INVOICE_TYPE_LABEL: Record<string, string> = {
  dp: "DP",
  progress: "Progress",
  pelunasan: "Pelunasan",
  lainnya: "Lainnya",
};

// ─── Local helpers ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
      {children}
    </p>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{children}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface InvoicePreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ARBooking | null;
  termin: ARTermin | null;
}

export function InvoicePreviewDrawer({
  isOpen,
  onClose,
  booking,
  termin,
}: InvoicePreviewDrawerProps): React.ReactElement {
  const today = fmtDate(new Date().toISOString());

  const paid = termin ? termin.amount - termin.remaining : 0;

  function handleCetak(): void {
    window.print();
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Preview Invoice"
      maxWidth="sm:max-w-2xl"
    >
      {/* Print isolation media query */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print-area,
          #invoice-print-area * { visibility: visible; }
          #invoice-print-area { position: absolute; inset: 0; }
        }
      `}</style>

      <div className="flex flex-col gap-5 px-1 pb-6">
        {booking && termin ? (
          <>
            {/* ── Printable invoice paper ── */}
            <div
              id="invoice-print-area"
              className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              {/* Stamp — VOID (invoice dibatalkan) menang atas LUNAS */}
              {termin.invoice?.status === "void" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="-rotate-12 rounded-lg border-2 border-destructive/50 px-4 py-1 font-heading text-lg uppercase tracking-widest text-destructive/70 opacity-70">
                    VOID
                  </span>
                </div>
              ) : termin.status === "paid" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="-rotate-12 rounded-lg border-2 border-primary/40 px-4 py-1 font-heading text-lg uppercase tracking-widest text-primary/60 opacity-60">
                    LUNAS
                  </span>
                </div>
              ) : null}

              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                {/* Org identity */}
                <div>
                  <p className="font-heading text-2xl font-bold text-foreground leading-tight">
                    {ORG_NAME}
                  </p>
                  <p className="text-xs text-muted-foreground">{ORG_SUB}</p>
                </div>

                {/* Document label + PREVIEW pill */}
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    {/* Belum terbit = PREVIEW; sudah terbit = badge jenis invoice (beku) */}
                    {termin.invoice ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground">
                        {INVOICE_TYPE_LABEL[termin.invoice.type] ?? termin.invoice.type}
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        PREVIEW
                      </span>
                    )}
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      INVOICE / TAGIHAN
                    </p>
                  </div>
                  {/* No. Invoice & dates — beku dari entity Invoice saat terbit */}
                  <p className="text-sm font-medium text-foreground">
                    {termin.invoice?.number || termin.noInvoice || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tanggal: {termin.invoice ? fmtDate(termin.invoice.issuedAt) : today}
                  </p>
                  <p className="text-xs font-semibold text-foreground">
                    Jatuh Tempo: {fmtDate(termin.dueDate)}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border mb-5" />

              {/* Bill-to */}
              <div className="mb-5">
                <SectionLabel>Tagihan Kepada</SectionLabel>
                <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-foreground">{booking.customerEvent}</p>
                  <p className="text-xs text-muted-foreground">{booking.customerEmail}</p>
                  <p className="text-xs text-muted-foreground">{booking.customerPhone}</p>
                </div>
              </div>

              {/* Line-item table */}
              <div className="mb-5">
                <SectionLabel>Rincian Tagihan</SectionLabel>
                <div className="rounded-xl border border-border overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_auto] bg-secondary/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Deskripsi</span>
                    <span className="text-right">Jumlah</span>
                  </div>
                  {/* Single line item */}
                  <div className="grid grid-cols-[1fr_auto] px-4 py-3 text-sm border-t border-border">
                    <span className="text-foreground">{termin.name}</span>
                    <span className="text-right font-medium text-foreground">
                      {fmtRp(termin.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Totals block */}
              <div className="mb-5 flex justify-end">
                <div className="w-64 flex flex-col gap-1">
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-muted-foreground">Jumlah Tagihan</span>
                    <span className="text-foreground font-medium">{fmtRp(termin.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-muted-foreground">Sudah Dibayar</span>
                    <span className="text-foreground font-medium">{fmtRp(paid)}</span>
                  </div>
                  <div className="border-t border-border mt-1 pt-2 flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">Sisa Tagihan</span>
                    <span
                      className={
                        termin.remaining > 0
                          ? "font-heading text-xl font-bold text-destructive"
                          : "font-heading text-xl font-bold text-muted-foreground"
                      }
                    >
                      {fmtRp(termin.remaining)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Via Rekening */}
              <div className="mb-2">
                <SectionLabel>Instruksi Pembayaran</SectionLabel>
                <InfoRow label="Via Rekening">
                  {termin.viaRekening ? (
                    <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-foreground">
                      {termin.viaRekening}
                    </span>
                  ) : (
                    "—"
                  )}
                </InfoRow>
              </div>
            </div>

            {/* ── Cetak action ── */}
            <div className="flex justify-end">
              <Button
                type="button"
                className="rounded-full gap-2"
                onClick={handleCetak}
              >
                <Printer weight="BoldDuotone" className="h-4 w-4" />
                Cetak
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Pilih termin untuk melihat preview invoice.
          </div>
        )}
      </div>
    </Drawer>
  );
}
