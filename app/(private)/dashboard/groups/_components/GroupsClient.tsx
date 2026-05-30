"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddCircle } from "@solar-icons/react";
import { GroupsStatsCards } from "./GroupsStatsCards";
import { GroupsTable } from "./GroupsTable";
import { GroupFormDialog } from "./GroupFormDialog";
import { useGroupsPerformance } from "@/hooks/use-groups-performance";
import type { GroupWithPerformance, EligibleLeader } from "@/lib/queries/groups";

interface Props {
  initialGroups: GroupWithPerformance[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  eligibleLeaders?: EligibleLeader[];
}

export function GroupsClient({ initialGroups, canCreate, canEdit, canDelete: _canDelete, eligibleLeaders = [] }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupWithPerformance | null>(null);

  const { data } = useGroupsPerformance();
  const groups = data?.groups ?? initialGroups;
  const summary = data?.summary ?? {
    totalGroups: initialGroups.length,
    totalSales: initialGroups.reduce((s, g) => s + g.revenue, 0),
    totalTarget: initialGroups.reduce((s, g) => s + g.target, 0),
    avgAchievement: initialGroups.length > 0
      ? Math.round(initialGroups.reduce((s, g) => s + g.avgAchievement, 0) / initialGroups.length)
      : 0,
    totalConfirmed: initialGroups.reduce((s, g) => s + g.confirmedCount, 0),
  };

  return (
    <div className="space-y-6">
      <GroupsStatsCards {...summary} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Daftar Groups</h2>
          {canCreate && (
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreateOpen(true)}>
              <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" /> New Group
            </Button>
          )}
        </div>
        <GroupsTable groups={groups} canEdit={canEdit} onEdit={setEditGroup} />
      </div>

      <GroupFormDialog
        key="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        eligibleLeaders={eligibleLeaders}
      />
      <GroupFormDialog
        key={editGroup?.id ?? "edit-empty"}
        open={!!editGroup}
        onOpenChange={(o) => { if (!o) setEditGroup(null); }}
        group={editGroup}
        eligibleLeaders={eligibleLeaders}
      />
    </div>
  );
}
