"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Wallet2,
  TagPrice,
  GraphUp,
  CardReceive,
  TicketSale,
  UsersGroupRounded,
  type IconProps,
} from "@solar-icons/react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatRupiah } from "@/lib/utils";
import type { GroupWithPerformance } from "@/lib/queries/groups";

type SolarIcon = ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>>;

export interface PerformanceSummary {
  totalGroups: number;
  totalSales: number;
  totalTarget: number;
  avgAchievement: number;
  totalConfirmed: number;
  totalPiutang: number;
  totalRevenue: number;
}

interface Props {
  groups: GroupWithPerformance[];
  summary: PerformanceSummary;
  year: number;
}

interface Kpi {
  label: string;
  value: string;
  icon: SolarIcon;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function YearFilter({ year }: { year: number }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {years.map((y) => (
        <button
          key={y}
          type="button"
          onClick={() => router.push(`${pathname}?year=${y}`)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
            y === year
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent",
          )}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

export function PerformanceSalesClient({ groups, summary, year }: Props): React.JSX.Element {
  const ranked = [...groups].sort((a, b) => b.avgAchievement - a.avgAchievement);

  const kpis: Kpi[] = [
    { label: "Revenue (Confirmed)", value: formatRupiah(summary.totalSales), icon: Wallet2 },
    { label: "Total Target", value: formatRupiah(summary.totalTarget), icon: TagPrice },
    { label: "Avg Achievement", value: `${summary.avgAchievement}%`, icon: GraphUp },
    { label: "Total Piutang", value: formatRupiah(summary.totalPiutang), icon: CardReceive },
    { label: "Confirmed", value: `${summary.totalConfirmed}`, icon: TicketSale },
    { label: "Total Grup", value: `${summary.totalGroups}`, icon: UsersGroupRounded },
  ];

  return (
    <div className="space-y-6">
      {/* Header + year filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Performance Sales</h1>
          <p className="text-sm text-muted-foreground">
            Monitoring performa penjualan lintas tim — tahun {year}
          </p>
        </div>
        <YearFilter year={year} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <k.icon weight="BoldDuotone" className="h-4 w-4" />
                <span className="text-xs font-medium">{k.label}</span>
              </div>
              <p className="mt-2 font-heading text-xl font-semibold tracking-tight">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ranking per grup */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Ranking Tim — Target vs Achievement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <UsersGroupRounded weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Belum ada data grup untuk tahun {year}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Grup</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="min-w-40">Achievement</TableHead>
                    <TableHead className="text-right">Piutang</TableHead>
                    <TableHead className="text-right">Confirmed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((g, i) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full">
                          {i + 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={g.leader?.avatarUrl ?? undefined} alt={g.leader?.fullName ?? g.name} />
                            <AvatarFallback className="text-xs">
                              {initials(g.leader?.fullName ?? g.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{g.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {g.leader?.fullName ?? "Tanpa leader"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatRupiah(g.target)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatRupiah(g.revenue)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(g.avgAchievement, 100)} className="h-2 flex-1" />
                          <span className="w-11 shrink-0 text-right text-xs font-medium tabular-nums">
                            {g.avgAchievement}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatRupiah(g.piutang)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {g.confirmedCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
