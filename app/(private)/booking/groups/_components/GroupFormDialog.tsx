"use client";

import { useState } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/shared/multi-select";
import { toast } from "sonner";
import { useCreateGroup, useUpdateGroup, useUpdateGroupVenues } from "@/hooks/use-groups";
import { useVenues } from "@/hooks/use-venues";
import { LeaderCombobox } from "./LeaderCombobox";
import type { GroupWithPerformance, EligibleLeader } from "@/lib/queries/groups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: GroupWithPerformance | null;
  eligibleLeaders?: EligibleLeader[];
}

function sameVenueIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

export function GroupFormDialog({ open, onOpenChange, group, eligibleLeaders = [] }: Props) {
  const isEdit = !!group;
  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup();
  const updateVenuesMutation = useUpdateGroupVenues();
  const { data: venues = [] } = useVenues();
  const isPending = createMutation.isPending || updateMutation.isPending || updateVenuesMutation.isPending;
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [leaderId, setLeaderId] = useState<string | null>(group?.leaderId ?? null);
  const initialVenueIds = group?.venues.map((v) => v.id) ?? [];
  const [venueIds, setVenueIds] = useState<string[]>(initialVenueIds);
  const [homebaseVenueIds, setHomebaseVenueIds] = useState<string[]>(
    group?.homebases?.map((h) => h.venueId) ?? [],
  );

  const venueOptions = venues.map((v) => ({ id: v.id, name: v.name }));

  function finishGroupSave() {
    toast.success(isEdit ? "Grup berhasil diperbarui" : "Grup berhasil dibuat");
    onOpenChange(false);
  }

  function syncVenues(groupId: string) {
    if (sameVenueIds(venueIds, initialVenueIds)) {
      finishGroupSave();
      return;
    }
    updateVenuesMutation.mutate(
      { groupId, venueIds },
      {
        onSuccess: (res) => {
          if (res.success) {
            finishGroupSave();
          } else {
            toast.error(res.error ?? "Venue grup gagal disimpan");
          }
        },
        onError: () => toast.error("Venue grup gagal disimpan"),
      },
    );
  }

  function handleSubmit() {
    if (isEdit) {
      updateMutation.mutate(
        { id: group.id, name, description, leaderId: leaderId ?? undefined, homebaseVenueIds },
        {
          onSuccess: (res) => {
            if (res.success) {
              syncVenues(group.id);
            } else {
              toast.error(res.error ?? "Terjadi kesalahan");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        },
      );
    } else {
      createMutation.mutate(
        { name, description, leaderId: leaderId ?? undefined, homebaseVenueIds },
        {
          onSuccess: (res) => {
            if (res.success && res.group) {
              syncVenues(res.group.id);
            } else {
              toast.error(res.error ?? "Terjadi kesalahan");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        },
      );
    }
  }

  return (
    <Drawer isOpen={open} onClose={() => onOpenChange(false)} title={isEdit ? "Edit Group" : "Buat Group Baru"}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-3 px-1">
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
          <div>
            <Label className="text-sm">Venue</Label>
            <MultiSelect
              className="mt-1"
              options={venueOptions}
              value={venueIds}
              onChange={setVenueIds}
              placeholder="Pilih venue..."
              searchPlaceholder="Cari venue..."
              emptyText="Tidak ada venue"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Opsional — buat filter/tampilan, gak ngaruh ke akses data
            </p>
          </div>
          <div>
            <Label className="text-sm">Homebase Venue (KPI)</Label>
            <MultiSelect
              className="mt-1"
              options={venueOptions}
              value={homebaseVenueIds}
              onChange={setHomebaseVenueIds}
              placeholder="Pilih venue homebase..."
              searchPlaceholder="Cari venue..."
              emptyText="Tidak ada venue"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Dipakai untuk menghitung KPI homebase Sales di grup ini
            </p>
          </div>
        </div>
        <div className="sticky bottom-0 bg-background pt-4">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button className="flex-1" disabled={isPending || !name.trim()} onClick={handleSubmit}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
