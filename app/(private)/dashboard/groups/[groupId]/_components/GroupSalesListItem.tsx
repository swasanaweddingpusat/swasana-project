"use client";

import { Crown, GraphUp, GraphDown, MenuDots, PenNewSquare, TrashBinTrash } from "@solar-icons/react";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SalesListMember {
  profileId: string;
  name: string;
  avatarUrl?: string;
  target: number;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
  actual: number;
  pendingApproval: number;
  rank: number;
}

interface Props {
  member: SalesListMember;
  isSelected: boolean;
  canManage: boolean;
  onSelect: (profileId: string) => void;
  onEditTarget: (member: SalesListMember) => void;
  onRemove: (member: SalesListMember) => void;
}

function achievementPct(actual: number, target: number) {
  if (target === 0) return 0;
  return Math.round((actual / target) * 100);
}

export function GroupSalesListItem({
  member,
  isSelected,
  canManage,
  onSelect,
  onEditTarget,
  onRemove,
}: Props) {
  const pct = achievementPct(member.actual, member.target);
  const isTop = member.rank === 1;
  const overTarget = member.actual >= member.target && member.target > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isSelected ? "true" : undefined}
      onClick={() => onSelect(member.profileId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(member.profileId);
        }
      }}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-md cursor-pointer transition-colors min-h-11",
        isSelected ? "bg-secondary" : "hover:bg-secondary/60",
      )}
    >
      {/* Rank badge */}
      <div className="shrink-0 flex items-center justify-center w-6">
        {isTop ? (
          <Crown weight="BoldDuotone" className="h-4 w-4 text-foreground" />
        ) : (
          <span
            className={cn(
              "text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center",
              member.rank <= 3
                ? "bg-secondary text-foreground border border-border"
                : "text-muted-foreground",
            )}
          >
            {member.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <ProfileAvatar name={member.name} src={member.avatarUrl} size="sm" />

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "text-sm truncate",
              isSelected ? "font-semibold text-foreground" : "font-medium text-foreground",
            )}
          >
            {member.name}
          </span>
          {isTop && (
            <span className="text-[9px] font-semibold bg-foreground text-background px-1.5 py-0.5 rounded-full shrink-0">
              Top
            </span>
          )}
          {member.pendingApproval > 0 && (
            <span className="text-[9px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">
              {member.pendingApproval} pending
            </span>
          )}
        </div>

        {/* Achievement % + trend */}
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className={cn(
              "text-[10px] font-semibold",
              pct >= 100
                ? "text-foreground"
                : pct >= 70
                  ? "text-muted-foreground"
                  : "text-destructive",
            )}
          >
            {pct}%
          </span>
          {overTarget ? (
            <GraphUp weight="BoldDuotone" className="h-3 w-3 text-foreground" />
          ) : (
            <GraphDown weight="BoldDuotone" className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Action kebab — only when canManage */}
      {canManage && (
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
          className="shrink-0"
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center justify-center h-9 w-9 rounded hover:bg-accent cursor-pointer outline-none"
              aria-label={`Aksi untuk ${member.name}`}
            >
              <MenuDots weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditTarget(member)}>
                <PenNewSquare weight="BoldDuotone" className="h-3.5 w-3.5 mr-2 text-primary" /> Edit Target
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onRemove(member)}
              >
                <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5 mr-2" /> Hapus dari Grup
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
