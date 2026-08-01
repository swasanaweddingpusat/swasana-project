"use client";

import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Printer, CloseCircle } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuotationItem, QuotationLineItem } from "./quotations-table";

interface QuotationPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationItem | null;
}

const PRINT_AREA_ID = "quotation-print-area";

/** Nomor dokumen — pakai yang ada, atau derive dari id (quotation = MICE-only). */
function deriveQuotationNo(q: QuotationItem): string {
  if (q.quotationNo) return q.quotationNo;
  return `#${q.id}-MICE`;
}

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatLongDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: idLocale });
  } catch {
    return dateStr;
  }
}

/** Fallback line items kalau quotation belum punya detail — pakai 1 baris ringkasan paket. */
function resolveItems(q: QuotationItem): QuotationLineItem[] {
  if (q.items && q.items.length > 0) return q.items;
  return [
    {
      id: "fallback-1",
      description: `${q.packageName} — ${q.variantName}`,
      qty: 1,
      price: q.price,
      total: q.price,
      manualTotal: true,
    },
  ];
}

/** Baris section header = teks diakhiri ":" (mis. "A. Ballroom Facilities :"). */
function isSectionHeader(item: QuotationLineItem): boolean {
  return item.description.trim().endsWith(":");
}

interface InfoRowProps {
  label: string;
  value?: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex gap-2 text-[11px] leading-relaxed">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="shrink-0">:</span>
      <span className="flex-1 font-medium text-foreground break-words">
        {value && value.trim() ? value : "—"}
      </span>
    </div>
  );
}

