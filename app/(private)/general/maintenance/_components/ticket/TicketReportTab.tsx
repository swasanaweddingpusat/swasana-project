"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useMaintenanceReport } from "@/hooks/useMaintenance";

function MetricCard({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5 flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        {isLoading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <p className="text-3xl font-bold font-heading">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BarChart({
  data,
  isLoading,
}: {
  data: { name: string; count: number }[];
  isLoading: boolean;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-8 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">Belum ada data.</p>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = Math.round((item.count / max) * 100);
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground shrink-0 w-20 sm:w-32 truncate text-right">
              {item.name}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-medium shrink-0 w-8 text-right">
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TicketReportTab() {
  const { data, isLoading } = useMaintenanceReport({});

  const total: number = (data?.total as number | undefined) ?? 0;
  const byStatus: { name: string; count: number }[] = (data?.byStatus as { name: string; count: number }[] | undefined) ?? [];
  const byCategory: { name: string; count: number }[] = (data?.byCategory as { name: string; count: number }[] | undefined) ?? [];
  const byVenue: { name: string; count: number }[] = (data?.byVenue as { name: string; count: number }[] | undefined) ?? [];

  // Derive simple metrics from status names
  const completed = byStatus
    .filter((s) => {
      const lower = s.name.toLowerCase();
      return lower.includes("done") || lower.includes("selesai") || lower.includes("complete");
    })
    .reduce((acc, s) => acc + s.count, 0);

  const inProgress = byStatus
    .filter((s) => {
      const lower = s.name.toLowerCase();
      return (
        lower.includes("progress") ||
        lower.includes("proses") ||
        lower.includes("open") ||
        lower.includes("buka")
      );
    })
    .reduce((acc, s) => acc + s.count, 0);

  const overdue = total - completed - inProgress;

  return (
    <div className="flex flex-col gap-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Ticket" value={total} isLoading={isLoading} />
        <MetricCard label="Selesai" value={completed} isLoading={isLoading} />
        <MetricCard label="In Progress" value={inProgress} isLoading={isLoading} />
        <MetricCard
          label="Lainnya"
          value={Math.max(overdue, 0)}
          isLoading={isLoading}
        />
      </div>

      {/* Tickets per Status */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Ticket per Status</h3>
          <BarChart data={byStatus} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Tickets per Category */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Ticket per Kategori</h3>
          <BarChart data={byCategory} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Per Venue Table */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold">Ticket per Venue</h3>
          </div>
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6">Venue</TableHead>
                    <TableHead className="w-24 text-right pr-6">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byVenue.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center py-6 text-muted-foreground text-sm"
                      >
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    byVenue
                      .sort((a, b) => b.count - a.count)
                      .map((v) => (
                        <TableRow key={v.name}>
                          <TableCell className="px-6 text-sm">{v.name}</TableCell>
                          <TableCell className="text-right pr-6 text-sm font-medium">
                            {v.count}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
