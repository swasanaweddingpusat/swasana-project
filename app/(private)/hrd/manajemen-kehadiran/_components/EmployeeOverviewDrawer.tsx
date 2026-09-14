"use client";

import { Drawer } from "@/components/shared/drawer";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeeAttendanceOverview } from "@/hooks/use-attendance";
import type { AttendanceOverviewQuery } from "@/lib/validations/attendance";

interface EmployeeOverviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profileName: string | null;
  query: AttendanceOverviewQuery | null;
}

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

function StatCard({ label, value, variant }: { label: string; value: number; variant: "default" | "secondary" | "destructive" | "outline" }) {
  return (
    <div className="rounded-lg border p-3 bg-secondary/30 text-center">
      <p className="text-2xl font-heading font-bold tabular-nums">{value}</p>
      <Badge variant={variant} className="mt-1">{label}</Badge>
    </div>
  );
}

export function EmployeeOverviewDrawer({ isOpen, onClose, profileName, query }: EmployeeOverviewDrawerProps) {
  const { data, isLoading } = useEmployeeAttendanceOverview(isOpen ? query : null);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={profileName ?? "Overview Kehadiran"} maxWidth="sm:max-w-2xl">
      <div className="flex flex-col gap-5 px-1 pb-6">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && data && (
          <>
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ringkasan Periode</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                <StatCard label="Hadir" value={data.summary.hadir} variant="default" />
                <StatCard label="Telat" value={data.summary.telat} variant="secondary" />
                <StatCard label="Absen" value={data.summary.absen} variant="destructive" />
                <StatCard label="Libur" value={data.summary.libur} variant="outline" />
                <StatCard label="Tgl Merah" value={data.summary.tanggalMerah} variant="destructive" />
              </div>
            </section>

            <Separator />

            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Riwayat Harian</p>
              {data.records.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Tidak ada data kehadiran pada periode ini</p>
              )}
              <div className="flex flex-col gap-3">
                {data.records.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.absent;
                  return (
                    <div key={r.id} className="rounded-lg border p-3 bg-secondary/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">{formatDate(r.date)}</span>
                        {r.attendantType === "DAY_OFF" ? (
                          <Badge variant="secondary">Libur</Badge>
                        ) : (
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        )}
                      </div>

                      {r.attendantType !== "DAY_OFF" && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Jam Masuk</span>
                            <span className="text-foreground">{formatTimeShort(r.clockInAt)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Jam Keluar</span>
                            <span className="text-foreground">{formatTimeShort(r.clockOutAt)}</span>
                          </div>
                          {r.workShift && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Shift</span>
                              <span className="text-foreground">{r.workShift.name}</span>
                            </div>
                          )}
                          {r.workLocation && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Lokasi</span>
                              <span className="text-foreground">{r.workLocation.name}</span>
                            </div>
                          )}
                        </>
                      )}

                      {r.isPublicHoliday && (
                        <div className="mt-1.5 pt-1.5 border-t border-border">
                          <Badge variant="destructive">Tanggal Merah</Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
