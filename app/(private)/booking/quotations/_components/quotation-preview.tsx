"use client";

import Image from "next/image";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Printer, CloseCircle } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { richTextToPlainText } from "@/lib/richText";
import { cn } from "@/lib/utils";
import type { QuotationItem, QuotationLineItem } from "./quotations-table";

interface QuotationPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationItem | null;
}

const PRINT_AREA_ID = "quotation-print-area";

// Editable-clause fallbacks — used when the quotation's corresponding field is
// null (legacy rows / not yet customized via the drawer's Step 5 form).
const DEFAULT_PAYMENT_NOTE =
  "The remaining payment shall be completed according to the agreed schedule.";
const DEFAULT_CANCELLATION_POLICY =
  "All confirmed transactions are non-cancellable and non-refundable.";
function defaultClosingNote(venue: string): string {
  return `We look forward to welcoming you and your team at Kediaman Event Venue — ${venue}. Should you require any further assistance, please do not hesitate to contact us.`;
}

/**
 * Nomor dokumen — pakai yang tersimpan (format register: "#201-MICE").
 * Fallback untuk row lama tanpa nomor: slug pendek dari id, tetap berpola "#…-MICE".
 */
function deriveQuotationNo(q: QuotationItem): string {
  if (q.quotationNo) return q.quotationNo;
  return `#${q.id.slice(0, 6).toUpperCase()}-MICE`;
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

/** Single date or "start – end" range when eventEndDate is set and differs from eventDate. */
function formatEventDateRange(eventDate: string, eventEndDate?: string): string {
  if (eventEndDate && eventEndDate !== eventDate) {
    return `${formatLongDate(eventDate)} – ${formatLongDate(eventEndDate)}`;
  }
  return formatLongDate(eventDate);
}

/** Build the printable rows from every commercial section in the drawer. */
function resolveItems(q: QuotationItem): QuotationLineItem[] {
  const priceRows: QuotationLineItem[] = (q.prices ?? []).map((price) => ({
    id: `price-${price.id}`,
    description: price.name,
    richDescription: price.description,
    qty: price.priceType === "QTY" ? (price.qty ?? 0) : 0,
    price: price.priceType === "QTY" ? (price.price ?? 0) : 0,
    total: price.total,
    manualTotal: price.priceType === "NOMINAL",
  }));
  const itemRows = q.items ?? [];
  const additionalRows = q.additionals ?? [];
  const rows = [...priceRows, ...itemRows, ...additionalRows];
  if (rows.length > 0) return rows;
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

/**
 * Baris section header = judul berprefix huruf "A. / B. / C." (konvensi sheet QUO,
 * mis. "B. Equipments" walau tanpa titik dua) ATAU diakhiri ":" (backward-compat).
 */
function isSectionHeader(item: QuotationLineItem): boolean {
  const text = item.description.trim();
  return /^[A-Z]\.\s/.test(text) || text.endsWith(":");
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

  const subtotal = q.price;
  const discount = q.discount ?? 0;
  const downPayment = q.downPayment ?? 0;
  const others = q.others ?? 0;
  const total = q.totalPrice;
  const termAndCondition = richTextToPlainText(q.termAndCondition);
  const cancellationPolicy =
    richTextToPlainText(q.cancellationPolicy) || DEFAULT_CANCELLATION_POLICY;
  const closingNote = richTextToPlainText(q.closingNote) || defaultClosingNote(q.venue);
  const termIncludesBankTransfer = /bank\s+transfer/i.test(termAndCondition);

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
                  {/* Purchase Order Num. — di-assign saat quotation dikonversi jadi booking; kosong ("—") di tahap quotation. */}
                  <InfoRow
                    label="Purchase Order Num."
                    value={q.purchaseOrderNo}
                  />
                  <InfoRow label="To" value={q.leadName} />
                  <InfoRow label="No. Hp" value={q.leadPhone} />
                  {/* Instansi selalu tampil (mengikuti layout dokumen QUO), "—" kalau kosong. */}
                  <InfoRow label="Instansi" value={q.instansi} />
                  <div className="h-1" />
                  <InfoRow label="Sales MICE" value={q.salesName} />
                  <InfoRow label="No. Hp" value={q.salesPhone} />
                </div>
                <div className="space-y-1">
                  <InfoRow label="Event" value={q.eventType} />
                  <InfoRow label="Details" value={q.details} />
                  <InfoRow label="Time" value={q.time} />
                  <InfoRow label="Place" value={q.place} />
                  <InfoRow
                    label="Date"
                    value={formatEventDateRange(q.eventDate, q.eventEndDate)}
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
                          <span className="block">{it.description}</span>
                          {it.richDescription?.trim() ? (
                            <p className="mt-0.5 whitespace-pre-line text-[10px] font-normal leading-relaxed text-muted-foreground">
                              {richTextToPlainText(it.richDescription)}
                            </p>
                          ) : null}
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
                  {termAndCondition ? (
                    <p className="whitespace-pre-line text-foreground">
                      {termAndCondition}
                    </p>
                  ) : (
                    <>
                      {q.bookingFee && q.bookingFee > 0 ? (
                        <p className="text-foreground">
                          Booking Fee of{" "}
                          <span className="font-bold">
                            {formatRupiah(q.bookingFee)}
                          </span>{" "}
                          is required to confirm the reservation.
                        </p>
                      ) : null}
                      <p className="text-muted-foreground">
                        {q.paymentNote?.trim() || DEFAULT_PAYMENT_NOTE}
                      </p>
                    </>
                  )}
                  {!termIncludesBankTransfer ? (
                    <p className="text-foreground">
                      Payment can be made via{" "}
                      <span className="font-bold">bank transfer</span> to the
                      following account:
                    </p>
                  ) : null}
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
                  {q.terms && q.terms.length > 0 ? (
                    <div className="space-y-1 border-t border-border pt-2">
                      <p className="font-bold text-foreground">Payment Schedule</p>
                      {q.terms.map((term) => (
                        <div key={term.id} className="flex justify-between gap-3">
                          <span>{term.name}</span>
                          <span className="text-right tabular-nums">
                            {formatRupiah(term.amount)} · {term.dueDate ? formatLongDate(term.dueDate) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
                  {downPayment > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatRupiah(downPayment)}
                      </span>
                    </div>
                  )}
                  {others > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Others</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatRupiah(others)}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between border-t pt-2">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold tabular-nums text-foreground">
                      {formatRupiah(total)}
                    </span>
                  </div>
                  {q.taxDeposits && q.taxDeposits.length > 0 ? (
                    <div className="mt-3 space-y-1 border-t border-border pt-2">
                      <p className="font-bold text-foreground">Tax &amp; Deposit</p>
                      {q.taxDeposits.map((item) => (
                        <div key={item.id} className="flex justify-between gap-3 text-muted-foreground">
                          <span>{item.name}</span>
                          <span className="tabular-nums">{formatRupiah(item.nominal)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Catatan */}
              {q.notes && q.notes.trim() ? (
                <p className="mt-6 text-[11px] font-medium text-foreground">
                  {q.notes}
                </p>
              ) : null}

              {/* Cancellation & Refund Policy — editable per quotation, falls back to
                  the standard clause when not customized. */}
              <p className="mt-6 whitespace-pre-line text-[11px] font-medium text-foreground">
                {cancellationPolicy}
              </p>

              {/* Closing — editable per quotation, falls back to the standard closing
                  paragraph (with venue name interpolated) when not customized. */}
              <p className="mt-6 whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground">
                {closingNote}
              </p>

              {/* Signature */}
              <div className="mt-10 text-[11px]">
                <p className="text-foreground">
                  {q.signingLocation?.trim() || "Jakarta"},{" "}
                  {formatLongDate(q.issuedAt ?? q.createdAt)}
                </p>
                <div className="mt-2 w-56">
                  <div className="flex items-end justify-center h-20">
                    {q.signatureSales ? (
                      <Image
                        src={q.signatureSales}
                        alt="Tanda tangan sales"
                        width={224}
                        height={80}
                        unoptimized
                        className="max-h-20 w-auto object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="border-t border-foreground pt-1 text-center">
                    <p className="font-bold text-foreground">{q.salesName}</p>
                    <p className="text-muted-foreground">MICE Event Sales</p>
                  </div>
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
