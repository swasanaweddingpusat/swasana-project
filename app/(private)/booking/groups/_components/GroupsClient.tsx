"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddCircle } from "@solar-icons/react";
import { toast } from "sonner";
import { GroupsTable } from "./GroupsTable";
import { GroupFormDialog } from "./GroupFormDialog";
import { GroupYearSelector } from "./GroupYearSelector";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useGroupsPerformance } from "@/hooks/use-groups-performance";
import { useDeleteGroup } from "@/hooks/use-groups";
import type { GroupWithPerformance, EligibleLeader } from "@/lib/queries/groups";

interface Props {
  initialGroups: GroupWithPerformance[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  eligibleLeaders?: EligibleLeader[];
}

export function GroupsClient({ initialGroups, canCreate, canEdit, canDelete, eligibleLeaders = [] }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupWithPerformance | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<GroupWithPerformance | null>(null);

  // Year selector — drives performance data fetch year
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const deleteMutation = useDeleteGroup();

  const { data } = useGroupsPerformance(selectedYear);
  const groups = data?.groups ?? initialGroups;

  function handleConfirmDelete() {
    if (!deleteGroup) return;
    deleteMutation.mutate(deleteGroup.id, {
      onSuccess: (res) => {
        if (res.success) {
          toast.success(`Grup "${deleteGroup.name}" berhasil dihapus`);
          setDeleteGroup(null);
        } else {
          toast.error(res.error ?? "Terjadi kesalahan");
        }
      },
      onError: () => toast.error("Terjadi kesalahan"),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold shrink-0">Daftar Groups</h2>
          <div className="flex items-center gap-2">
            {/* Year selector — filters performance data by year (wired to API). */}
            <GroupYearSelector value={selectedYear} onChange={setSelectedYear} />
            {canCreate && (
              <Button size="sm" className="h-9 gap-1.5 rounded-full" onClick={() => setCreateOpen(true)}>
                <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" /> New Group
              </Button>
            )}
          </div>
        </div>
        <GroupsTable
          groups={groups}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={setEditGroup}
          onDelete={setDeleteGroup}
        />
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
      <ConfirmDialog
        open={!!deleteGroup}
        onOpenChange={(o) => { if (!o) setDeleteGroup(null); }}
        title="Hapus Group"
        description={`Yakin ingin menghapus grup "${deleteGroup?.name ?? ""}"? Semua data anggota dalam grup ini akan ikut terhapus.`}
        confirmLabel={deleteMutation.isPending ? "Menghapus..." : "Hapus"}
        onConfirm={handleConfirmDelete}
        destructive
      />
    </div>
  );
}
