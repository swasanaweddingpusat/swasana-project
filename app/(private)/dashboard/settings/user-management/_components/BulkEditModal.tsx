"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Earth, User, UsersGroupRounded, CloseCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { bulkUpdateUsers } from "@/actions/user";
import { useGroups } from "@/hooks/use-groups";
import type { RolesQueryResult } from "@/lib/queries/roles";

type DataScope = "own" | "group" | "all";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedUserIds: string[];
  roles: RolesQueryResult;
  onSuccess: () => void;
}

export function BulkEditModal({ open, onClose, selectedUserIds, roles, onSuccess }: Props) {
  const { data: groupsResult } = useGroups();
  const groups = groupsResult?.data ?? [];
  const [roleId, setRoleId] = useState("");
  const [dataScope, setDataScope] = useState<DataScope>("own");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setRoleId(""); setDataScope("own"); setSelectedGroupIds([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (!roleId && dataScope === "own") { toast.error("Pilih minimal role atau data access"); return; }
    setSubmitting(true);
    const result = await bulkUpdateUsers({
      userIds: selectedUserIds,
      ...(roleId && { roleId }),
      dataScope,
      ...(dataScope === "group" && selectedGroupIds.length > 0 && { groupIds: selectedGroupIds }),
    });
    setSubmitting(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(`${result.updated} user berhasil diupdate`);
    onSuccess();
    handleClose();
  };

  return (
    <Drawer isOpen={open} onClose={handleClose} title={`Bulk Edit (${selectedUserIds.length} users)`}>
      <div className="flex flex-col justify-between h-full">
        <div className="flex-1 overflow-y-auto space-y-4 px-2">

          {/* Role */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="mt-1 w-full border-[#CCCCCC] bg-[#F9F9F9]">
                <SelectValue placeholder="Pilih role baru (opsional)" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-gray-400 mt-1">Kosongkan jika tidak ingin mengubah role</p>
          </div>

          {/* Data Access */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Data Access</Label>
            <p className="text-xs text-gray-500 mt-1 mb-2">Controls which booking data this user can see</p>
            <div className="flex gap-2">
              {(["own", "group", "all"] as const).map((scope) => {
                const icons = { own: <User weight="BoldDuotone" className="h-3 w-3" />, group: <UsersGroupRounded weight="BoldDuotone" className="h-3 w-3" />, all: <Earth weight="BoldDuotone" className="h-3 w-3" /> };
                const labels = { own: "Own", group: "Group", all: "All" };
                return (
                  <button key={scope} type="button" onClick={() => setDataScope(scope)}
                    className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-all flex-1 justify-center",
                      dataScope === scope ? "bg-primary text-primary-foreground border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    )}>
                    {icons[scope]}{labels[scope]}
                  </button>
                );
              })}
            </div>
            {dataScope === "group" && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-500">Assign ke group:</p>
                {selectedGroupIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedGroupIds.map((gid) => {
                      const g = groups.find((x) => x.id === gid);
                      if (!g) return null;
                      return (
                        <span key={gid} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                          {g.name}
                          <button type="button" onClick={() => setSelectedGroupIds((p) => p.filter((id) => id !== gid))} className="ml-0.5 hover:text-gray-300"><CloseCircle weight="BoldDuotone" className="h-3 w-3" /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <SearchableSelect
                  options={groups.filter((g) => !selectedGroupIds.includes(g.id)).map((g) => ({ id: g.id, name: g.name }))}
                  value={undefined}
                  onChange={(gid) => { if (gid && !selectedGroupIds.includes(gid)) setSelectedGroupIds((p) => [...p, gid]); }}
                  placeholder="Tambah ke group..."
                  searchPlaceholder="Cari group..."
                  emptyText="Tidak ada group"
                />
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-background pt-4 px-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={submitting} className="flex-1 text-destructive border-destructive hover:bg-destructive/10">Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">{submitting ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
