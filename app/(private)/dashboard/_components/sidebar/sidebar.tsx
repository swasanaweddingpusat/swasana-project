"use client";

import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { NavUser } from "./nav-user";

export function SwasanaSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3 py-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <Image
            src="/logo-sgp.svg"
            alt="Swasana Gemilang Persada"
            width={36}
            height={36}
            priority
            className="size-9 shrink-0 group-data-[collapsible=icon]:size-7"
          />
          <div className="flex items-baseline gap-1.5 min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="font-display text-base font-semibold text-sidebar-foreground truncate">
              Kediaman
            </span>
            <span className="text-xs font-medium text-sidebar-foreground/60">
              Corp
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
