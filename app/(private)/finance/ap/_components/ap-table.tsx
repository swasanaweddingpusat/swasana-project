"use client";

import { cn } from "@/lib/utils";
import {
  AltArrowLeft,
  AltArrowRight,
  Eye,
  HandMoney,
} from "@solar-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CategoryChip,
  StatusBadge,
  fmtDate,
  fmtRp,
  getApAckBadge,
  getApStatusBadge,
} from "./ap-format";
import type { APPayable } from "@/types/finance";

interface ApTableProps {
  payables: APPayable[];
  loading: boolean;
  onOpenDetail: (p: APPayable) => void;
  onPay: (p: APPayable) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Hide the category column on views already scoped to one category. */
  showCategory?: boolean;
  /** Hide the event column on the Expense view. */
  showEvent?: boolean;
  emptyLabel?: string;
}

const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
const THR = cn(TH, "text-right");

function genPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export function ApTable({
  payables,
  loading,
  onOpenDetail,
  onPay,
  currentPage,
  totalPages,
  onPageChange,
  showCategory = true,
  showEvent = true,
  emptyLabel = "Tidak ada data payable.",
}: ApTableProps) {
  const colCount = 5 + (showCategory ? 1 : 0) + (showEvent ? 1 : 0);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table className="table-fixed">
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="h-16">
                {Array.from({ length: colCount }).map((_, j) => (
                  <TableCell key={j} className="px-4">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: showEvent ? "22%" : "30%" }} />
            {showCategory && <col style={{ width: "13%" }} />}
            {showEvent && <col style={{ width: "16%" }} />}
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className={TH}>Payee / Keterangan</TableHead>
              {showCategory && <TableHead className={TH}>Kategori</TableHead>}
              {showEvent && <TableHead className={TH}>Event</TableHead>}
              <TableHead className={THR}>Outstanding</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className={TH}>Ack</TableHead>
              <TableHead className={cn(TH, "text-right")}>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              payables.map((p) => (
                <PayableRow
                  key={p.id}
                  payable={p}
                  showCategory={showCategory}
                  showEvent={showEvent}
                  onDetail={() => onOpenDetail(p)}
                  onPay={() => onPay(p)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <div className="flex flex-1 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="gap-1 rounded-full"
            >
              <AltArrowLeft weight="BoldDuotone" className="size-4" />
              Previous
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            {genPages(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="flex size-9 items-center justify-center text-sm font-medium text-muted-foreground">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p as number)}
                  className={cn(
                    "flex size-9 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-colors",
                    currentPage === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <div className="flex flex-1 items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="gap-1 rounded-full"
            >
              Next
              <AltArrowRight weight="BoldDuotone" className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PayableRow({
  payable,
  showCategory,
  showEvent,
  onDetail,
  onPay,
}: {
  payable: APPayable;
  showCategory: boolean;
  showEvent: boolean;
  onDetail: () => void;
  onPay: () => void;
}) {
  const statusBadge = getApStatusBadge(payable.status);
  const ackBadge = getApAckBadge(payable.ackStatus);
  const isPaid = payable.outstanding <= 0;
  const locked = !payable.eventDone && payable.category === "tunjangan-wp";

  return (
    <TableRow className="h-16 bg-card align-middle transition-colors hover:bg-secondary/40">
      <TableCell className="px-4 py-3 align-middle">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{payable.payeeName}</div>
          <div className="truncate text-xs text-muted-foreground">{payable.title}</div>
        </div>
      </TableCell>
      {showCategory && (
        <TableCell className="px-4 py-3 align-middle">
          <CategoryChip category={payable.category} />
        </TableCell>
      )}
      {showEvent && (
        <TableCell className="truncate px-4 py-3 align-middle text-sm text-foreground">
          {payable.eventName ? (
            <span>
              <span className="block truncate">{payable.eventName}</span>
              <span className="block text-xs text-muted-foreground">{fmtDate(payable.eventDate)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      <TableCell
        className={cn(
          "px-4 py-3 text-right align-middle text-sm tabular-nums",
          isPaid ? "text-muted-foreground" : "font-semibold text-foreground",
        )}
      >
        {fmtRp(payable.outstanding)}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <StatusBadge config={statusBadge} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <StatusBadge config={ackBadge} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-0.5">
          <button
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onDetail}
            title="Detail"
          >
            <Eye weight="BoldDuotone" className="size-4" />
          </button>
          {isPaid ? (
            <button disabled className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40" title="Sudah lunas">
              <HandMoney weight="BoldDuotone" className="size-4" />
            </button>
          ) : locked ? (
            <button disabled className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40" title="Menunggu event selesai">
              <HandMoney weight="BoldDuotone" className="size-4" />
            </button>
          ) : (
            <button
              className="cursor-pointer rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
              onClick={onPay}
              title="Bayar"
            >
              <HandMoney weight="BoldDuotone" className="size-4" />
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
