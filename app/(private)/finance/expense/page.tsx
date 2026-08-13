"use client";

import { useMemo, useState } from "react";
import { AddCircle } from "@solar-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApFilterBar } from "../ap/_components/ap-filter-bar";
import { ApTable } from "../ap/_components/ap-table";
import { ApPayDrawer } from "../ap/_components/ap-pay-drawer";
import { ApDetailDrawer } from "../ap/_components/ap-detail-drawer";
import { AP_PAYABLES } from "../ap/_components/ap-dummy";
import type { APFilters, APPayable } from "@/types/finance";

const ROWS_PER_PAGE = 10;

export default function AccountsPayableExpensePage() {
  const [filters, setFilters] = useState<APFilters>({});
  const [detailTarget, setDetailTarget] = useState<APPayable | null>(null);
  const [payTarget, setPayTarget] = useState<APPayable | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    const q = filters.search?.toLowerCase().trim();
    return AP_PAYABLES.filter((p) => {
      if (p.category !== "general-expense") return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.ack && p.ackStatus !== filters.ack) return false;
      if (q && !`${p.payeeName} ${p.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filters]);

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4 px-2 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">General Expense</h1>
          <p className="text-xs text-muted-foreground">
            Pengeluaran operasional yang tidak terikat ke satu event.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 rounded-full"
          onClick={() => toast.info("Form input expense — segera hadir", { duration: 2000 })}
        >
          <AddCircle weight="BoldDuotone" className="size-4" />
          Tambah Expense
        </Button>
      </div>

      <ApFilterBar
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setCurrentPage(1);
        }}
        showCategory={false}
      />

      <ApTable
        payables={paginated}
        loading={false}
        onOpenDetail={setDetailTarget}
        onPay={setPayTarget}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        showCategory={false}
        showEvent={false}
        emptyLabel="Belum ada general expense."
      />

      <ApDetailDrawer isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} payable={detailTarget} />
      <ApPayDrawer isOpen={!!payTarget} onClose={() => setPayTarget(null)} payable={payTarget} />
    </div>
  );
}
