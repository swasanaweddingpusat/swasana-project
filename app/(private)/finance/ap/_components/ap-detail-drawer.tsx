"use client";

import { Drawer } from "@/components/shared/drawer";
import { Separator } from "@/components/ui/separator";
import {
  CategoryChip,
  StatusBadge,
  fmtDate,
  fmtRp,
  getApAckBadge,
  getApStatusBadge,
} from "./ap-format";
import type { APPayable } from "@/types/finance";

interface ApDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  payable: APPayable | null;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value || "-"}</span>
    </div>
  );
}

export function ApDetailDrawer({ isOpen, onClose, payable }: ApDetailDrawerProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={payable?.payeeName ?? "Detail Payable"}
      maxWidth="sm:max-w-xl"
    >
      {payable && (
        <div className="flex flex-col gap-5 px-1 pb-6">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <CategoryChip category={payable.category} />
              <StatusBadge config={getApStatusBadge(payable.status)} />
              <StatusBadge config={getApAckBadge(payable.ackStatus)} />
            </div>
            <p className="text-sm font-semibold text-foreground">{payable.title}</p>
          </section>

          <Separator />

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail</p>
            <InfoRow label="Payee" value={payable.payeeName} />
            <InfoRow label="Event" value={payable.eventName} />
            <InfoRow label="Tanggal Event" value={fmtDate(payable.eventDate)} />
            <InfoRow label="Jatuh Tempo" value={fmtDate(payable.dueDate)} />
            {payable.category === "tunjangan-wp" && (
              <InfoRow label="Event Selesai" value={payable.eventDone ? "Ya" : "Belum"} />
            )}
            {payable.notes && <InfoRow label="Catatan" value={payable.notes} />}
          </section>

          <Separator />

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ringkasan</p>
            <InfoRow label="Nominal" value={fmtRp(payable.amount)} />
            <InfoRow label="Sudah Dibayar" value={fmtRp(payable.paidAmount)} />
            <InfoRow label="Outstanding" value={fmtRp(payable.outstanding)} />
          </section>

          {payable.ackStatus === "acknowledged" && payable.acknowledgedByName && (
            <>
              <Separator />
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acknowledgment</p>
                <InfoRow label="Oleh" value={payable.acknowledgedByName} />
                <InfoRow label="Tanggal" value={fmtDate(payable.acknowledgedAt)} />
              </section>
            </>
          )}

          <Separator />

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Riwayat Pembayaran</p>
            {payable.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {payable.payments.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{pm.method}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(pm.paidAt)}
                        {pm.notes ? ` · ${pm.notes}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{fmtRp(pm.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
