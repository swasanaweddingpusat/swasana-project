"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DocumentText } from "@solar-icons/react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceDueStatus = "overdue" | "due_soon" | "not_due_yet";

interface InvoiceDueRow {
  id: string;
  noPo: string;
  customer: string;
  namaTermin: string;
  dueDate: string;
  jumlah: number;
  status: InvoiceDueStatus;
}

// ─── Dummy data ───────────────────────────────────────────────────────────────

const DUMMY_INVOICES: InvoiceDueRow[] = [
  {
    id: "1",
    noPo: "PO-2026-0412",
    customer: "Budi & Sari Santoso",
    namaTermin: "DP 30%",
    dueDate: "2026-05-28",
    jumlah: 45_000_000,
    status: "overdue",
  },
  {
    id: "2",
    noPo: "PO-2026-0387",
    customer: "Ahmad Fauzi",
    namaTermin: "Pelunasan",
    dueDate: "2026-06-02",
    jumlah: 120_000_000,
    status: "overdue",
  },
  {
    id: "3",
    noPo: "PO-2026-0441",
    customer: "PT Maju Bersama",
    namaTermin: "Termin 2",
    dueDate: "2026-06-05",
    jumlah: 75_000_000,
    status: "due_soon",
  },
  {
    id: "4",
    noPo: "PO-2026-0398",
    customer: "Rudi & Dewi Hermawan",
    namaTermin: "DP 50%",
    dueDate: "2026-06-07",
    jumlah: 90_000_000,
    status: "due_soon",
  },
  {
    id: "5",
    noPo: "PO-2026-0455",
    customer: "Siti Rahayu",
    namaTermin: "Termin 1",
    dueDate: "2026-06-10",
    jumlah: 35_000_000,
    status: "not_due_yet",
  },
  {
    id: "6",
    noPo: "PO-2026-0389",
    customer: "CV Harmoni Event",
    namaTermin: "Pelunasan",
    dueDate: "2026-06-14",
    jumlah: 200_000_000,
    status: "not_due_yet",
  },
  {
    id: "7",
    noPo: "PO-2026-0421",
    customer: "Hendra & Lina Wijaya",
    namaTermin: "DP 30%",
    dueDate: "2026-06-18",
    jumlah: 60_000_000,
    status: "not_due_yet",
  },
  {
    id: "8",
    noPo: "PO-2026-0476",
    customer: "PT Global Solusi",
    namaTermin: "Termin 3",
    dueDate: "2026-06-22",
    jumlah: 150_000_000,
    status: "not_due_yet",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: InvoiceDueStatus }) {
  if (status === "overdue") {
    return (
      <Badge variant="destructive" className="rounded-full text-xs font-medium">
        Overdue
      </Badge>
    );
  }
  if (status === "due_soon") {
    return (
      <Badge
        variant="outline"
        className="rounded-full text-xs font-medium border-[var(--brand-gold)] text-[var(--brand-gold)]"
      >
        Jatuh Tempo
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="rounded-full text-xs font-medium"
    >
      Belum Jatuh Tempo
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoiceDueDateTable() {
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-4 grow min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2">
        <DocumentText
          weight="BoldDuotone"
          className="h-5 w-5 text-[var(--brand-gold)]"
        />
        <h3 className="text-sm font-semibold text-foreground">
          Invoice Jatuh Tempo Terdekat
        </h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-medium px-3 py-2.5 whitespace-nowrap">
                No PO
              </TableHead>
              <TableHead className="text-xs font-medium px-3 py-2.5">
                Customer
              </TableHead>
              <TableHead className="text-xs font-medium px-3 py-2.5 whitespace-nowrap">
                Nama Termin
              </TableHead>
              <TableHead className="text-xs font-medium px-3 py-2.5 whitespace-nowrap">
                Due Date
              </TableHead>
              <TableHead className="text-xs font-medium px-3 py-2.5 text-right whitespace-nowrap">
                Jumlah
              </TableHead>
              <TableHead className="text-xs font-medium px-3 py-2.5">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DUMMY_INVOICES.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  row.status === "overdue" && "bg-destructive/5 hover:bg-destructive/10",
                )}
              >
                <TableCell className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {row.noPo}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground max-w-40 truncate">
                  {row.customer}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm text-foreground whitespace-nowrap">
                  {row.namaTermin}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm text-foreground whitespace-nowrap">
                  {formatDate(row.dueDate)}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm font-semibold text-foreground text-right whitespace-nowrap">
                  {formatRupiah(row.jumlah)}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <StatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
