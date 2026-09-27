import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  valueClassName?: string;
}

export function SummaryCard({ label, value, sub, icon, valueClassName }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={cn("font-heading text-2xl font-bold text-foreground", valueClassName)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SummaryCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
