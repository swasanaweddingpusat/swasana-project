"use client";

import { MessageSquare, CalendarCheck, CheckCircle, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityItem } from "@/types/finance";

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
    <div className="border border-border rounded-xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[#1D1D1D]">Weekly Activity</h3>
        <span className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
          See all activity
        </span>
      </div>
      {loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex flex-col gap-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {activities.map((activity) => {
            const Icon = iconMap[activity.icon];
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{activity.title}</span>
                  <span className="text-sm text-muted-foreground">{activity.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
