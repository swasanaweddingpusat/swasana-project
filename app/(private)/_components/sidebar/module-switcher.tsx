"use client";

import { useRouter } from "next/navigation";
import {
  Wallet,
  UsersGroupRounded,
  TicketSale,
  CartLarge,
  AltArrowDown,
  Widget,
  Home2,
} from "@solar-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useModules } from "@/hooks/useModules";
import { useActiveModule, GENERAL_MODULE } from "./use-active-module";

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

  const isGeneral = activeKey === GENERAL_MODULE;
  const active = modules.find((m) => m.key === activeKey);
  const ActiveIcon = isGeneral ? Home2 : (active ? (ICONS[active.icon ?? ""] ?? Widget) : Widget);
  const activeLabel = isGeneral ? "General" : (active?.name ?? "Pilih Module");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
        <ActiveIcon weight="BoldDuotone" className="h-5 w-5" />
        <span className="flex-1 truncate text-left">{activeLabel}</span>
        <AltArrowDown weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56 rounded-xl">
        {/* "General" world — Home + cross-module items (Maintenance, Guestbook, Cuti, Settings, …). */}
        <DropdownMenuItem onClick={() => router.push("/")} className="gap-2 rounded-lg">
          <Home2 weight="BoldDuotone" className="h-4 w-4" />
          General
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
