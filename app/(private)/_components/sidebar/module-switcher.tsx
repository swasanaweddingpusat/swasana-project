"use client";

import { useRouter } from "next/navigation";
import {
  Wallet,
  UsersGroupRounded,
  TicketSale,
  CartLarge,
  AltArrowDown,
  Widget,
} from "@solar-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useModules } from "@/hooks/useModules";
import { useActiveModule } from "./use-active-module";

const ICONS: Record<string, typeof Widget> = {
  Wallet,
  UsersGroupRounded,
  TicketSale,
  CartLarge,
};

export function ModuleSwitcher(): React.JSX.Element | null {
  const router = useRouter();
  const activeKey = useActiveModule();
  const { data: modules } = useModules();

  if (!modules || modules.length === 0) return null;

  const active = modules.find((m) => m.key === activeKey);
  const ActiveIcon = active ? (ICONS[active.icon ?? ""] ?? Widget) : Widget;
  const activeLabel = active?.name ?? "Pilih Module";

  // Hanya punya satu module → tidak ada yang bisa dipilih. Tampilkan sebagai
  // label statis (tanpa dropdown / chevron); module itu otomatis aktif.
  if (modules.length === 1) {
    const only = modules[0];
    const OnlyIcon = ICONS[only.icon ?? ""] ?? Widget;
    return (
      <div className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium">
        <OnlyIcon weight="BoldDuotone" className="h-5 w-5" />
        <span className="flex-1 truncate text-left">{only.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
        <ActiveIcon weight="BoldDuotone" className="h-5 w-5" />
        <span className="flex-1 truncate text-left">{activeLabel}</span>
        <AltArrowDown weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56 rounded-xl">
        {modules.map((m) => {
          const Icon = ICONS[m.icon ?? ""] ?? Widget;
          return (
            <DropdownMenuItem
              key={m.key}
              onClick={() => router.push(`/${m.key}/overview`)}
              className="gap-2 rounded-lg"
            >
              <Icon weight="BoldDuotone" className="h-4 w-4" />
              {m.name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
