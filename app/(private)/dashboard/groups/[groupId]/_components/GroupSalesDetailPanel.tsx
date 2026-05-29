"use client";

import { Crown, DangerTriangle, Target as TargetIcon } from "@solar-icons/react";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { cn } from "@/lib/utils";
import { SalesRecentBookings } from "./SalesRecentBookings";

interface SelectedMember {
  profileId: string;
  name: string;
  avatarUrl?: string;
  target: number;
  actual: number;
  pendingApproval: number;
  rank: number;
}

interface Props {
  member: SelectedMember | null;
  hasMembers: boolean;
  onViewAllBookings: (member: SelectedMember) => void;
}

function formatFull(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function achievementPct(actual: number, target: number) {
  if (target === 0) return 0;
  return Math.round((actual / target) * 100);
}

export function GroupSalesDetailPanel({ member, hasMembers, onViewAllBookings }: Props) {
  if (!hasMembers) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full py-20 text-center gap-2"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-medium text-muted-foreground">Belum ada anggota</p>
        <p className="text-xs text-muted-foreground">Tambahkan anggota dari panel kiri.</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div
        className="flex items-center justify-center h-full py-20"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-muted-foreground">Pilih anggota untuk melihat detail.</p>
      </div>
    );
  }

  const pct = achievementPct(member.actual, member.target);
  const isTop = member.rank === 1;

  return (
    <div className="space-y-5 p-5 md:p-6">
      {/* Member header */}
      <div className="flex items-center gap-3">
        <ProfileAvatar name={member.name} src={member.avatarUrl} size="lg" />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">{member.name}</h2>
            {isTop && (
              <Crown weight="BoldDuotone" className="h-4 w-4 text-foreground shrink-0" />
            )}
          </div>
          {isTop && (
            <span className="text-[10px] font-semibold bg-foreground text-background px-2 py-0.5 rounded-full">
              Top Performer
            </span>
          )}
        </div>
      </div>

      {/* Pending approval warning */}
      {member.pendingApproval > 0 && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <DangerTriangle weight="BoldDuotone" className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">
            {member.pendingApproval} booking menunggu approval
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Target card */}
        <div
          className={cn(
            "relative rounded-2xl p-4 overflow-hidden",
            "bg-gradient-to-br from-white via-amber-50/30 to-amber-100/20",
            "ring-1 ring-amber-200/40 shadow-sm shadow-amber-100/40",
          )}
        >
          {/* Corner decoration */}
          <TargetIcon
            weight="BoldDuotone"
            className="absolute top-3 right-3 h-8 w-8 text-amber-200/60 pointer-events-none"
            aria-hidden="true"
          />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Target
          </p>
          <p className="text-base sm:text-lg font-semibold text-foreground leading-tight truncate">
            {member.target > 0 ? formatFull(member.target) : "—"}
          </p>
        </div>

        {/* Penjualan card — elevate when >= target */}
        <div
          className={cn(
            "relative rounded-2xl p-4 overflow-hidden",
            member.actual >= member.target && member.target > 0
              ? "bg-gradient-to-br from-amber-50 via-amber-100/40 to-amber-200/30 ring-1 ring-amber-300/40 shadow-md shadow-amber-100/30"
              : "bg-gradient-to-br from-white via-amber-50/30 to-amber-100/20 ring-1 ring-amber-200/40 shadow-sm shadow-amber-100/40",
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Penjualan
          </p>
          <p
            className={cn(
              "text-base sm:text-lg font-semibold leading-tight truncate",
              member.actual >= member.target && member.target > 0
                ? "text-amber-700"
                : "text-foreground",
            )}
          >
            {formatFull(member.actual)}
          </p>
        </div>

        {/* Achievement card */}
        <div
          className={cn(
            "relative rounded-2xl p-4 overflow-hidden",
            "bg-gradient-to-br from-white via-amber-50/30 to-amber-100/20",
            "ring-1 ring-amber-200/40 shadow-sm shadow-amber-100/40",
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Achievement
          </p>
          <p
            className={cn(
              "text-xl sm:text-2xl font-bold leading-tight tabular-nums",
              pct >= 100
                ? "text-amber-700"
                : pct >= 70
                  ? "text-foreground"
                  : "text-destructive",
            )}
          >
            {pct}%
          </p>
          <div
            className="w-full h-2 bg-black/5 rounded-full overflow-hidden mt-3"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Achievement ${pct}%`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct >= 100
                  ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : pct >= 70
                    ? "bg-foreground"
                    : "bg-destructive",
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      <SalesRecentBookings
        salesId={member.profileId}
        onViewAll={() => onViewAllBookings(member)}
      />
    </div>
  );
}
