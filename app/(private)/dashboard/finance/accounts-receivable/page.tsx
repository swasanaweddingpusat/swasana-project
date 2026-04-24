"use client";

import { useState, useMemo } from "react";
import { ARFilterBar } from "./_components/ar-filter-bar";
import { ARTable } from "./_components/ar-table";
import { ARDetailDrawer } from "./_components/ar-detail-drawer";
import type { ARBooking, ARFilters } from "@/types/finance";

const MOCK_BOOKINGS: ARBooking[] = [
  {
    id: "1", noPo: "PO/2026/001", customerEvent: "Budi & Siti", customerDate: "2026-06-15",
    namaEvent: "Pernikahan Budi & Siti", totalPrice: 85000000, outstanding: 25000000,
    jatuhTempo: "2026-05-01", statusTermin: "partial",
    termins: [
      { id: "t1", name: "DP 30%", dueDate: "2026-03-01", amount: 25500000, status: "paid", noInvoice: "INV/2026/001", statusInvoice: "paid", agingDays: null, catatan: "" },
      { id: "t2", name: "Termin 2 - 40%", dueDate: "2026-05-01", amount: 34000000, status: "partial", noInvoice: "INV/2026/002", statusInvoice: "partial", agingDays: 12, catatan: "Menunggu pelunasan" },
      { id: "t3", name: "Pelunasan 30%", dueDate: "2026-06-10", amount: 25500000, status: "not_due_yet", noInvoice: "", statusInvoice: "unissued", agingDays: null, catatan: "" },
    ],
  },
  {
    id: "2", noPo: "PO/2026/002", customerEvent: "Ahmad & Dewi", customerDate: "2026-07-20",
    namaEvent: "Pernikahan Ahmad & Dewi", totalPrice: 120000000, outstanding: 120000000,
    jatuhTempo: "2026-04-15", statusTermin: "overdue",
    termins: [
      { id: "t4", name: "DP 30%", dueDate: "2026-04-15", amount: 36000000, status: "overdue", noInvoice: "INV/2026/003", statusInvoice: "unpaid", agingDays: 8, catatan: "Sudah diingatkan 2x" },
      { id: "t5", name: "Termin 2 - 40%", dueDate: "2026-06-15", amount: 48000000, status: "not_due_yet", noInvoice: "", statusInvoice: "unissued", agingDays: null, catatan: "" },
      { id: "t6", name: "Pelunasan 30%", dueDate: "2026-07-15", amount: 36000000, status: "not_due_yet", noInvoice: "", statusInvoice: "unissued", agingDays: null, catatan: "" },
    ],
  },
  {
    id: "3", noPo: "PO/2026/003", customerEvent: "Rudi & Yuni", customerDate: "2026-08-10",
    namaEvent: "Pernikahan Rudi & Yuni", totalPrice: 65000000, outstanding: 0,
    jatuhTempo: "2026-07-30", statusTermin: "paid",
    termins: [
      { id: "t7", name: "DP 50%", dueDate: "2026-03-10", amount: 32500000, status: "paid", noInvoice: "INV/2026/004", statusInvoice: "paid", agingDays: null, catatan: "" },
      { id: "t8", name: "Pelunasan 50%", dueDate: "2026-07-30", amount: 32500000, status: "paid", noInvoice: "INV/2026/005", statusInvoice: "paid", agingDays: null, catatan: "" },
    ],
  },
  {
    id: "4", noPo: "PO/2026/004", customerEvent: "Hendra & Rina", customerDate: "2026-09-05",
    namaEvent: "Pernikahan Hendra & Rina", totalPrice: 95000000, outstanding: 95000000,
    jatuhTempo: "2026-05-20", statusTermin: "unpaid",
    termins: [
      { id: "t9", name: "DP 30%", dueDate: "2026-05-20", amount: 28500000, status: "unpaid", noInvoice: "INV/2026/006", statusInvoice: "unpaid", agingDays: null, catatan: "" },
    ],
  },
];

const ROWS_PER_PAGE = 10;

export default function AccountsReceivablePage() {
  const [filters, setFilters] = useState<ARFilters>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<ARBooking | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    return MOCK_BOOKINGS.filter((b) => {
      if (filters.status && b.statusTermin !== filters.status) return false;
      return true;
    });
  }, [filters]);

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4 py-6 px-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-bold text-[#1D1D1D]">Accounts Receivable</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} booking</span>
      </div>

      {/* Filter Bar */}
      <ARFilterBar filters={filters} onFiltersChange={(f) => { setFilters(f); setCurrentPage(1); }} />

      {/* Table */}
      <ARTable
        bookings={paginated}
        loading={false}
        expandedRow={expandedRow}
        onToggleRow={(id) => setExpandedRow((prev) => prev === id ? null : id)}
        onOpenDetail={(b) => setDetailBooking(b)}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Detail Drawer */}
      <ARDetailDrawer
        isOpen={!!detailBooking}
        onClose={() => setDetailBooking(null)}
        booking={detailBooking}
      />
    </div>
  );
}
