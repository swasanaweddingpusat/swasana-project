"use client";

import { useMemo, useState } from "react";
import { AltArrowDown, Bill, UsersGroupRounded } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fmtRp,
  fmtDate,
  getTerminBadge,
  getInvoiceBadge,
  getAckBadge,
  StatusBadge,
} from "./ar-format";
import type { ARBooking, ARTermin } from "@/types/finance";

/** One client (booking) plus a flattened, ready-to-render list of its termins. */
export interface ClientTerminGroup {
  bookingId: string;
  clientName: string;
  noPo: string;
  namaEvent: string;
  eventDate: string;
  totalPrice: number;
  outstanding: number;
  termins: ARTermin[];
}

/** Group AR bookings into per-client buckets for the accordion. */
export function groupByClient(bookings: ARBooking[]): ClientTerminGroup[] {
  return bookings.map((b) => ({
    bookingId: b.id,
    clientName: b.customerEvent,
    noPo: b.noPo,
    namaEvent: b.namaEvent,
    eventDate: b.customerDate,
    totalPrice: b.totalPrice,
    outstanding: b.outstanding,
    termins: b.termins,
  }));
}

interface TerminAccordionProps {
  groups: ClientTerminGroup[];
  loading: boolean;
  /** Set of bookingIds currently open. */
  openIds: Set<string>;
  onToggle: (bookingId: string) => void;
}

export function TerminAccordion({
  groups,
  loading,
  openIds,
  onToggle,
}: TerminAccordionProps): React.ReactElement {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <Bill weight="BoldDuotone" className="h-10 w-10 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">Belum ada termin</p>
          <p className="text-sm text-muted-foreground">
            Termin muncul setelah booking dikonfirmasi (client sudah approve).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <ClientGroupCard
          key={group.bookingId}
          group={group}
          open={openIds.has(group.bookingId)}
          onToggle={() => onToggle(group.bookingId)}
        />
      ))}
    </div>
  );
}

/* ─── Per-client accordion card ────────────────────────────────────────────── */

function ClientGroupCard({
  group,
  open,
  onToggle,
}: {
  group: ClientTerminGroup;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <UsersGroupRounded weight="BoldDuotone" className="h-5 w-5 text-primary" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {group.clientName}
            </span>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {group.termins.length} termin
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{group.noPo}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{group.namaEvent}</span>
          </span>
        </span>

        <span className="hidden shrink-0 flex-col items-end sm:flex">
          <span className="text-xs text-muted-foreground">Outstanding</span>
          <span className="text-sm font-semibold text-foreground">
            {fmtRp(group.outstanding)}
          </span>
        </span>

        <AltArrowDown
          weight="BoldDuotone"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary hover:bg-secondary">
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">Termin</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">Due Date</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">Amount</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">Sisa</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">Status Termin</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">No Invoice</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">Status Invoice</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">Aging</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold text-muted-foreground">Piutang Ack</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.termins.map((t) => (
                <TerminLine key={t.id} termin={t} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TerminLine({ termin }: { termin: ARTermin }) {
  return (
    <TableRow className="bg-background hover:bg-secondary/30">
      <TableCell className="px-4 py-3 text-sm font-medium text-foreground">{termin.name}</TableCell>
      <TableCell className="px-4 py-3 text-sm text-foreground">{fmtDate(termin.dueDate)}</TableCell>
      <TableCell className="px-4 py-3 text-sm font-semibold text-foreground">{fmtRp(termin.amount)}</TableCell>
      <TableCell className="px-4 py-3 text-sm text-foreground">{fmtRp(termin.remaining)}</TableCell>
      <TableCell className="px-4 py-3"><StatusBadge config={getTerminBadge(termin.status)} /></TableCell>
      <TableCell className="px-4 py-3 text-sm text-foreground">{termin.noInvoice || "-"}</TableCell>
      <TableCell className="px-4 py-3"><StatusBadge config={getInvoiceBadge(termin.statusInvoice)} /></TableCell>
      <TableCell className="px-4 py-3 text-sm text-foreground">
        {termin.agingDays != null ? `+${termin.agingDays}` : "-"}
      </TableCell>
      <TableCell className="px-4 py-3">
        <div className="space-y-0.5">
          <StatusBadge config={getAckBadge(termin.ackStatus)} />
          {termin.acknowledgedAt && termin.acknowledgedByName && (
            <p className="text-xs text-muted-foreground">
              {termin.acknowledgedByName} · {fmtDate(termin.acknowledgedAt)}
            </p>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ─── Hook: manage open/closed state with default-all-open ─────────────────── */

export function useAccordionState(groups: ClientTerminGroup[]) {
  // Track which groups the user has explicitly closed. Everything else is open
  // by default, so newly-loaded groups start expanded without an effect.
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());

  const openIds = useMemo(() => {
    const s = new Set<string>();
    groups.forEach((g) => {
      if (!closedIds.has(g.bookingId)) s.add(g.bookingId);
    });
    return s;
  }, [groups, closedIds]);

  function toggle(bookingId: string) {
    setClosedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  }

  function expandAll() {
    setClosedIds(new Set());
  }

  function collapseAll() {
    setClosedIds(new Set(groups.map((g) => g.bookingId)));
  }

  const allOpen = openIds.size === groups.length && groups.length > 0;

  return { openIds, toggle, expandAll, collapseAll, allOpen };
}
