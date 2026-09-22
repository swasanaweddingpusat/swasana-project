"use client";

import type { DateRange } from "react-day-picker";
import { id as idLocale } from "date-fns/locale";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { PROGRESS_STATUS_VALUES } from "@/lib/validations/daily-activity";
import type { ProgressStatus } from "@/lib/validations/daily-activity";
import type { DailyActivitySegmentOption } from "@/lib/queries/daily-activity";
import type { SalesMiceProfile } from "@/lib/queries/bookings";
import { PROGRESS_STATUS_LABELS } from "./progress-status";

const ALL_FILTER_VALUE = "all";

interface DailyActivityFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  activityDateRange: DateRange | undefined;
  onActivityDateRangeChange: (range: DateRange | undefined) => void;
  siteVisitRange: DateRange | undefined;
  onSiteVisitRangeChange: (range: DateRange | undefined) => void;
  progressStatus: ProgressStatus | "";
  onProgressStatusChange: (value: ProgressStatus | "") => void;
  segmentId: string;
  onSegmentIdChange: (value: string) => void;
  salesId: string;
  onSalesIdChange: (value: string) => void;
  segments: DailyActivitySegmentOption[];
  salesProfiles: SalesMiceProfile[];
  onReset: () => void;
}

export function DailyActivityFilterDrawer({
  open,
  onClose,
  activityDateRange,
  onActivityDateRangeChange,
  siteVisitRange,
  onSiteVisitRangeChange,
  progressStatus,
  onProgressStatusChange,
  segmentId,
  onSegmentIdChange,
  salesId,
  onSalesIdChange,
  segments,
  salesProfiles,
  onReset,
}: DailyActivityFilterDrawerProps) {
  return (
    <Drawer isOpen={open} onClose={onClose} title="Filter Daily Activity" maxWidth="sm:max-w-sm">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-5 pb-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tanggal Aktivitas</Label>
            <div className="flex justify-center rounded-xl border border-border">
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={activityDateRange}
                onSelect={onActivityDateRangeChange}
                locale={idLocale}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tanggal Site Visit</Label>
            <div className="flex justify-center rounded-xl border border-border">
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={siteVisitRange}
                onSelect={onSiteVisitRangeChange}
                locale={idLocale}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Status</Label>
            <Select
              value={progressStatus || ALL_FILTER_VALUE}
              onValueChange={(v) =>
                onProgressStatusChange(v === ALL_FILTER_VALUE ? "" : (v as ProgressStatus))
              }
            >
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue placeholder="Semua Progress" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Semua Progress</SelectItem>
                {PROGRESS_STATUS_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PROGRESS_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Segment</Label>
            <Select
              value={segmentId || ALL_FILTER_VALUE}
              onValueChange={(v) => onSegmentIdChange(v === ALL_FILTER_VALUE ? "" : v)}
            >
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue placeholder="Semua Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Semua Segment</SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Sales</Label>
            <Select
              value={salesId || ALL_FILTER_VALUE}
              onValueChange={(v) => onSalesIdChange(v === ALL_FILTER_VALUE ? "" : v)}
            >
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue placeholder="Semua Sales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Semua Sales</SelectItem>
                {salesProfiles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="sticky bottom-0 bg-background border-t border-border pt-4 mt-4 flex items-center gap-3">
          <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={onReset}>
            Reset
          </Button>
          <Button type="button" className="flex-1 rounded-full" onClick={onClose}>
            Terapkan
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
