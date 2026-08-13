"use client";

import { cn } from "@/lib/utils";
import {
  AltArrowLeft,
  AltArrowRight,
  Eye,
  HandMoney,
  Forbidden,
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
import {
  StatusBadge,
  fmtDate,
  fmtRp,
  getPayoutTypeBadge,
  getPayoutStatusBadge,
} from "./payout-format";
import type { PayableRow } from "@/lib/queries/customer-payout";

/* ─── Pagination helper ──────────────────────────────────────────────────────── */

function genPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface PayableTableProps {
  payables: PayableRow[];
  onDisburse: (p: PayableRow) => void;
  onVoid: (p: PayableRow) => void;
  onDetail: (p: PayableRow) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyLabel?: string;
}

/* ─── Styles ─────────────────────────────────────────────────────────────────── */

const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
const THR = cn(TH, "text-right");

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function PayableTable({
  payables,
  onDisburse,
  onVoid,
  onDetail,
  currentPage,
  totalPages,
  onPageChange,
  emptyLabel = "Tidak ada data customer payout.",
}: PayableTableProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: "24%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className={TH}>Client</TableHead>
              <TableHead className={TH}>Tipe</TableHead>
              <TableHead className={THR}>Jumlah</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className={TH}>No. Disbursement</TableHead>
              <TableHead className={cn(TH, "text-right")}>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              payables.map((p) => (
                <PayableRowItem
                  key={p.id}
                  payable={p}
                  onDisburse={() => onDisburse(p)}
                  onVoid={() => onVoid(p)}
                  onDetail={() => onDetail(p)}
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
                <span
                  key={`e${i}`}
                  className="flex size-9 items-center justify-center text-sm font-medium text-muted-foreground"
                >
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

/* ─── Row component ──────────────────────────────────────────────────────────── */

function PayableRowItem({
  payable,
  onDisburse,
  onVoid,
  onDetail,
}: {
  payable: PayableRow;
  onDisburse: () => void;
  onVoid: () => void;
  onDetail: () => void;
}): React.ReactElement {
  const typeBadge = getPayoutTypeBadge(payable.type);
  const statusBadge = getPayoutStatusBadge(payable.status);
  const isOutstanding = payable.status === "outstanding";

  return (
    <TableRow className="h-16 bg-card align-middle transition-colors hover:bg-secondary/40">
      <TableCell className="px-4 py-3 align-middle">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{payable.clientName}</div>
          {payable.settledAt && (
            <div className="truncate text-xs text-muted-foreground">
              Dicairkan {fmtDate(payable.settledAt)}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <StatusBadge config={typeBadge} />
      </TableCell>
      <TableCell className="px-4 py-3 text-right align-middle text-sm font-semibold tabular-nums text-foreground">
        {fmtRp(payable.amount)}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <StatusBadge config={statusBadge} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        {payable.disbursementNumber ? (
          <span className="font-mono text-xs text-foreground">{payable.disbursementNumber}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
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
          {isOutstanding ? (
            <>
              <button
                className="cursor-pointer rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
                onClick={onDisburse}
                title="Cairkan"
              >
                <HandMoney weight="BoldDuotone" className="size-4" />
              </button>
              <button
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={onVoid}
                title="Batalkan"
              >
                <Forbidden weight="BoldDuotone" className="size-4" />
              </button>
            </>
          ) : (
            <>
              <button
                disabled
                className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40"
                title="Sudah diproses"
              >
                <HandMoney weight="BoldDuotone" className="size-4" />
              </button>
              <button
                disabled
                className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40"
                title="Tidak bisa dibatalkan"
              >
                <Forbidden weight="BoldDuotone" className="size-4" />
              </button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
