"use client";

import * as React from "react";
import { ClockCircle, CloseCircle } from "@solar-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Time picker dengan mode Single & Range dalam SATU control (popover).
 * Value disimpan sebagai string display:
 *   - single → "07.00"
 *   - range  → "07.00 - 13.00"
 */

type Mode = "single" | "range";

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "30", "45"];

function toDots(t: string): string {
  return t.replace(":", ".");
}

function parseValue(value: string): { mode: Mode; start: string; end: string } {
  if (!value || !value.trim()) return { mode: "single", start: "", end: "" };
  const parts = value.split("-").map((s) => s.trim().replace(/\./g, ":"));
  if (parts.length >= 2 && parts[1]) {
    return { mode: "range", start: parts[0], end: parts[1] };
  }
  return { mode: "single", start: parts[0], end: "" };
}

function formatValue(mode: Mode, start: string, end: string): string {
  if (!start) return "";
  if (mode === "range" && end) return `${toDots(start)} - ${toDots(end)}`;
  return toDots(start);
}

interface TimeColumnProps {
  label: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
}

function TimeColumn({ label, options, value, onSelect }: TimeColumnProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-44 w-full overflow-y-auto rounded-lg border border-border">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onSelect(o)}
            className={cn(
              "w-full px-2 py-2 text-sm tabular-nums transition-colors",
              value === o
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent"
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TimeBlockProps {
  hour: string;
  minute: string;
  onHour: (h: string) => void;
  onMinute: (m: string) => void;
}

function TimeBlock({ hour, minute, onHour, onMinute }: TimeBlockProps) {
  return (
    <div className="flex w-full items-end gap-1">
      <TimeColumn label="Jam" options={HOURS} value={hour} onSelect={onHour} />
      <span className="pb-3 text-lg font-bold text-muted-foreground">:</span>
      <TimeColumn
        label="Menit"
        options={MINUTES}
        value={minute}
        onSelect={onMinute}
      />
    </div>
  );
}

export interface TimeRangePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TimeRangePicker({
  value,
  onChange,
  placeholder = "Pilih waktu...",
  className,
}: TimeRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("single");
  const [startH, setStartH] = React.useState("");
  const [startM, setStartM] = React.useState("");
  const [endH, setEndH] = React.useState("");
  const [endM, setEndM] = React.useState("");

  // Sync internal state dari value HANYA saat popover dibuka — biar pilihan
  // setengah jadi (jam tanpa menit) gak ke-reset oleh value parent.
  React.useEffect(() => {
    if (!open) return;
    const p = parseValue(value);
    setMode(p.mode);
    setStartH(p.start ? (p.start.split(":")[0] ?? "") : "");
    setStartM(p.start ? (p.start.split(":")[1] ?? "") : "");
    setEndH(p.end ? (p.end.split(":")[0] ?? "") : "");
    setEndM(p.end ? (p.end.split(":")[1] ?? "") : "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function emit(next: {
    mode?: Mode;
    startH?: string;
    startM?: string;
    endH?: string;
    endM?: string;
  }) {
    const m = next.mode ?? mode;
    const sH = next.startH ?? startH;
    const sM = next.startM ?? startM;
    const eH = next.endH ?? endH;
    const eM = next.endM ?? endM;
    const start = sH && sM ? `${sH}:${sM}` : "";
    const end = eH && eM ? `${eH}:${eM}` : "";
    onChange(formatValue(m, start, end));
  }

  function handleClear() {
    setStartH("");
    setStartM("");
    setEndH("");
    setEndM("");
    onChange("");
  }

  function handleMode(m: Mode) {
    setMode(m);
    if (m === "single") {
      setEndH("");
      setEndM("");
    }
    emit({
      mode: m,
      endH: m === "single" ? "" : endH,
      endM: m === "single" ? "" : endM,
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <ClockCircle weight="BoldDuotone" className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{value || placeholder}</span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Hapus waktu"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                handleClear();
              }
            }}
            className="ml-1 rounded-full p-0.5 hover:bg-destructive/10"
          >
            <CloseCircle
              weight="BoldDuotone"
              className="h-4 w-4 text-muted-foreground hover:text-destructive"
            />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "max-w-[calc(100vw-2rem)] p-3",
          mode === "range" ? "w-96" : "w-72"
        )}
        align="start"
      >
        {/* Mode toggle */}
        <div className="mb-3 flex gap-1 rounded-full bg-muted p-1">
          <button
            type="button"
            onClick={() => handleMode("single")}
            className={cn(
              "flex-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              mode === "single"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Satu Waktu
          </button>
          <button
            type="button"
            onClick={() => handleMode("range")}
            className={cn(
              "flex-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              mode === "range"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Rentang
          </button>
        </div>

        <div className="flex items-start gap-4">
          {/* Mulai */}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="pb-1.5 text-xs font-semibold text-foreground">
              {mode === "range" ? "Mulai" : "Waktu"}
            </span>
            <TimeBlock
              hour={startH}
              minute={startM}
              onHour={(h) => {
                setStartH(h);
                emit({ startH: h });
              }}
              onMinute={(m) => {
                setStartM(m);
                emit({ startM: m });
              }}
            />
          </div>

          {/* Selesai (range only) */}
          {mode === "range" && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="pb-1.5 text-xs font-semibold text-foreground">
                Selesai
              </span>
              <TimeBlock
                hour={endH}
                minute={endM}
                onHour={(h) => {
                  setEndH(h);
                  emit({ endH: h });
                }}
                onMinute={(m) => {
                  setEndM(m);
                  emit({ endM: m });
                }}
              />
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-8 rounded-full px-4 text-xs"
          >
            Selesai
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
