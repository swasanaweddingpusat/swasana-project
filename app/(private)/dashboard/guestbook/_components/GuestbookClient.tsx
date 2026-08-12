"use client";

import { useState } from "react";
import Image from "next/image";
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
  AddCircle,
  UsersGroupRounded,
  Login2,
  Logout2,
  CheckCircle,
} from "@solar-icons/react";
import { toast } from "sonner";
import { useGuestbookEntries, useCheckOutGuestbookEntry } from "@/hooks/use-guestbook";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";
import { GuestbookDrawer } from "./GuestbookDrawer";

function resolvePhotoUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (!base) return null;
  return `${base}/${key}`;
}

const PURPOSE_LABELS: Record<string, string> = {
  client_visit: "Kunjungan Client",
  vendor_meeting: "Meeting Vendor",
  interview: "Interview",
  delivery: "Pengiriman",
  other: "Lainnya",
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
          <TableCell><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-8 w-20 rounded-full" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function MobileCard({
  entry,
  onCheckOut,
  isCheckingOut,
}: {
  entry: GuestbookEntryItem;
  onCheckOut: (id: string) => void;
  isCheckingOut: boolean;
}) {
  const isActive = entry.checkOutAt === null;
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
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
          </div>
        </div>
        {isActive ? (
          <Badge className="rounded-full text-[11px] bg-green-100 text-green-700 border-0 shrink-0">
            Masih di Lokasi
          </Badge>
        ) : (
          <Badge variant="secondary" className="rounded-full text-[11px] shrink-0">
            Selesai
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>
          {PURPOSE_LABELS[entry.purpose] ?? entry.purpose}
        </span>
        {entry.purposeNote && (
          <span className="text-foreground/70 italic">({entry.purposeNote})</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Venue</p>
          <p className="text-foreground">{entry.venue?.name ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Jumlah</p>
          <p className="text-foreground">{entry.numberOfGuests} orang</p>
        </div>
        <div>
          <p className="text-muted-foreground">Bertemu</p>
          <p className="text-foreground">{entry.host?.fullName ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Check-in</p>
          <p className="text-foreground">
            {formatDate(entry.checkInAt)} {formatTime(entry.checkInAt)}
          </p>
        </div>
        {entry.checkOutAt && (
          <div>
            <p className="text-muted-foreground">Check-out</p>
            <p className="text-foreground">
              {formatDate(entry.checkOutAt)} {formatTime(entry.checkOutAt)}
            </p>
          </div>
        )}
      </div>

      {isActive && (
        <Button
          size="sm"
          variant="outline"
          className="w-full rounded-full text-xs gap-1.5"
          onClick={() => onCheckOut(entry.id)}
          disabled={isCheckingOut}
        >
          <Logout2 weight="BoldDuotone" className="h-3.5 w-3.5" />
          Check-out
        </Button>
      )}
    </div>
  );
}

export function GuestbookClient() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: entries = [], isLoading } = useGuestbookEntries();
  const checkOutMutation = useCheckOutGuestbookEntry();

  async function handleCheckOut(id: string) {
    const result = await checkOutMutation.mutateAsync(id);
    if (result.success) {
      toast.success("Check-out berhasil");
    } else {
      toast.error(result.error ?? "Gagal check-out");
    }
  }

  const todayEntries = entries.filter((e) => isToday(e.checkInAt));
  const totalToday = todayEntries.length;
  const currentlyIn = entries.filter((e) => e.checkOutAt === null).length;
  const checkedOutToday = todayEntries.filter((e) => e.checkOutAt !== null).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Guestbook</h1>
          <p className="text-sm text-muted-foreground">Kelola data kunjungan tamu</p>
        </div>
        <Button
          className="rounded-full gap-2 shrink-0"
          onClick={() => setDrawerOpen(true)}
        >
          <AddCircle weight="BoldDuotone" className="h-4 w-4" />
          Tambah Tamu
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<UsersGroupRounded weight="BoldDuotone" className="h-5 w-5 text-primary" />}
          label="Total Pengunjung Hari Ini"
          value={totalToday}
        />
        <StatCard
          icon={<Login2 weight="BoldDuotone" className="h-5 w-5 text-green-600" />}
          label="Masih di Lokasi"
          value={currentlyIn}
          iconClass="bg-green-100"
        />
        <StatCard
          icon={<CheckCircle weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />}
          label="Selesai Hari Ini"
          value={checkedOutToday}
        />
      </div>

      {/* Table — desktop */}
      <Card className="rounded-2xl shadow-sm hidden sm:block">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Riwayat Kunjungan</h2>
              <span className="text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
                {entries.length} tamu
              </span>
            </div>
          </div>

          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Tamu</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Tujuan</TableHead>
                  <TableHead>Bertemu</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows />
              </TableBody>
            </Table>
          ) : entries.length === 0 ? (
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
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Bertemu</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const isActive = entry.checkOutAt === null;
                    return (
                      <TableRow key={entry.id}>
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
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {entry.venue?.name ?? "-"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="secondary" className="rounded-full text-xs font-medium">
                              {PURPOSE_LABELS[entry.purpose] ?? entry.purpose}
                            </Badge>
                            {entry.purposeNote && (
                              <p className="text-xs text-muted-foreground italic">
                                {entry.purposeNote}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.host?.fullName ?? "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.numberOfGuests}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDate(entry.checkInAt)}{" "}
                          <span className="text-foreground font-medium">
                            {formatTime(entry.checkInAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <Badge className="rounded-full text-xs bg-green-100 text-green-700 border-0">
                              Masih di Lokasi
                            </Badge>
                          ) : (
                            <div className="space-y-0.5">
                              <Badge variant="secondary" className="rounded-full text-xs">
                                Selesai
                              </Badge>
                              {entry.checkOutAt && (
                                <p className="text-xs text-muted-foreground">
                                  {formatTime(entry.checkOutAt)}
                                </p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          {isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-xs gap-1.5"
                              onClick={() => handleCheckOut(entry.id)}
                              disabled={checkOutMutation.isPending}
                            >
                              <Logout2 weight="BoldDuotone" className="h-3.5 w-3.5" />
                              Check-out
                            </Button>
                          )}
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
        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <UsersGroupRounded weight="BoldDuotone" className="h-10 w-10 opacity-30" />
            <p className="text-sm">Belum ada data kunjungan</p>
          </div>
        )}
        {!isLoading &&
          entries.map((entry) => (
            <MobileCard
              key={entry.id}
              entry={entry}
              onCheckOut={handleCheckOut}
              isCheckingOut={checkOutMutation.isPending}
            />
          ))}
      </div>

      <GuestbookDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
