"use client";

import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtRp } from "./ar-format";
import { terbilang } from "@/lib/utils";
import type { ARBooking, ARTermin } from "@/types/finance";
import { Printer } from "@solar-icons/react";

// ─── Dummy org constants ──────────────────────────────────────────────────────
const ORG_NAME = "SAMISARA";
const ORG_SUB = "Wedding & Event";
const SIGNER_NAME = "Finance Samisara";
const SIGNER_ROLE = "Finance";
const SIGNER_CITY = "Jakarta";

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
interface KwitansiPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ARBooking | null;
  termin: ARTermin | null;
}

export function KwitansiPreviewDrawer({
  isOpen,
  onClose,
  booking,
  termin,
}: KwitansiPreviewDrawerProps): React.ReactElement {
  const today = fmtDate(new Date().toISOString());

  const noKwitansi = termin
    ? `KW-${termin.noInvoice || termin.id.slice(0, 8).toUpperCase()}`
    : "—";

  function handleCetak(): void {
    window.print();
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Preview Kwitansi"
      maxWidth="sm:max-w-2xl"
    >
      {/* Print isolation media query */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #kwitansi-print-area,
          #kwitansi-print-area * { visibility: visible; }
          #kwitansi-print-area { position: absolute; inset: 0; }
        }
      `}</style>

      <div className="flex flex-col gap-5 px-1 pb-6">
        {booking && termin ? (
          <>
            {/* ── Printable receipt paper ── */}
            <div
              id="kwitansi-print-area"
              className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              {/* LUNAS stamp — only when paid */}
              {termin.status === "paid" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="-rotate-12 rounded-lg border-2 border-primary/40 px-4 py-1 font-heading text-lg uppercase tracking-widest text-primary/60 opacity-60">
                    LUNAS
                  </span>
                </div>
              )}

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
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      PREVIEW
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      TANDA TERIMA
                    </p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{noKwitansi}</p>
                  <p className="text-xs text-muted-foreground">{today}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border mb-5" />

              {/* Body rows */}
              <div className="flex flex-col gap-0.5 mb-5">
                <SectionLabel>Detail Penerimaan</SectionLabel>

                <InfoRow label="Telah diterima dari">{booking.customerEvent}</InfoRow>

                {/* Hero amount */}
                <div className="py-3">
                  <p className="text-xs text-muted-foreground mb-1">Uang sejumlah</p>
                  <p className="font-heading text-2xl font-bold text-foreground">
                    {fmtRp(termin.amount)}
                  </p>
                  {/* Terbilang — signature element */}
                  <div className="mt-2 rounded-xl bg-secondary/40 px-4 py-2">
                    <p className="text-sm italic text-muted-foreground">
                      {terbilang(termin.amount)}
                    </p>
                  </div>
                </div>

                <InfoRow label="Untuk pembayaran">{termin.name}</InfoRow>

                <InfoRow label="Via">
                  {termin.viaRekening ? (
                    <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-foreground">
                      {termin.viaRekening}
                    </span>
                  ) : (
                    "—"
                  )}
                </InfoRow>

                <InfoRow label="No. Invoice">{termin.noInvoice || "—"}</InfoRow>
              </div>

              {/* Footer signature block */}
              <div className="flex justify-end">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm text-muted-foreground">
                    {SIGNER_CITY}, {today}
                  </p>
                  <p className="text-xs text-muted-foreground">Penerima,</p>
                  {/* Signature line */}
                  <div className="my-6 w-40 border-b border-border" />
                  <p className="text-sm font-medium text-foreground">{SIGNER_NAME}</p>
                  <p className="text-xs text-muted-foreground">{SIGNER_ROLE}</p>
                  <p className="text-[10px] text-muted-foreground">* data penanda tangan contoh</p>
                </div>
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
            Pilih termin untuk melihat preview kwitansi.
          </div>
        )}
      </div>
    </Drawer>
  );
}
