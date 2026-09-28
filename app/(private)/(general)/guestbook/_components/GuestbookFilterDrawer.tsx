"use client";

import type { DateRange } from "react-day-picker";
import { id as idLocale } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { ComplimentarySelect } from "@/components/shared/ComplimentarySelect";
import { MultiSelect } from "@/components/shared/multi-select";
import { Magnifer } from "@solar-icons/react";
import type { GuestbookCategoryFilter } from "@/lib/queries/guestbookEntries";
import type { GuestInteractionType, GuestVisitStatus } from "@prisma/client";

type SourceOption = { id: string; name: string };
type FestivalOption = { id: string; name: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch error ${res.status}`);
  return res.json() as Promise<T>;
}

const EVENT_CATEGORY_OPTIONS = [
  { value: "WEDDINGS", label: "Wedding" },
  { value: "MICE", label: "MICE" },
  { value: "no_package", label: "Belum Ada Paket" },
] as const;

const INTERACTION_TYPE_OPTIONS = [
  { value: "client_visit", label: "Database" },
  { value: "online_meeting", label: "Online Meeting" },
  { value: "jemput_bola", label: "Survey" },
] as const;

const STATUS_OPTIONS = [
  { value: "cold", label: "Cold" },
  { value: "warm", label: "Warm" },
  { value: "hot", label: "Hot" },
  { value: "done_visit", label: "Done Visit" },
  { value: "to_be_discuss", label: "To Be Discuss" },
  { value: "deal", label: "Deal" },
  { value: "lost", label: "Lost" },
] as const;

interface GuestbookFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  venueIds: string[];
  onVenueIdsChange: (value: string[]) => void;
  hostId: string;
  onHostIdChange: (value: string) => void;
  categories: GuestbookCategoryFilter[];
  onCategoriesChange: (value: GuestbookCategoryFilter[]) => void;
  interactionTypes: GuestInteractionType[];
  onInteractionTypesChange: (value: GuestInteractionType[]) => void;
  statuses: GuestVisitStatus[];
  onStatusesChange: (value: GuestVisitStatus[]) => void;
  sourceOfInformationIds: string[];
  onSourceOfInformationIdsChange: (value: string[]) => void;
  festivalIds: string[];
  onFestivalIdsChange: (value: string[]) => void;
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
  venueIds,
  onVenueIdsChange,
  hostId,
  onHostIdChange,
  categories,
  onCategoriesChange,
  interactionTypes,
  onInteractionTypesChange,
  statuses,
  onStatusesChange,
  sourceOfInformationIds,
  onSourceOfInformationIdsChange,
  festivalIds,
  onFestivalIdsChange,
  venues,
  salesOptions,
  onReset,
}: GuestbookFilterDrawerProps) {
  const { data: sourceOptions = [] } = useQuery({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchJson<SourceOption[]>("/api/source-of-informations"),
  });
  const { data: festivalOptions = [] } = useQuery({
    queryKey: ["festivals"],
    queryFn: () => fetchJson<FestivalOption[]>("/api/festivals"),
  });

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
                placeholder="Nama / kode / telepon / host"
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
            <MultiSelect
              options={venues}
              value={venueIds}
              onChange={onVenueIdsChange}
              placeholder="Semua Venue"
              searchPlaceholder="Cari venue..."
              emptyText="Venue tidak ditemukan"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Event</Label>
            <MultiSelect
              options={EVENT_CATEGORY_OPTIONS.map((opt) => ({ id: opt.value, name: opt.label }))}
              value={categories}
              onChange={(v) => onCategoriesChange(v as GuestbookCategoryFilter[])}
              placeholder="Semua Event"
              searchPlaceholder="Cari event..."
              emptyText="Event tidak ditemukan"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Jenis Interaksi</Label>
            <MultiSelect
              options={INTERACTION_TYPE_OPTIONS.map((opt) => ({ id: opt.value, name: opt.label }))}
              value={interactionTypes}
              onChange={(v) => onInteractionTypesChange(v as GuestInteractionType[])}
              placeholder="Semua Interaksi"
              searchPlaceholder="Cari jenis interaksi..."
              emptyText="Jenis interaksi tidak ditemukan"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Status</Label>
            <MultiSelect
              options={STATUS_OPTIONS.map((opt) => ({ id: opt.value, name: opt.label }))}
              value={statuses}
              onChange={(v) => onStatusesChange(v as GuestVisitStatus[])}
              placeholder="Semua Status"
              searchPlaceholder="Cari status..."
              emptyText="Status tidak ditemukan"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Sumber Data</Label>
            <MultiSelect
              options={sourceOptions}
              value={sourceOfInformationIds}
              onChange={onSourceOfInformationIdsChange}
              placeholder="Semua Sumber"
              searchPlaceholder="Cari sumber..."
              emptyText="Sumber tidak ditemukan"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Festival</Label>
            <MultiSelect
              options={festivalOptions}
              value={festivalIds}
              onChange={onFestivalIdsChange}
              placeholder="Semua Festival"
              searchPlaceholder="Cari festival..."
              emptyText="Festival tidak ditemukan"
              className="rounded-xl"
            />
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
