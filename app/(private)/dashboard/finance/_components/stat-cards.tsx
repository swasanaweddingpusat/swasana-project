"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { FinanceStats } from "@/types/finance";
import { cn } from "../../../../../lib/utils";

interface StatCardsProps {
  stats: FinanceStats | null;
  loading: boolean;
}

const statConfig: { key: keyof FinanceStats; label: string }[] = [
  { key: "pendingBookingProcess", label: "Pending Booking Process" },
  { key: "pendingPOApproval", label: "Pending PO Waiting Approval" },
  { key: "lateInvoiceOverdue", label: "Late Invoice Overdue" },
  { key: "bookingsNeedSignature", label: "Bookings Need Client Signature" },
];

export function StatCards({ stats, loading }: StatCardsProps) {
  if (loading || !stats) {
    return (
      <div className={cn('flex', 'flex-wrap', 'gap-4')}>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className={cn('min-w-40', 'flex-1', 'h-32', 'rounded-xl')} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex', 'flex-wrap', 'gap-4')}>
      {statConfig.map((item) => (
        <div
          key={item.key}
          className={cn('min-w-40', 'flex-1', 'bg-card', 'rounded-xl', 'p-6', 'flex', 'flex-col', 'gap-4', 'border')}
        >
          <span className={cn('text-5xl', 'font-semibold', 'leading-none', 'text-foreground', 'pt-4')}>
            {stats[item.key]}
          </span>
          <span className={cn('text-base', 'font-medium', 'text-foreground')}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
