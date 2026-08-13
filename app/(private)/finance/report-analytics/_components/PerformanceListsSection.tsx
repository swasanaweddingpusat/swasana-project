"use client";

import type { ComponentType } from "react";
import { CupStar, Buildings2, ArrowRight } from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "./format";
import { TOP_SALES, TEAM_PERFORMANCE, TOP_VENUE } from "./report-analytics-mock-data";

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]",
    2: "bg-primary/10 text-primary",
    3: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        styles[rank] ?? "text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}

function CardHeader({
  icon: IconComponent,
  title,
}: {
  icon: ComponentType<IconProps>;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconComponent weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Lihat Semua
        <ArrowRight weight="BoldDuotone" className="h-3 w-3" />
      </button>
    </div>
  );
}

function TopSalesCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader icon={CupStar} title="Top Sales (Omset)" />
      <div className="flex flex-col gap-3">
        {TOP_SALES.map((item) => (
          <div key={item.rank} className="flex items-center gap-3">
            <RankBadge rank={item.rank} />
            <span className="flex-1 truncate text-sm text-foreground">{item.name}</span>
            <span className="text-sm font-semibold text-foreground">{formatRupiah(item.omset)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamPerformanceCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader icon={Buildings2} title="Team Performance (Omset)" />
      <div className="flex flex-col gap-4">
        {TEAM_PERFORMANCE.map((team) => (
          <div key={team.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="truncate text-sm text-foreground">{team.name}</span>
              <span className="text-sm font-semibold text-foreground">{formatRupiah(team.omset)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${team.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopVenueCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader icon={Buildings2} title="Top Venue (Omset)" />
      <div className="flex flex-col gap-3">
        {TOP_VENUE.map((venue) => (
          <div key={venue.name} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <Buildings2 weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="flex-1 truncate text-sm text-foreground">{venue.name}</span>
            <span className="text-sm font-semibold text-foreground">{formatRupiah(venue.omset)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PerformanceListsSection() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <TopSalesCard />
      <TeamPerformanceCard />
      <TopVenueCard />
    </div>
  );
}
