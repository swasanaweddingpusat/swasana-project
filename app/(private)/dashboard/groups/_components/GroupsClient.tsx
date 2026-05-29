"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { GroupsStatsCards } from "./GroupsStatsCards";
import { GroupsRevenueChart } from "./GroupsRevenueChart";
import { GroupsTable } from "./GroupsTable";
import { GroupFormDialog } from "./GroupFormDialog";
import { useGroupsPerformance } from "@/hooks/use-groups-performance";
import type { GroupWithPerformance } from "@/lib/queries/groups";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

interface Props {
  initialGroups: GroupWithPerformance[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function GroupsClient({ initialGroups, canCreate, canEdit, canDelete: _canDelete }: Props) {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupWithPerformance | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const s = new Date(filterYear, filterMonth, 1);
    const e = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59);
    return { startDate: s.toISOString(), endDate: e.toISOString() };
  }, [filterMonth, filterYear]);

  const { data } = useGroupsPerformance(startDate, endDate);
  const groups = data?.groups ?? initialGroups;
  const summary = data?.summary ?? {
    totalGroups: initialGroups.length,
    totalSales: initialGroups.reduce((s, g) => s + g.revenue, 0),
    avgAchievement: initialGroups.length > 0
      ? Math.round(initialGroups.reduce((s, g) => s + g.avgAchievement, 0) / initialGroups.length)
      : 0,
    totalConfirmed: initialGroups.reduce((s, g) => s + g.confirmedCount, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">Groups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola tim dan pantau kinerja penjualan</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(Number(v))}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Group
            </Button>
          )}
        </div>
      </div>

      <GroupsStatsCards {...summary} />
      <GroupsRevenueChart groups={groups} />

      <div>
        <h2 className="text-sm font-semibold mb-3">Daftar Groups</h2>
        <GroupsTable groups={groups} canEdit={canEdit} onEdit={setEditGroup} />
      </div>

      <GroupFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <GroupFormDialog
        open={!!editGroup}
        onOpenChange={(o) => { if (!o) setEditGroup(null); }}
        group={editGroup}
      />
    </div>
  );
}