export function QuotationPreview({
  open,
  onOpenChange,
  quotation,
}: QuotationPreviewProps) {
  if (!quotation) return null;

  const q = quotation;
  const items = resolveItems(q);

  const subtotal =
    q.items && q.items.length > 0
      ? items.reduce((sum, it) => sum + it.total, 0)
      : q.price;
  const discount = q.discount ?? 0;
  const downPayment = q.downPayment ?? 0;
  const others = q.others ?? 0;
  const total = Math.max(0, subtotal - discount + others);

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-3xl! w-[95vw] gap-0 p-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">
          Preview Quotation {deriveQuotationNo(q)}
        </DialogTitle>

        {/* Toolbar — disembunyikan saat print */}
        <div
          data-print-hide
          className="flex items-center justify-between gap-2 border-b px-4 py-3"
        >
          <p className="text-sm font-semibold text-foreground">
            Preview Quotation
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 rounded-full px-4 text-xs cursor-pointer"
            >
              <Printer weight="BoldDuotone" className="h-3.5 w-3.5 mr-1.5" />
              Cetak / PDF
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Tutup"
              className="rounded-full bg-destructive/10 p-1 hover:bg-destructive/20 cursor-pointer"
            >
              <CloseCircle
                weight="BoldDuotone"
                className="h-5 w-5 text-destructive"
              />
            </button>
          </div>
        </div>

        {/* Scrollable preview surface */}
        <div className="max-h-[80vh] overflow-y-auto bg-muted/40 p-4 sm:p-6">
          {/* ── Kertas dokumen ─────────────────────────────────── */}
          <div
            id={PRINT_AREA_ID}
            className="mx-auto w-full max-w-[760px] bg-card text-foreground shadow-sm"
          >
            <div className="px-8 py-8">
              {/* Header: logo + judul */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-logo text-2xl font-bold tracking-tight text-foreground">
                    KEDIAMAN
                  </p>
                  <p className="font-logo text-xs tracking-[0.4em] text-muted-foreground">
                    C O R P
                  </p>
                </div>
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  QUOTATION
                </h1>
              </div>

              {/* Info dua kolom */}
              <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                <div className="space-y-1">
                  <InfoRow label="Quotation No" value={deriveQuotationNo(q)} />
                  <InfoRow
                    label="Purchase Order Num."
                    value={q.purchaseOrderNo}
                  />
                  <InfoRow label="To" value={q.leadName} />
                  <InfoRow label="No. Hp" value={q.leadPhone} />
                  {q.instansi && q.instansi.trim() ? (
                    <InfoRow label="Instansi" value={q.instansi} />
                  ) : null}
                  <div className="h-1" />
                  <InfoRow label="Sales" value={q.salesName} />
                  <InfoRow label="No. Hp" value={q.salesPhone} />
                </div>
                <div className="space-y-1">
                  <InfoRow label="Event" value={q.eventType} />
                  <InfoRow label="Details" value={q.details} />
                  <InfoRow label="Time" value={q.time} />
                  <InfoRow label="Place" value={q.place} />
                  <InfoRow
                    label="Date"
                    value={formatLongDate(q.eventDate)}
                  />
                  <InfoRow label="Venue" value={q.venue} />
                </div>
              </div>

              {/* Black band */}
              <div className="mt-5 h-7 w-full rounded-sm bg-foreground" />

              {/* Tabel item */}
              <table className="mt-4 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-foreground/80">
                    <th className="py-2 text-left font-bold text-foreground">
                      Description
                    </th>
                    <th className="w-16 py-2 text-right font-bold text-foreground">
                      Qty.
                    </th>
                    <th className="w-28 py-2 text-right font-bold text-foreground">
                      Price
                    </th>
                    <th className="w-32 py-2 text-right font-bold text-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const header = isSectionHeader(it);
                    return (
                      <tr key={it.id}>
                        <td
                          className={cn(
                            "py-0.5 align-top text-foreground",
                            header && "pt-3 font-bold"
                          )}
                        >
                          {it.description}
                        </td>
                        <td className="py-0.5 text-right align-top tabular-nums text-muted-foreground">
                          {it.qty > 0 ? it.qty : ""}
                        </td>
                        <td className="py-0.5 text-right align-top tabular-nums text-muted-foreground">
                          {it.price > 0 ? formatRupiah(it.price) : ""}
                        </td>
                        <td
                          className={cn(
                            "py-0.5 text-right align-top tabular-nums",
                            header ? "pt-3 font-bold text-foreground" : "text-foreground"
                          )}
                        >
                          {it.total > 0 ? formatRupiah(it.total) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Term & payment + totals */}
              <div className="mt-8 grid grid-cols-1 gap-8 border-t pt-4 sm:grid-cols-2">
                {/* Kiri: term & payment */}
                <div className="space-y-2 text-[11px] leading-relaxed">
                  <p className="font-bold text-foreground">Term &amp; Payment :</p>
                  {q.bookingFee && q.bookingFee > 0 ? (
                    <p className="text-foreground">
                      Booking Fee of{" "}
                      <span className="font-bold">
                        {formatRupiah(q.bookingFee)}
                      </span>{" "}
                      is required to confirm the reservation.
                    </p>
                  ) : null}
                  <p className="text-foreground">
                    Payment can be made via{" "}
                    <span className="font-bold">bank transfer</span> to the
                    following account:
                  </p>
                  <div className="space-y-0.5 pt-1">
                    <p>
                      <span className="font-bold text-foreground">Bank</span> :{" "}
                      {q.bankName ?? "—"}
                    </p>
                    <p>
                      <span className="font-bold text-foreground">
                        Account Number
                      </span>{" "}
                      : {q.bankAccountNo ?? "—"}
                    </p>
                    <p>
                      <span className="font-bold text-foreground">
                        Account Name
                      </span>{" "}
                      : {q.bankAccountName ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Kanan: ringkasan total */}
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-bold text-foreground">Subtotal</span>
                    <span className="tabular-nums text-foreground">
                      {formatRupiah(subtotal)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums text-muted-foreground">
                        - {formatRupiah(discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Down Payment</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatRupiah(downPayment)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Others</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatRupiah(others)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between border-t pt-2">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold tabular-nums text-foreground">
                      {formatRupiah(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Catatan */}
              {q.notes && q.notes.trim() ? (
                <p className="mt-6 text-[11px] font-medium text-foreground">
                  {q.notes}
                </p>
              ) : null}

              <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
                We look forward to welcoming you and your team at Kediaman Event
                Venue — {q.venue}. Should you require any further assistance,
                please do not hesitate to contact us.
              </p>

              {/* Signature */}
              <div className="mt-10 text-[11px]">
                <p className="text-foreground">
                  Jakarta, {formatLongDate(q.issuedAt ?? q.createdAt)}
                </p>
                <div className="mt-12 w-56 border-t border-foreground pt-1 text-center">
                  <p className="font-bold text-foreground">{q.salesName}</p>
                  <p className="text-muted-foreground">MICE Event Sales</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Print isolation: hanya kertas dokumen yang tampil saat cetak */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #${PRINT_AREA_ID}, #${PRINT_AREA_ID} * { visibility: visible !important; }
          #${PRINT_AREA_ID} {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          [data-print-hide] { display: none !important; }
        }
      `}</style>
    </Dialog>
  );
}
