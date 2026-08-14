"use client";

import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { DownloadMinimalistic, CalendarDate } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FinanceSummaryCards } from "../_components/FinanceSummaryCards";
import { GroupFinanceTable } from "../_components/GroupFinanceTable";
import { CollectionTrendChart } from "../_components/CollectionTrendChart";
import { AgingBreakdownChart } from "../_components/AgingBreakdownChart";
import { InvoiceDueDateTable } from "../_components/InvoiceDueDateTable";
import { ActionRequiredPanel } from "../_components/ActionRequiredPanel";
import { useFinanceOverview } from "@/hooks/useFinanceOverview";

// ─── Fallback empty summary ────────────────────────────────────────────────────

const EMPTY_SUMMARY = {
  kasDiterima: 0,
  piutang: 0,
  nilaiKontrak: 0,
  totalTarget: 0,
  totalConfirmed: 0,
  achievementPct: 0,
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

  const { data, isLoading } = useFinanceOverview();

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const groups = data?.groups ?? [];

  return (
    <div className="flex flex-col gap-6 py-6 px-2">

      {/* ── Section 1: Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Finance Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan posisi keuangan &amp; piutang usaha
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

      {/* ── Section 2: Finance Summary Cards (real data) ─────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-muted/40 animate-pulse h-40" />
          <div className="rounded-2xl bg-muted/40 animate-pulse h-40" />
        </div>
      ) : (
        <FinanceSummaryCards summary={summary} />
      )}

      {/* ── Section 3: Group Finance Breakdown Table (real data) ─────────────── */}
      {isLoading ? (
        <div className="rounded-2xl bg-muted/40 animate-pulse h-32" />
      ) : (
        <GroupFinanceTable groups={groups} />
      )}

      {/* ── Section 4: Charts (dummy — out of scope) ─────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <CollectionTrendChart />
        <AgingBreakdownChart />
      </div>

      {/* ── Section 5: Table + Panel (dummy — out of scope) ──────────────────── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <InvoiceDueDateTable />
        <ActionRequiredPanel />
      </div>

    </div>
  );
}
