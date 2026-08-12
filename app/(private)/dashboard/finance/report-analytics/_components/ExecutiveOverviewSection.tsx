"use client";

import type { ComponentType } from "react";
import {
  Wallet2,
  HandShake,
  UsersGroupRounded,
  UserCross,
  GraphDown,
  Banknote2,
  Target,
  GraphNewUp,
  SaleSquare,
  Gift,
  ChatRoundDots,
} from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { OVERVIEW_STATS, OVERVIEW_INSIGHT, type OverviewStat } from "./report-analytics-mock-data";

const ICONS: Record<string, ComponentType<IconProps>> = {
  omset: Wallet2,
  dealing: HandShake,
  activeClient: UsersGroupRounded,
  cancelClient: UserCross,
  cancelRate: GraphDown,
  lostRevenue: Banknote2,
  avgPackage: Target,
  conversionRate: GraphNewUp,
  discount: SaleSquare,
  bonus: Gift,
};

function StatCard({ stat }: { stat: OverviewStat }) {
  const Icon = ICONS[stat.key] ?? Wallet2;
  const isUp = stat.trend.direction === "up";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <Icon weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{stat.label}</p>
        <p className="mt-1 font-heading text-2xl font-bold text-foreground">{stat.value}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {isUp ? (
          <GraphNewUp weight="BoldDuotone" className="h-3.5 w-3.5 text-primary" />
        ) : (
          <GraphDown weight="BoldDuotone" className="h-3.5 w-3.5 text-destructive" />
        )}
        <span className={cn("text-xs font-medium", isUp ? "text-primary" : "text-destructive")}>
          {stat.trend.value}
        </span>
        <span className="text-xs text-muted-foreground">vs minggu lalu</span>
      </div>
    </div>
  );
}

function InsightCallout() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-sm">
      <ChatRoundDots weight="BoldDuotone" className="h-5 w-5 text-primary" />
      <div>
        <p className="text-xs font-medium text-primary">Insight</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{OVERVIEW_INSIGHT}</p>
      </div>
    </div>
  );
}

export function ExecutiveOverviewSection() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">Executive Overview</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {OVERVIEW_STATS.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
        <InsightCallout />
      </div>
    </div>
  );
}
