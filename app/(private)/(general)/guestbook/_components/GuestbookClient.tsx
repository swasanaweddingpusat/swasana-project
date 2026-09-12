"use client";

import { useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  AddCircle,
  UsersGroupRounded,
  CheckCircle,
  CalendarMinimalistic,
  Eye,
  Pen,
  Refresh,
  TrashBinTrash,
  Download,
} from "@solar-icons/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useGuestbookEntries, useCheckOutGuestbookEntry, useDeleteGuestbookEntry } from "@/hooks/use-guestbook";
import { useVenues } from "@/hooks/use-venues";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";
import { exportGuestbookToPDF } from "@/lib/guestbook-export";
import { GuestbookDrawer } from "./GuestbookDrawer";
import { GuestbookDetailDrawer } from "./GuestbookDetailDrawer";

function resolvePhotoUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (!base) return null;
  return `${base}/${key}`;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  deal: { label: "Deal", className: "bg-green-100 text-green-700 border-0" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-0" },
  pending: { label: "Pending", className: "bg-gray-100 text-gray-700 border-0" },
  to_be_discuss: { label: "To Be Discuss", className: "bg-yellow-100 text-yellow-700 border-0" },
  lost: { label: "Lost", className: "bg-red-100 text-red-700 border-0" },
};

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(dateStr: string | Date): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function StatCard({
  icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  iconClass?: string;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-full bg-secondary ${iconClass ?? ""}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-20 rounded-full" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function MobileCard({
  entry,
  onCompleteClick,
  onViewClick,
  onEditClick,
  isCheckingOut,
}: {
  entry: GuestbookEntryItem;
  onCompleteClick: (entry: GuestbookEntryItem) => void;
  onViewClick: (entry: GuestbookEntryItem) => void;
  onEditClick: (entry: GuestbookEntryItem) => void;
  isCheckingOut: boolean;
}) {
  const sourceLabel = entry.sourceOfInformation?.name ?? null;
  const statusInfo = entry.visitStatus ? STATUS_LABELS[entry.visitStatus] : null;

  return (
    <div
      className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onViewClick(entry)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {(() => {
            const photoSrc = resolvePhotoUrl(entry.visitorPhotoUrl);
            if (photoSrc) {
              return <Image src={photoSrc} alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover shrink-0" unoptimized />;
            }
            return null;
          })()}
          <div>
            <p className="font-semibold text-foreground text-sm">{entry.visitorName}</p>
            {entry.company && (
              <p className="text-xs text-muted-foreground">{entry.company}</p>
            )}
            {entry.guestCode && (
              <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">{entry.guestCode}</p>
            )}
          </div>
        </div>
        {statusInfo ? (
          <Badge className={`rounded-full text-[11px] shrink-0 ${statusInfo.className}`}>
            {statusInfo.label}
          </Badge>
        ) : (
          <Badge variant="secondary" className="rounded-full text-[11px] shrink-0">
            —
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Venue</p>
          <p className="text-foreground">{entry.venue?.name ?? "-"}</p>
        </div>
        {sourceLabel && (
          <div>
            <p className="text-muted-foreground">Sumber</p>
            <p className="text-foreground">{sourceLabel}</p>
          </div>
        )}
        {entry.package && (
          <div>
            <p className="text-muted-foreground">Paket</p>
            <p className="text-foreground">{entry.package.packageName}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Bertemu</p>
          <p className="text-foreground">{entry.host?.fullName ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Dicatat oleh</p>
          <p className="text-foreground">{entry.createdBy?.fullName ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
        {entry.checkOutAt === null && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-green-600 hover:bg-green-50"
            onClick={() => onCompleteClick(entry)}
            disabled={isCheckingOut}
          >
            <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => onViewClick(entry)}
        >
          <Eye weight="BoldDuotone" className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => onEditClick(entry)}
        >
          <Pen weight="BoldDuotone" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function GuestbookClient() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GuestbookEntryItem | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<GuestbookEntryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GuestbookEntryItem | null>(null);
  const [editEntry, setEditEntry] = useState<GuestbookEntryItem | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filterVenueId, setFilterVenueId] = useState<string>("all");

  const queryClient = useQueryClient();
  const { data: guestbookData, isLoading } = useGuestbookEntries();
  const entries = guestbookData?.data ?? [];
  const { data: venues = [] } = useVenues();
  const checkOutMutation = useCheckOutGuestbookEntry();
  const deleteMutation = useDeleteGuestbookEntry();

  function handleExportPdf() {
    if (filteredEntries.length === 0) {
      toast.warning("Tidak ada data untuk diekspor");
      return;
    }
    exportGuestbookToPDF(filteredEntries);
    toast.success("PDF berhasil diunduh");
  }

  function handleCompleteClick(entry: GuestbookEntryItem) {
    setConfirmComplete(entry);
  }

  function handleEditClick(entry: GuestbookEntryItem) {
    setEditEntry(entry);
  }

  async function handleConfirmComplete() {
    if (!confirmComplete) return;
    const result = await checkOutMutation.mutateAsync(confirmComplete.id);
    if (result.success) {
      toast.success("Check-out berhasil");
    } else {
      toast.error(result.error ?? "Gagal check-out");
    }
    setConfirmComplete(null);
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const result = await deleteMutation.mutateAsync(confirmDelete.id);
    if (result.success) {
      toast.success("Data berhasil dihapus");
    } else {
      toast.error(result.error ?? "Gagal menghapus data");
    }
    setConfirmDelete(null);
  }

  const todayEntries = entries.filter((e) => isToday(e.checkInAt));
  const totalToday = todayEntries.length;

  const filteredEntries = entries.filter((e) => {
    const d = new Date(e.checkInAt);
    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
    }
    if (dateRange?.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    if (filterVenueId !== "all" && e.venueId !== filterVenueId) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Buku Tamu</h1>
          <p className="text-sm text-muted-foreground">Kelola data kunjungan tamu</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full gap-2 shrink-0"
            onClick={() => handleExportPdf()}
          >
            <Download weight="BoldDuotone" className="h-4 w-4" />
            Export PDF
          </Button>
          <Button
            className="rounded-full gap-2 shrink-0"
            onClick={() => setDrawerOpen(true)}
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            Tambah Tamu
          </Button>
        </div>
      </div>

      {/* Stats — single card */}
      <div className="grid grid-cols-1">
        <StatCard
          icon={<UsersGroupRounded weight="BoldDuotone" className="h-5 w-5 text-primary" />}
          label="Total Pengunjung Hari Ini"
          value={totalToday}
        />
      </div>

      {/* Table — desktop */}
      <Card className="rounded-2xl shadow-sm hidden sm:block">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 px-6 py-4 border-b">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Riwayat Kunjungan</h2>
                <span className="text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
                  {filteredEntries.length} tamu
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5" />
                <span>Filter</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger render={
                  <button
                    type="button"
                    className="flex items-center gap-2 h-8 px-3 text-xs rounded-full border border-input bg-background hover:bg-accent transition-colors text-left"
                  >
                    <CalendarMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>
                      {dateRange?.from && dateRange?.to
                        ? `${format(dateRange.from, "dd MMM yyyy", { locale: idLocale })} — ${format(dateRange.to, "dd MMM yyyy", { locale: idLocale })}`
                        : dateRange?.from
                          ? format(dateRange.from, "dd MMM yyyy", { locale: idLocale })
                          : "Pilih rentang tanggal"}
                    </span>
                  </button>
                } />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={dateRange}
                    onSelect={setDateRange}
                    locale={idLocale}
                  />
                </PopoverContent>
              </Popover>

              {dateRange?.from && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs h-8 text-muted-foreground"
                  onClick={() => setDateRange(undefined)}
                >
                  Reset
                </Button>
              )}

              <Select value={filterVenueId} onValueChange={setFilterVenueId}>
                <SelectTrigger className="rounded-full text-xs h-8 w-44">
                  <SelectValue placeholder="Semua Venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 gap-1.5"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["guestbook-entries"] })}
              >
                <Refresh weight="BoldDuotone" className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Tamu</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Bertemu</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dicatat oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows />
              </TableBody>
            </Table>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <UsersGroupRounded weight="BoldDuotone" className="h-10 w-10 opacity-30" />
              <p className="text-sm">Belum ada data kunjungan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Tamu</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Bertemu</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Paket</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dicatat oleh</TableHead>
                    <TableHead className="text-right pr-4">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const sourceLabel = entry.sourceOfInformation?.name ?? null;
                    const statusInfo = entry.visitStatus ? STATUS_LABELS[entry.visitStatus] : null;

                    return (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {(() => {
                              const photoSrc = resolvePhotoUrl(entry.visitorPhotoUrl);
                              if (photoSrc) {
                                return <Image src={photoSrc} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover shrink-0" unoptimized />;
                              }
                              return null;
                            })()}
                            <div className="leading-tight">
                              <p className="font-medium text-foreground">{entry.visitorName}</p>
                              {entry.company && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {entry.company}
                                </p>
                              )}
                              {entry.guestCode && (
                                <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                                  {entry.guestCode}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {entry.venue?.name ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.host?.fullName ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {sourceLabel ?? <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {entry.package?.packageName ?? <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell>
                          {statusInfo ? (
                            <Badge className={`rounded-full text-xs ${statusInfo.className}`}>
                              {statusInfo.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {entry.createdBy?.fullName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {entry.checkOutAt === null && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-green-600 hover:bg-green-50"
                                onClick={() => handleCompleteClick(entry)}
                                disabled={checkOutMutation.isPending}
                              >
                                <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => setSelectedEntry(entry)}
                            >
                              <Eye weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleEditClick(entry)}
                            >
                              <Pen weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmDelete(entry)}
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Mobile filter bar */}
        <div className="flex flex-col gap-2">
          <Popover>
            <PopoverTrigger render={
              <button
                type="button"
                className="flex items-center gap-2 h-8 px-3 text-xs rounded-full border border-input bg-background hover:bg-accent transition-colors text-left w-full"
              >
                <CalendarMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "dd MMM yyyy", { locale: idLocale })} — ${format(dateRange.to, "dd MMM yyyy", { locale: idLocale })}`
                    : dateRange?.from
                      ? format(dateRange.from, "dd MMM yyyy", { locale: idLocale })
                      : "Pilih rentang tanggal"}
                </span>
              </button>
            } />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={idLocale}
              />
            </PopoverContent>
          </Popover>

          <div className="flex gap-2">
            {dateRange?.from && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-xs h-8 text-muted-foreground"
                onClick={() => setDateRange(undefined)}
              >
                Reset
              </Button>
            )}

            <Select value={filterVenueId} onValueChange={setFilterVenueId}>
              <SelectTrigger className="rounded-full text-xs h-8 flex-1">
                <SelectValue placeholder="Semua Venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Venue</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs h-8 gap-1.5"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["guestbook-entries"] })}
            >
              <Refresh weight="BoldDuotone" className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="rounded-2xl shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!isLoading && filteredEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <UsersGroupRounded weight="BoldDuotone" className="h-10 w-10 opacity-30" />
            <p className="text-sm">Belum ada data kunjungan</p>
          </div>
        )}
        {!isLoading &&
          filteredEntries.map((entry) => (
            <MobileCard
              key={entry.id}
              entry={entry}
              onCompleteClick={handleCompleteClick}
              onViewClick={setSelectedEntry}
              onEditClick={handleEditClick}
              isCheckingOut={checkOutMutation.isPending}
            />
          ))}
      </div>

      <GuestbookDrawer
        isOpen={drawerOpen || editEntry !== null}
        onClose={() => {
          setDrawerOpen(false);
          setEditEntry(null);
        }}
        editEntry={editEntry}
      />

      <GuestbookDetailDrawer
        open={selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEntry(null);
          }
        }}
        entry={selectedEntry}
        allEntries={entries}
      />

      {/* Complete confirmation */}
      <AlertDialog
        open={confirmComplete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmComplete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Check-out</AlertDialogTitle>
            <AlertDialogDescription>
              Tandai &quot;{confirmComplete?.visitorName}&quot; sudah selesai kunjungan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={handleConfirmComplete}>
              Ya, Check-out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus data &quot;{confirmDelete?.visitorName}&quot;? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
