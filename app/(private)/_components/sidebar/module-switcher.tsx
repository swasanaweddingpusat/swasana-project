"use client";

import { useRouter, usePathname } from "next/navigation";
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

const ICONS: Record<string, typeof Widget> = {
  Wallet,
  UsersGroupRounded,
  TicketSale,
  CartLarge,
};

export function ModuleSwitcher(): React.JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();
  const { data: modules } = useModules();

  if (!modules || modules.length === 0) return null;

  const activeKey = pathname.split("/")[1];
  const active = modules.find((m) => m.key === activeKey);
  const ActiveIcon = active ? (ICONS[active.icon ?? ""] ?? Widget) : Widget;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
        <ActiveIcon weight="BoldDuotone" className="h-5 w-5" />
        <span className="flex-1 truncate text-left">
          {active?.name ?? "Pilih Module"}
        </span>
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
