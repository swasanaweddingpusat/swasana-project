"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UsersGroupRounded,
  ChartSquare,
  Buildings2,
  VolumeLoud,
  Leaf,
  Videocamera,
  CheckCircle,
  Link as LinkIcon,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type {
  GuestbookOverview as GuestbookOverviewData,
  GuestbookOverviewBucket,
} from "@/lib/queries/guestbookEntries";

// Shorten an ad URL for display (drop protocol + trailing slash).
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// Progress-bar row used by the "Sumber Iklan" card — label + count + percentage.
function AdsSourceBarRow({
  label,
  count,
  total,
}: {
  label: React.ReactNode;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">
          {count.toLocaleString("id-ID")}
          <span className="ml-1 text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Dedicated card for the ad-source breakdown — needs clickable URLs + an
// "Organik" fallback row, which the generic `lists` item renderer below
// doesn't support.
function GuestbookAdsSourceCard({
  buckets,
  organik,
  total,
}: {
  buckets: GuestbookOverviewBucket[];
  organik: number;
  total: number;
}) {
  const isEmpty = buckets.length === 0 && organik === 0;
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <VolumeLoud weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Sumber Iklan</p>
        </div>
        {isEmpty ? (
          <p className="text-xs text-muted-foreground">Tidak ada data.</p>
        ) : (
          <div className="space-y-3">
            {buckets.map((b) => (
              <AdsSourceBarRow
                key={b.key}
                total={total}
                count={b.count}
                label={
                  <a
                    href={b.label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <LinkIcon weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{shortUrl(b.label)}</span>
                  </a>
                }
              />
            ))}
            {organik > 0 && (
              <AdsSourceBarRow
                key="__organik__"
                total={total}
                count={organik}
                label={
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Leaf weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                    Organik (tanpa iklan)
                  </span>
                }
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GuestbookOverviewCards({
  overview,
  activeStatuses,
  onStatusClick,
  activeCategories,
  onCategoryClick,
  activeSourceIds,
  onSourceClick,
  activeVenueIds,
  onVenueClick,
  activeHostId,
  onHostClick,
}: {
  overview: GuestbookOverviewData;
  activeStatuses: string[];
  onStatusClick: (key: string) => void;
  activeCategories: string[];
  onCategoryClick: (key: string) => void;
  activeSourceIds: string[];
  onSourceClick: (key: string) => void;
  activeVenueIds: string[];
  onVenueClick: (key: string) => void;
  activeHostId: string | undefined;
  onHostClick: (key: string) => void;
}) {
  const metrics = [
    // Total database guestbook, kunjungan tuntas, kunjungan batal, dan Online
    // Meeting yang berdiri sendiri karena bukan kunjungan ke venue.
    { label: "Database", value: overview.total, icon: UsersGroupRounded },
    { label: "Sudah Visit", value: overview.doneVisit, icon: Buildings2 },
    { label: "Tidak Jadi Visit (Lost)", value: overview.lost, icon: ChartSquare },
    { label: "Online Meeting", value: overview.onlineMeetings, icon: Videocamera },
    // Hanya status "Deal" — "No Deal (Lost)" tidak ikut terhitung di sini.
    { label: "Deal", value: overview.deal, icon: CheckCircle },
  ];

  const lists: {
    title: string;
    items: GuestbookOverviewBucket[];
    activeKeys: string[];
    onItemClick: (key: string) => void;
    /** Semua status ditampilkan (termasuk yang count-nya 0), jadi tidak dipotong
     *  seperti list Top 5 lainnya. */
    maxItems?: number;
  }[] = [
    { title: "Status", items: overview.byStatus, activeKeys: activeStatuses, onItemClick: onStatusClick, maxItems: overview.byStatus.length },
    { title: "Kategori Event", items: overview.byCategory, activeKeys: activeCategories, onItemClick: onCategoryClick },
    { title: "Sumber Data", items: overview.bySource, activeKeys: activeSourceIds, onItemClick: onSourceClick },
    { title: "Venue Teratas", items: overview.byVenue, activeKeys: activeVenueIds, onItemClick: onVenueClick },
    { title: "PIC Teratas", items: overview.byHost, activeKeys: activeHostId ? [activeHostId] : [], onItemClick: onHostClick },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {metrics.map(({ label, value, icon: Icon }) => (
        <Card key={label} className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lists.map(({ title, items, activeKeys, onItemClick, maxItems = 5 }) => (
          <Card key={title} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada data</p>
              ) : (
                <div className="space-y-1">
                  {items.slice(0, maxItems).map((item) => {
                    const isActive = activeKeys.includes(item.key);
                    return (
                      <div
                        key={item.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => onItemClick(item.key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onItemClick(item.key);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 text-xs transition-colors hover:bg-accent",
                          isActive && "bg-accent ring-1 ring-ring"
                        )}
                      >
                        <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {/* Bitrix bisa datang organik atau lewat iklan; pecah
                              jumlahnya biar ketahuan tanpa membuka detail. */}
                          {item.adsCount ? (
                            <Badge variant="outline" className="rounded-full font-normal">
                              Iklan ({item.adsCount})
                            </Badge>
                          ) : null}
                          <Badge variant="secondary" className="rounded-full">{item.count}</Badge>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <GuestbookAdsSourceCard
        buckets={overview.adsUrlBuckets}
        organik={overview.adsUrlOrganik}
        total={overview.total}
      />
    </div>
  );
}
