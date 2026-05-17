"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createGroup, updateGroup } from "@/actions/groups";
import type { GroupWithPerformance } from "@/lib/queries/groups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: GroupWithPerformance | null;
}

export function GroupFormDialog({ open, onOpenChange, group }: Props) {
  const isEdit = !!group;
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");

  function handleSubmit() {
    startTransition(async () => {
      const res = isEdit
        ? await updateGroup({ id: group.id, name, description })
        : await createGroup({ name, description });

      if (res.success) {
        toast.success(isEdit ? "Grup berhasil diperbarui" : "Grup berhasil dibuat");
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{isEdit ? "Edit Group" : "Buat Group Baru"}</DialogTitle>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-sm">Nama Group</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama group" />
          </div>
          <div>
            <Label className="text-sm">Deskripsi</Label>
            <Textarea className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi (opsional)" rows={3} />
          </div>
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
