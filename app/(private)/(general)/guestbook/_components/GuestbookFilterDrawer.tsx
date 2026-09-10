"use client";

import type { DateRange } from "react-day-picker";
import { id as idLocale } from "date-fns/locale";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Magnifer } from "@solar-icons/react";

interface GuestbookFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  venueId: string;
  onVenueIdChange: (value: string) => void;
  hostId: string;
  onHostIdChange: (value: string) => void;
  venues: { id: string; name: string }[];
  salesOptions: { id: string; name: string }[];
  onReset: () => void;
}

export function GuestbookFilterDrawer({
  open,
  onClose,
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  venueId,
  onVenueIdChange,
  hostId,
  onHostIdChange,
  venues,
  salesOptions,
  onReset,
}: GuestbookFilterDrawerProps) {
  return (
    <Drawer isOpen={open} onClose={onClose} title="Filter Guestbook" maxWidth="sm:max-w-sm">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-5 pb-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Cari</Label>
            <div className="relative">
              <Magnifer
                weight="BoldDuotone"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Nama tamu / kode / host"
                className="rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tanggal Berkunjung</Label>
            <div className="flex justify-center rounded-xl border border-border">
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={dateRange}
                onSelect={onDateRangeChange}
                locale={idLocale}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Sales PIC</Label>
            <Select value={hostId} onValueChange={onHostIdChange}>
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue placeholder="Semua PIC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua PIC</SelectItem>
                {salesOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Venue</Label>
            <Select value={venueId} onValueChange={onVenueIdChange}>
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue placeholder="Semua Venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Venue</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
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
