"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDate, CloseCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

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
 * Inline Popover+Calendar datepicker for the general dashboard (`/`). Owns a
 * single filter — "Tanggal Dealing" (date range by booking createdAt) — that
 * drives every dealing-date-scoped section on the page via `dealFrom`/`dealTo`
 * search params. Reads the current params to prefill its local selection;
 * starts empty when absent — there is no default window, so the dashboard
 * shows all-time totals until a range is explicitly picked.
 *
 * Auto-applies when both `from` and `to` are selected (pushes URL). Waits for
 * `to` if only `from` is picked. A Reset chip outside the popover clears the
 * filter. Export name kept as `DashboardFilterDrawer` so page.tsx needs no
 * changes.
 */
export function DashboardFilterDrawer(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeRange: DateRange | undefined = (() => {
    const dealFrom = searchParams.get("dealFrom");
    const dealTo = searchParams.get("dealTo");
    if (!dealFrom && !dealTo) return undefined;
    const from = dealFrom ? parseIsoDay(dealFrom) : undefined;
    const to = dealTo ? parseIsoDay(dealTo) : from;
    return from ? { from, to } : undefined;
  })();

  // Pending selection inside the popover — separate from the committed URL state.
  const [pending, setPending] = useState<DateRange | undefined>(activeRange);

  function handleSelect(range: DateRange | undefined): void {
    setPending(range);
    // Auto-apply only when both ends are selected.
    if (range?.from && range?.to) {
      router.push(`/?dealFrom=${toIsoDay(range.from)}&dealTo=${toIsoDay(range.to)}`);
      setOpen(false);
    }
  }

  function handleReset(): void {
    setPending(undefined);
    router.push("/");
  }

  function handleOpenChange(next: boolean): void {
    if (next) {
      // Sync pending with currently committed range when re-opening.
      setPending(activeRange);
    }
    setOpen(next);
  }

  const hasActiveFilter = Boolean(activeRange?.from);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex items-center gap-2 h-9 px-4 text-sm rounded-full border border-input bg-background hover:bg-accent transition-colors text-left shrink-0"
            />
          }
        >
          <CalendarDate weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={hasActiveFilter ? "text-foreground font-medium" : "text-muted-foreground"}>
            {formatRangeLabel(activeRange)}
          </span>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={pending}
            onSelect={handleSelect}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={handleReset}
        >
          <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
          Reset
        </Button>
      )}
    </div>
  );
}
