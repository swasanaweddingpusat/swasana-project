"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { ArrowRight, Edit } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GroupWithPerformance } from "@/lib/queries/groups";

interface Props {
  groups: GroupWithPerformance[];
  canEdit: boolean;
  onEdit: (group: GroupWithPerformance) => void;
}

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function GroupsTable({ groups, canEdit, onEdit }: Props) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">Belum ada group</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-white">
      <div className="grid grid-cols-[2fr_1.5fr_0.7fr_1.2fr_1.2fr_0.9fr_auto] px-4 py-2.5 bg-white text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
        <span>Nama Group</span>
        <span>Leader</span>
        <span className="text-center">Anggota</span>
        <span>Total Sales</span>
        <span>Achievement</span>
        <span className="text-center">Confirmed</span>
        <span className="w-20" />
      </div>

      {groups.map((group) => (
        <div
          key={group.id}
          className="grid grid-cols-[2fr_1.5fr_0.7fr_1.2fr_1.2fr_0.9fr_auto] px-4 py-3 border-b border-border last:border-b-0 items-center bg-white hover:bg-secondary/30 transition-colors"
        >
          <div>
            <Link href={`/dashboard/groups/${group.id}`} className="text-sm font-semibold hover:underline">
              {group.name}
            </Link>
            {group.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{group.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {group.leader ? (
              <>
                <ProfileAvatar name={group.leader.fullName ?? ""} src={group.leader.avatarUrl ?? undefined} size="sm" />
                <span className="text-sm truncate">{group.leader.fullName}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          <div className="text-center text-sm">{group._count.members}</div>
          <div className="text-sm font-semibold">{formatRp(group.revenue)}</div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all"
                style={{ width: `${Math.min(group.avgAchievement, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold w-9 text-right">{group.avgAchievement}%</span>
          </div>

          <div className="text-center text-sm">{group.confirmedCount}</div>

          <div className="flex items-center gap-1 w-20 justify-end">
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(group)}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            <Link
              href={`/dashboard/groups/${group.id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7")}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
