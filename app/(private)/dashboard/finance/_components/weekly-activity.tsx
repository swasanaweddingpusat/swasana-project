"use client";

import { MessageSquare, CalendarCheck, CheckCircle, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityItem } from "@/types/finance";
import { cn } from "../../../../../lib/utils";

interface WeeklyActivityProps {
  activities: ActivityItem[];
  loading: boolean;
}

const iconMap: Record<ActivityItem["icon"], LucideIcon> = {
  inquiry: MessageSquare,
  meeting: CalendarCheck,
  confirmation: CheckCircle,
};

export function WeeklyActivity({ activities, loading }: WeeklyActivityProps) {
  return (
    <div className={cn('bg-card', 'border', 'border-border', 'rounded-xl', 'px-4', 'py-6')}>
      <div className={cn('flex', 'items-center', 'justify-between', 'mb-4')}>
        <h3 className={cn('text-base', 'font-bold', 'text-[#1D1D1D]')}>Weekly Activity</h3>
        <span className={cn('text-sm', 'font-medium', 'text-muted-foreground', 'cursor-pointer', 'hover:text-foreground')}>
          See all activity
        </span>
      </div>
      {loading ? (
        <div className={cn('flex', 'flex-col', 'gap-4')}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className={cn('flex', 'items-center', 'gap-3')}>
              <Skeleton className={cn('h-6', 'w-6', 'rounded-full')} />
              <div className={cn('flex', 'flex-col', 'gap-1', 'flex-1')}>
                <Skeleton className={cn('h-4', 'w-32')} />
                <Skeleton className={cn('h-4', 'w-48')} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('flex', 'flex-col', 'gap-4')}>
          {activities.map((activity) => {
            const Icon = iconMap[activity.icon];
            return (
              <div key={activity.id} className={cn('flex', 'items-start', 'gap-3')}>
                <Icon className={cn('h-5', 'w-5', 'shrink-0', 'text-muted-foreground', 'mt-0.5')} />
                <div className={cn('flex', 'flex-col')}>
                  <span className={cn('text-sm', 'font-medium', 'text-foreground')}>{activity.title}</span>
                  <span className={cn('text-sm', 'text-muted-foreground')}>{activity.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
