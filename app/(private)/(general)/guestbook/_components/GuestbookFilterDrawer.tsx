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
import { ComplimentarySelect } from "@/components/shared/ComplimentarySelect";
import { Magnifer } from "@solar-icons/react";
import type { GuestbookCategoryFilter } from "@/lib/queries/guestbookEntries";
import type { GuestInteractionType } from "@prisma/client";

const EVENT_CATEGORY_OPTIONS = [
  { value: "WEDDINGS", label: "Wedding" },
  { value: "MICE", label: "MICE" },
  { value: "no_package", label: "Belum Ada Paket" },
] as const;

const INTERACTION_TYPE_OPTIONS = [
  { value: "client_visit", label: "Kunjungan Client" },
  { value: "online_meeting", label: "Online Meeting" },
  { value: "jemput_bola", label: "Jemput Bola" },
] as const;

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
  category: "all" | GuestbookCategoryFilter;
  onCategoryChange: (value: "all" | GuestbookCategoryFilter) => void;
  interactionType: "all" | GuestInteractionType;
  onInteractionTypeChange: (value: "all" | GuestInteractionType) => void;
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
  category,
  onCategoryChange,
  interactionType,
  onInteractionTypeChange,
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
            <ComplimentarySelect
              options={[{ id: "all", name: "Semua PIC" }, ...salesOptions]}
              value={hostId}
              onChange={onHostIdChange}
              placeholder="Semua PIC"
              searchPlaceholder="Cari sales..."
              emptyText="Sales tidak ditemukan"
              triggerClassName="rounded-xl"
            />
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

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Event</Label>
            <Select
              value={category}
              onValueChange={(v) => onCategoryChange(v as "all" | GuestbookCategoryFilter)}
            >
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue placeholder="Semua Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Event</SelectItem>
                {EVENT_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Jenis Interaksi</Label>
            <Select
              value={interactionType}
              onValueChange={(v) => onInteractionTypeChange(v as "all" | GuestInteractionType)}
            >
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue placeholder="Semua Interaksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Interaksi</SelectItem>
                {INTERACTION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
