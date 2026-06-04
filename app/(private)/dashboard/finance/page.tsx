"use client";

import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  DownloadMinimalistic,
  CalendarDate,
} from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { KpiCards } from "./_components/KpiCards";
import { CollectionTrendChart } from "./_components/CollectionTrendChart";
import { AgingBreakdownChart } from "./_components/AgingBreakdownChart";
import { InvoiceDueDateTable } from "./_components/InvoiceDueDateTable";
import { ActionRequiredPanel } from "./_components/ActionRequiredPanel";
import type { FinanceKpi } from "./_components/KpiCards";

// ─── Dummy KPI data ───────────────────────────────────────────────────────────

const MOCK_KPI: FinanceKpi = {
  totalAR: 2_120_000_000,
  sudahTertagih: 1_450_000_000,
  outstanding: 670_000_000,
  overdue: 180_000_000,
  collectionRate: 68.4,
  invoiceBelumTerbit: 4,
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDateLabel(date: Date): string {
  return format(date, "d MMM yyyy", { locale: idLocale });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 py-6 px-2">

      {/* ── Section 1: Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Finance Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan posisi keuangan & piutang usaha
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date from */}
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-1.5 font-normal"
                >
                  <CalendarDate weight="BoldDuotone" className="h-4 w-4" />
                  {formatDateLabel(dateFrom)}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => {
                  if (d) {
                    setDateFrom(d);
                    setFromOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground">–</span>

          {/* Date to */}
          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-1.5 font-normal"
                >
                  <CalendarDate weight="BoldDuotone" className="h-4 w-4" />
                  {formatDateLabel(dateTo)}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => {
                  if (d) {
                    setDateTo(d);
                    setToOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Export */}
          <Button size="sm" className="rounded-full gap-1.5">
            <DownloadMinimalistic weight="BoldDuotone" className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* ── Section 2: KPI Cards ─────────────────────────────────────────────── */}
      <KpiCards kpi={MOCK_KPI} />

      {/* ── Section 3: Charts ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <CollectionTrendChart />
        <AgingBreakdownChart />
      </div>

      {/* ── Section 4: Table + Panel ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <InvoiceDueDateTable />
        <ActionRequiredPanel />
      </div>

    </div>
  );
}
