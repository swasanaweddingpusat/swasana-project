"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Tuning2, CalendarMark, CalendarDate, CloseCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Local calendar day (not UTC) — avoids the off-by-one from toISOString().
// Duplicated here (not imported from lib/queries/dashboard.ts) because that
// file imports `db` (Prisma/Neon) at module scope and would break the client
// bundle if pulled into a "use client" component.
function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIsoDay(day: string): Date {
  return new Date(`${day}T00:00:00`);
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Pilih tanggal";
  const from = format(range.from, "d MMM yyyy");
  const to = range.to ? format(range.to, "d MMM yyyy") : from;
  return from === to ? from : `${from} – ${to}`;
}

/**
 * "Filter" trigger + Sheet drawer for the general dashboard (`/`). Owns a
 * single filter — "Tanggal Dealing" (date range by booking createdAt) — that
 * drives every dealing-date-scoped section on the page via `dealFrom`/`dealTo`
 * search params. Reads the current params to prefill its local selection;
 * starts empty when absent — there is no default window, so the dashboard
 * shows all-time totals until a range is explicitly picked.
 */
export function DashboardFilterDrawer(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const [range, setRange] = useState<DateRange | undefined>(() => {
    const dealFrom = searchParams.get("dealFrom");
    const dealTo = searchParams.get("dealTo");
    // No params → no default selection (dashboard shows all-time until picked).
    if (!dealFrom && !dealTo) return undefined;
    const from = dealFrom ? parseIsoDay(dealFrom) : undefined;
    const to = dealTo ? parseIsoDay(dealTo) : from;
    return from ? { from, to } : undefined;
  });

  function handleApply(): void {
    if (!range?.from) {
      // Nothing picked → clear any filter, back to all-time.
      router.push("/");
      setOpen(false);
      return;
    }
    const from = range.from;
    const to = range.to ?? from;
    router.push(`/?dealFrom=${toIsoDay(from)}&dealTo=${toIsoDay(to)}`);
    setOpen(false);
  }

  function handleReset(): void {
    router.push("/");
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="default" size="sm" className={cn("h-9", "shrink-0", "rounded-full")} />
        }
      >
        <Tuning2 weight="BoldDuotone" className="h-4 w-4" />
        Filter
      </SheetTrigger>

      <SheetContent side="right" showCloseButton={false}>
        <SheetHeader>
          <div className={cn("flex", "items-center", "justify-between")}>
            <SheetTitle>Filter Dashboard</SheetTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className={cn("p-1", "rounded-full", "bg-destructive/10", "hover:bg-destructive/20", "cursor-pointer")}
            >
              <CloseCircle weight="BoldDuotone" className={cn("h-6", "w-6", "text-destructive")} />
            </button>
          </div>
        </SheetHeader>

        <div className={cn("flex", "flex-col", "gap-3", "px-4")}>
          <div className={cn("flex", "items-center", "gap-2")}>
            <CalendarMark weight="BoldDuotone" className={cn("h-4", "w-4", "text-muted-foreground")} />
            <span className={cn("text-sm", "font-medium", "text-foreground")}>Tanggal Dealing</span>
          </div>

          <Popover>
            <PopoverTrigger
              className={cn(
                "flex h-10 w-full items-center justify-between rounded-full border border-input bg-background px-4 text-sm",
                "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !range?.from && "text-muted-foreground",
              )}
            >
              <span className="truncate">{formatRangeLabel(range)}</span>
              <CalendarDate weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} autoFocus />
            </PopoverContent>
          </Popover>
        </div>

        <SheetFooter className={cn("grid", "grid-cols-2", "gap-2")}>
          <Button variant="outline" className="rounded-full" onClick={handleReset}>
            Reset
          </Button>
          <Button variant="default" className="rounded-full" onClick={handleApply}>
            Terapkan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
