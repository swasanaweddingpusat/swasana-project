"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EligibleLeader } from "@/lib/queries/groups";

interface Props {
  eligibleLeaders: EligibleLeader[];
  value: string | null;
  onChange: (value: string | null) => void;
  triggerId?: string;
}

export function LeaderCombobox({ eligibleLeaders, value, onChange, triggerId }: Props) {
  const [open, setOpen] = useState(false);

  const selected = eligibleLeaders.find((l) => l.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={triggerId}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Pilih leader"
            className="w-full justify-between mt-1 font-normal"
          >
            {selected ? (
              <span className="truncate">
                {selected.fullName ?? selected.id}
                {selected.role?.name && (
                  <span className="ml-1.5 text-muted-foreground text-xs">
                    — {selected.role.name}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Pilih orang...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari nama atau role..." autoFocus />
          <CommandList>
            <CommandEmpty>Tidak ada hasil.</CommandEmpty>
            <CommandGroup>
              {eligibleLeaders.map((leader) => (
                <CommandItem
                  key={leader.id}
                  value={`${leader.fullName ?? leader.id} ${leader.role?.name ?? ""} ${leader.email ?? ""}`}
                  onSelect={() => {
                    onChange(leader.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === leader.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{leader.fullName ?? leader.id}</span>
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
  );
}
