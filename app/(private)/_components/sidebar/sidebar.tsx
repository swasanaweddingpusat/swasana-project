"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { NavUser } from "./nav-user";
import { ModuleSwitcher } from "./module-switcher";

export function SwasanaSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-2 py-0">
        <div className="flex w-full items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192x192.png"
            alt="Swasana"
            className="h-8 w-8 shrink-0 rounded-lg object-contain"
          />
          <ModuleSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent className="sidebar-scroll">
        <SidebarNav />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
