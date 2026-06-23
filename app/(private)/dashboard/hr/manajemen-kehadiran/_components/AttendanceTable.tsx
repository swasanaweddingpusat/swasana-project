"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAttendanceList } from "@/hooks/use-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoPreviewModal } from "./PhotoPreviewModal";
import { Gallery, ArrowLeft, ArrowRight } from "@solar-icons/react";
import type { AttendanceListItem } from "@/lib/queries/attendance";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  on_time: { label: "Hadir", variant: "default" },
  late: { label: "Terlambat", variant: "secondary" },
  absent: { label: "Absen", variant: "destructive" },
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTimeShort(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function AttendanceTable() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceListItem | null>(null);

  const month = Number(searchParams.get("month")) || (new Date().getMonth() + 1);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const profileId = searchParams.get("profileId") ?? undefined;

  const { data, isLoading } = useAttendanceList({
    month,
    year,
    profileId,
    page,
    limit: 50,
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Rekap Kehadiran</CardTitle>
            {data && (
              <span className="text-sm text-muted-foreground">{data.total} record</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && (!data || data.data.length === 0) && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Tidak ada data kehadiran untuk periode ini
            </p>
          )}

          {!isLoading && data && data.data.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead className="w-16">Foto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((record) => {
                      const badge = STATUS_BADGE[record.status] ?? STATUS_BADGE.absent;
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.profile.fullName ?? "-"}
                          </TableCell>
                          <TableCell>{formatDate(record.date)}</TableCell>
                          <TableCell>{formatTimeShort(record.clockInAt)}</TableCell>
                          <TableCell>{formatTimeShort(record.clockOutAt)}</TableCell>
                          <TableCell>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </TableCell>
                          <TableCell>{record.workLocation?.name ?? "-"}</TableCell>
                          <TableCell>{record.workShift?.name ?? "-"}</TableCell>
                          <TableCell>
                            {(record.clockInPhotoUrl || record.clockOutPhotoUrl) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => setSelectedRecord(record)}
                              >
                                <Gallery weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ArrowLeft weight="BoldDuotone" className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ArrowRight weight="BoldDuotone" className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PhotoPreviewModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </>
  );
}
