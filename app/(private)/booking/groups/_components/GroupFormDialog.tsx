"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCreateGroup, useUpdateGroup } from "@/hooks/use-groups";
import { LeaderCombobox } from "./LeaderCombobox";
import type { GroupWithPerformance, EligibleLeader } from "@/lib/queries/groups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: GroupWithPerformance | null;
  eligibleLeaders?: EligibleLeader[];
}

export function GroupFormDialog({ open, onOpenChange, group, eligibleLeaders = [] }: Props) {
  const isEdit = !!group;
  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [leaderId, setLeaderId] = useState<string | null>(group?.leaderId ?? null);

  function handleSubmit() {
    const handlers = {
      onSuccess: (res: { success: boolean; error?: string }) => {
        if (res.success) {
          toast.success(isEdit ? "Grup berhasil diperbarui" : "Grup berhasil dibuat");
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Terjadi kesalahan");
        }
      },
      onError: () => toast.error("Terjadi kesalahan"),
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: group.id, name, description, leaderId: leaderId ?? undefined },
        handlers,
      );
    } else {
      createMutation.mutate(
        { name, description, leaderId: leaderId ?? undefined },
        handlers,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogTitle>{isEdit ? "Edit Group" : "Buat Group Baru"}</DialogTitle>
        <div className="space-y-3 mt-2">
          <div>
            <Label htmlFor="group-name" className="text-sm">Nama Group</Label>
            <Input
              id="group-name"
              className="mt-1 text-base sm:text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama group"
            />
          </div>
          <div>
            <Label htmlFor="group-desc" className="text-sm">Deskripsi</Label>
            <Textarea
              id="group-desc"
              className="mt-1 text-base sm:text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi (opsional)"
              rows={3}
            />
          </div>
          {eligibleLeaders.length > 0 && (
            <div>
              <Label htmlFor="group-leader-trigger" className="text-sm">Leader</Label>
              <LeaderCombobox
                eligibleLeaders={eligibleLeaders}
                value={leaderId}
                onChange={setLeaderId}
                triggerId="group-leader-trigger"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Opsional — bisa diset belakangan
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button className="flex-1" disabled={isPending || !name.trim()} onClick={handleSubmit}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
