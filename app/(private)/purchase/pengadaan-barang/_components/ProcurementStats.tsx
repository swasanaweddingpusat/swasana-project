"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClockCircle, CheckCircle, CloseCircle, CheckSquare } from "@solar-icons/react";

interface ProcurementStatsProps {
  summary?: {
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    total: number;
  };
  isLoading: boolean;
}

const stats = [
  {
    key: "pending" as const,
    label: "Menunggu",
    icon: ClockCircle,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    key: "approved" as const,
    label: "Disetujui",
    icon: CheckCircle,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    key: "rejected" as const,
    label: "Ditolak",
    icon: CloseCircle,
    colorClass: "text-destructive",
    bgClass: "bg-red-50 dark:bg-red-950/30",
  },
  {
    key: "completed" as const,
    label: "Selesai",
    icon: CheckSquare,
    colorClass: "text-green-500",
    bgClass: "bg-green-50 dark:bg-green-950/30",
  },
];

export function ProcurementStats({ summary, isLoading }: ProcurementStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.key} className="rounded-2xl">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ key, label, icon: Icon, colorClass, bgClass }) => (
        <Card key={key} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${bgClass}`}>
              <Icon weight="BoldDuotone" className={`h-6 w-6 ${colorClass}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-heading font-bold text-foreground">
                {summary?.[key] ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
