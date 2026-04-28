"use client";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { useSidebar } from "./sidebar-context";
import { SidebarNav } from "./sidebar-nav";
import { cn } from "../../../../../lib/utils";

export function MobileSidebar() {
  const { mobileOpen, setMobileOpen } = useSidebar();

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className={cn('w-64', 'p-0')} showCloseButton={false}>
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
