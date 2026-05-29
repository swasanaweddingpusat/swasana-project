"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUpdateGroupLeader } from "@/hooks/use-groups";
import type { GroupDetail, EligibleLeader } from "@/lib/queries/groups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: NonNullable<GroupDetail>;
  eligibleLeaders: EligibleLeader[];
}

export function ChangeLeaderDialog({ open, onOpenChange, group, eligibleLeaders }: Props) {
  const router = useRouter();
  const updateLeaderMutation = useUpdateGroupLeader();

  const [selectedId, setSelectedId] = useState(group.leaderId ?? "");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const selectedLeader = eligibleLeaders.find((l) => l.id === selectedId);

  function handleSave() {
    if (!selectedId) return;
    updateLeaderMutation.mutate(
      { groupId: group.id, leaderId: selectedId },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast.success("Leader berhasil diganti");
            onOpenChange(false);
            router.refresh();
          } else {
            toast.error(res.error ?? "Terjadi kesalahan");
          }
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogTitle>Ganti Leader — {group.name}</DialogTitle>
        <div className="mt-2 space-y-3">
          <div>
            <Label htmlFor="change-leader-trigger" className="text-sm">Pilih Leader Baru</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id="change-leader-trigger"
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    aria-label="Pilih leader baru"
                    className="w-full justify-between mt-1 font-normal"
                  >
                    {selectedLeader ? (
                      <span className="truncate">
                        {selectedLeader.fullName ?? selectedLeader.id}
                        {selectedLeader.role?.name && (
                          <span className="ml-1.5 text-muted-foreground text-xs">— {selectedLeader.role.name}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pilih orang...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                }
              />
              <PopoverContent
                className="w-[calc(100vw-2rem)] sm:w-80 p-0"
                align="start"
              >
                <Command>
                  <CommandInput
                    placeholder="Cari nama atau role..."
                    autoFocus
                  />
                  <CommandList>
                    <CommandEmpty>Tidak ada hasil.</CommandEmpty>
                    <CommandGroup>
                      {eligibleLeaders.map((leader) => (
                        <CommandItem
                          key={leader.id}
                          value={`${leader.fullName ?? leader.id} ${leader.role?.name ?? ""} ${leader.email ?? ""}`}
                          onSelect={() => {
                            setSelectedId(leader.id);
                            setPopoverOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              selectedId === leader.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex-1 truncate">
                            {leader.fullName ?? leader.id}
                          </span>
                          {leader.role?.name && (
                            <span className="ml-2 shrink-0 text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5">
                              {leader.role.name}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button
            className="flex-1"
            disabled={updateLeaderMutation.isPending || !selectedId}
            onClick={handleSave}
          >
            {updateLeaderMutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
