"use client";

import { cn } from "@/lib/utils";
import { fmtDateTime, LEDGER_ACTIVITY_META } from "./ledger-format";
import type { LedgerActivity } from "./ledger-format";

interface LedgerActivityTimelineProps {
  activities: LedgerActivity[];
  /** Versi rapat buat dalam modal ack. */
  dense?: boolean;
  emptyLabel?: string;
}

/**
 * Timeline riwayat transaksi (append-only). Meniru pola activity-log booking,
 * tapi FE-only + pakai token warna (bukan hardcode). Terbaru di atas.
 */
export function LedgerActivityTimeline({
  activities,
  dense = false,
  emptyLabel = "Belum ada riwayat untuk transaksi ini.",
}: LedgerActivityTimelineProps): React.ReactElement {
  if (activities.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ol className={cn("relative ml-3 border-l border-border", dense ? "space-y-3" : "space-y-5")}>
      {activities.map((a) => {
        const meta = LEDGER_ACTIVITY_META[a.action];
        const { Icon } = meta;
        return (
          <li key={a.id} className="ml-4">
            {/* Dot */}
            <span
              className={cn(
                "absolute -left-[7px] mt-1 flex size-3.5 items-center justify-center rounded-full border-2 border-background",
                meta.dot,
              )}
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn("inline-flex items-center gap-1 text-sm font-medium", meta.text)}>
                <Icon weight="BoldDuotone" className="size-3.5" />
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}</span>
            </div>

            <p className="mt-0.5 text-sm text-foreground">
              {a.actorName}
              {a.actorRole && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({a.actorRole})</span>
              )}
            </p>

            {a.note && <p className="mt-0.5 text-sm text-muted-foreground">{a.note}</p>}

            {a.signatureDataUrl && (
              <div className="mt-1.5 inline-flex items-center justify-center rounded-lg border border-border bg-white p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.signatureDataUrl} alt="Tanda tangan" className="h-10 max-w-32 object-contain" />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
