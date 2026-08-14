"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarDays, Download, CloseCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportBookingsModal({ open, onClose }: Props): React.JSX.Element {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  function resetAndClose(): void {
    setRange(undefined);
    setCalendarOpen(false);
    onClose();
  }

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (range?.from) params.set("dealingFrom", format(range.from, "yyyy-MM-dd"));
      if (range?.to) params.set("dealingTo", format(range.to, "yyyy-MM-dd"));

      const res = await fetch(`/api/booking/export?${params.toString()}`);
      if (!res.ok) {
        const msg =
          res.status === 429
            ? "Terlalu banyak permintaan, coba lagi sebentar."
            : "Gagal mengekspor data booking.";
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `booking-wedding-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export berhasil diunduh.");
      resetAndClose();
    } catch {
      toast.error("Gagal mengekspor data booking.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Booking Wedding</DialogTitle>
          <DialogDescription>
            Filter tanggal dealing bersifat opsional. Kosongkan untuk mengekspor semua data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Tanggal Dealing (range, opsional) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Tanggal Dealing{" "}
              <span className="font-normal text-muted-foreground">(opsional)</span>
            </label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 h-10 px-3 text-sm rounded-xl border border-input bg-background text-left",
                      "hover:bg-accent transition-colors",
                      range?.from ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <CalendarDays weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      {range?.from && range?.to
                        ? `${format(range.from, "dd MMM yyyy")} — ${format(range.to, "dd MMM yyyy")}`
                        : range?.from
                          ? format(range.from, "dd MMM yyyy")
                          : "Pilih rentang tanggal dealing"}
                    </span>
                    {range?.from && (
                      <CloseCircle
                        weight="BoldDuotone"
                        className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); setRange(undefined); }}
                      />
                    )}
                  </button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={range}
                  onSelect={setRange}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            className="flex-1"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download weight="BoldDuotone" className={cn("h-4 w-4", isExporting && "animate-pulse")} />
            {isExporting ? "Mengekspor..." : "Export Excel"}
          </Button>
          <Button type="button" variant="outline" onClick={resetAndClose} disabled={isExporting}>
            Batal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
