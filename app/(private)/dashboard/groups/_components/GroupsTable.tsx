"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Crown,
  Pen,
  TrashBinTrash,
  MedalStar,
  GraphDown,
  GraphUp,
  UsersGroupRounded,
} from "@solar-icons/react";
import type { GroupWithPerformance } from "@/lib/queries/groups";

interface Props {
  groups: GroupWithPerformance[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (group: GroupWithPerformance) => void;
  onDelete: (group: GroupWithPerformance) => void;
}

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function sortGroups(groups: GroupWithPerformance[]): GroupWithPerformance[] {
  return [...groups].sort((a, b) => {
    if (b.avgAchievement !== a.avgAchievement) {
      return b.avgAchievement - a.avgAchievement;
    }
    if (b.revenue !== a.revenue) {
      return b.revenue - a.revenue;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Returns gradient + ring + shadow classes per rank tier */
function getCardTier(rank: number): {
  container: string;
  divider: string;
  barFill: string;
} {
  if (rank <= 3) {
    return {
      container:
        "bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 ring-1 ring-amber-200/40 shadow-md shadow-amber-100/20",
      divider: "divide-amber-200/40",
      barFill: "bg-gradient-to-r from-amber-400 to-amber-500",
    };
  }
  return {
    container:
      "bg-gradient-to-br from-white to-stone-50 ring-1 ring-stone-200/60 shadow-sm",
    divider: "divide-stone-200/60",
    barFill: "",
  };
}

function getBarFill(rank: number, pct: number): string {
  // rank 1-3 always gold if >= 70%
  if (rank <= 3 && pct >= 70) {
    return "bg-gradient-to-r from-amber-400 to-amber-500";
  }
  if (pct >= 100) return "bg-foreground";
  if (pct >= 70) return "bg-muted-foreground";
  return "bg-destructive";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white text-xs font-bold leading-none shadow-sm shadow-amber-300/40"
        aria-label="Peringkat ke-1 (top performer)"
      >
        <Crown weight="BoldDuotone" className="h-3 w-3" />
        #1
      </span>
    );
  }
  if (rank === 2 || rank === 3) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold leading-none"
        aria-label={`Peringkat ke-${rank}`}
      >
        <MedalStar weight="BoldDuotone" className="h-3 w-3" />
        #{rank}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold leading-none"
      aria-label={`Peringkat ke-${rank}`}
    >
      #{rank}
    </span>
  );
}

function GroupCard({
  group,
  rank,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  group: GroupWithPerformance;
  rank: number;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (group: GroupWithPerformance) => void;
  onDelete: (group: GroupWithPerformance) => void;
}) {
  const pct = Math.min(group.avgAchievement, 100);
  const tier = getCardTier(rank);
  const barFill = getBarFill(rank, group.avgAchievement);

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200",
        "focus-within:ring-2 focus-within:ring-amber-400/60",
        tier.container,
        "hover:shadow-md",
      )}
      aria-label={`Group ${group.name}, peringkat ${rank}`}
    >
      {/* Clickable overlay */}
      <Link
        href={`/dashboard/groups/${group.id}`}
        className="absolute inset-0 rounded-2xl focus:outline-none"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-3 p-5 sm:p-6">
        {/* ── Row 1: rank badge + name + actions ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <RankBadge rank={rank} />
            <Link
              href={`/dashboard/groups/${group.id}`}
              className="text-base font-semibold text-foreground hover:underline focus:outline-none focus-visible:underline truncate"
            >
              {group.name}
            </Link>
            {group.description && (
              <p className="text-xs text-muted-foreground truncate leading-snug">
                {group.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 sm:h-8 sm:w-8 relative z-10",
                  "hover:bg-black/5",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(group);
                }}
                aria-label={`Edit group ${group.name}`}
              >
                <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 sm:h-8 sm:w-8 relative z-10",
                  "hover:bg-black/5 text-destructive hover:text-destructive",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(group);
                }}
                aria-label={`Hapus group ${group.name}`}
              >
                <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
              </Button>
            )}
            <Link
              href={`/dashboard/groups/${group.id}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-9 w-9 sm:h-8 sm:w-8 relative z-10",
                "hover:bg-black/5",
              )}
              aria-label={`Lihat detail group ${group.name}`}
            >
              <ArrowRight weight="BoldDuotone" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* ── Row 2: leader ── */}
        {group.leader ? (
          <div className="flex items-center gap-2">
            <ProfileAvatar
              name={group.leader.fullName ?? ""}
              src={group.leader.avatarUrl ?? undefined}
              size="sm"
            />
            <span className="text-xs text-muted-foreground truncate">
              {group.leader.fullName}
              <span className="text-muted-foreground/60"> · {group._count.members} anggota</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              Belum ada leader · {group._count.members} anggota
            </span>
          </div>
        )}

        {/* ── Divider ── */}
        <div
          className={cn(
            "border-t",
            rank <= 3 ? "border-amber-200/50" : "border-stone-200/60",
          )}
        />

        {/* ── Achievement section ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Achievement
            </span>
            <div className="flex items-center gap-1">
              {group.avgAchievement >= 100 ? (
                <GraphUp
                  weight="BoldDuotone"
                  className={cn(
                    "h-3 w-3",
                    rank <= 3 ? "text-amber-600" : "text-foreground",
                  )}
                />
              ) : (
                <GraphDown weight="BoldDuotone" className="h-3 w-3 text-destructive" />
              )}
              <span className="text-xs font-semibold">
                {group.avgAchievement >= 100 ? "above target" : "below target"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Big percentage */}
            <span
              className={cn(
                "text-xl sm:text-2xl font-bold tabular-nums leading-none shrink-0",
                rank <= 3 && group.avgAchievement >= 70
                  ? "text-amber-700"
                  : group.avgAchievement < 70
                    ? "text-destructive"
                    : "text-foreground",
              )}
            >
              {group.avgAchievement}%
            </span>

            {/* Progress bar */}
            <div className="flex-1">
              <div
                className="w-full bg-black/5 rounded-full h-2 sm:h-2.5 overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Achievement ${group.avgAchievement}%`}
              >
                <div
                  className={cn("h-full rounded-full transition-all", barFill)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stat strip ── */}
        <div
          className={cn(
            "grid grid-cols-3 divide-x border-t pt-3 -mx-5 px-5 sm:-mx-6 sm:px-6",
            rank <= 3 ? "border-amber-200/50 divide-amber-200/50" : "border-stone-200/60 divide-stone-200/60",
          )}
        >
          <div className="flex flex-col items-center gap-0.5 px-2 first:pl-0 last:pr-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Piutang
            </span>
            <span className="text-sm font-semibold tabular-nums text-destructive/80">{formatRp(group.piutang ?? 0)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Revenue
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatRp(group.totalRevenue ?? 0)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-2 last:pr-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Anggota
            </span>
            <span className="text-sm font-semibold tabular-nums">{group._count.members}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function GroupsLeaderboard({ groups, canEdit, canDelete, onEdit, onDelete }: Props) {
  if (groups.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-card p-10 text-center"
        role="status"
      >
        <p className="text-sm text-muted-foreground">Belum ada group</p>
      </div>
    );
  }

  const sorted = sortGroups(groups);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map((group, idx) => (
        <GroupCard
          key={group.id}
          group={group}
          rank={idx + 1}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export { GroupsLeaderboard as GroupsTable };
