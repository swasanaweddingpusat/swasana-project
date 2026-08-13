"use client";

import { Drawer } from "@/components/shared/drawer";
import { Separator } from "@/components/ui/separator";
import type { ARBooking } from "@/types/finance";

interface ARDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ARBooking | null;
}

function fmtRp(n: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
}

function fmtDate(d: string): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right">{value || "-"}</span>
    </div>
  );
}

export function ARDetailDrawer({ isOpen, onClose, booking }: ARDetailDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={booking?.customerEvent ?? "Detail AR"} maxWidth="sm:max-w-2xl">
      {booking && (
        <div className="flex flex-col gap-5 px-1 pb-6">
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Booking</p>
            <InfoRow label="No. PO" value={booking.noPo} />
            <InfoRow label="Tanggal Event" value={fmtDate(booking.customerDate)} />
            <InfoRow label="Venue" value={booking.namaEvent} />
            {booking.brandName && <InfoRow label="Brand" value={booking.brandName} />}
            {booking.packageName && <InfoRow label="Paket" value={booking.packageName} />}
            <InfoRow label="Sales PIC" value={booking.salesPicName} />
          </section>

          <Separator />

          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
            <InfoRow label="Nama" value={booking.customerEvent} />
            <InfoRow label="Email" value={booking.customerEmail} />
            <InfoRow label="No. HP" value={booking.customerPhone} />
          </section>

          <Separator />

          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ringkasan Pembayaran</p>
            <InfoRow label="Total" value={fmtRp(booking.totalPrice)} />
            <InfoRow label="Outstanding" value={fmtRp(booking.outstanding)} />
          </section>

          <Separator />

          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Detail Termin</p>
            <div className="flex flex-col gap-3">
              {booking.termins.map((termin) => (
                <div key={termin.id} className="rounded-lg border p-3 bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{termin.name}</span>
                    <span className="text-xs text-muted-foreground">Due: {fmtDate(termin.dueDate)}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium text-foreground">{fmtRp(termin.amount)}</span>
                  </div>

                  {termin.status !== "paid" && termin.remaining !== termin.amount && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sisa</span>
                      <span className="font-medium text-destructive">{fmtRp(termin.remaining)}</span>
                    </div>
                  )}

                  {termin.noInvoice && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">No. Invoice</span>
                      <span className="text-foreground">{termin.noInvoice}</span>
                    </div>
                  )}

                  {termin.catatan && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{termin.catatan}</p>
                  )}

                  {termin.partialPayments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1.5">Riwayat Pembayaran</p>
                      {termin.partialPayments.map((pp) => (
                        <div key={pp.id} className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-muted-foreground">{fmtDate(pp.paidAt)}</span>
                          <span className="text-foreground font-medium">{fmtRp(pp.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}
