"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { updateGroupLeader } from "@/actions/groups";
import type { GroupDetail } from "@/lib/queries/groups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: NonNullable<GroupDetail>;
}

export function ChangeLeaderDialog({ open, onOpenChange, group }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(group.leaderId ?? "");

  function handleSave() {
    if (!selectedId) return;
    startTransition(async () => {
      const res = await updateGroupLeader(group.id, selectedId);
      if (res.success) {
        toast.success("Leader berhasil diganti");
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Ganti Leader — {group.name}</DialogTitle>
        <div className="mt-2 space-y-3">
          <div>
            <Label className="text-sm">Pilih Leader Baru</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih anggota..." />
              </SelectTrigger>
              <SelectContent>
                {group.members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.profile.fullName ?? m.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button className="flex-1" disabled={isPending || !selectedId} onClick={handleSave}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
