"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddCircle, Book } from "@solar-icons/react";
import { resolveRouteMeta } from "@/lib/route-meta";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "./notification-bell";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { usePoll } from "@/hooks/use-poll";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const meta = resolveRouteMeta(pathname)?.meta;
  const { action } = useHeaderAction();
  const { openBookingDrawer } = useBookingDrawer();
  const { can } = usePermissions();
  usePoll();

  return (
    <header className={cn("sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4")}>
      <div className={cn("flex items-center gap-2 min-w-0")}>
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 self-center! data-vertical:self-center" />
        {meta && (
          <div className="min-w-0">
            <h1 className={cn("text-sm font-semibold truncate text-foreground")}>
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className={cn("text-xs text-muted-foreground truncate")}>{meta.subtitle}</p>
            )}
          </div>
        )}
      </div>

      <div className={cn("flex items-center gap-2")}>
        {action}
        {can("booking", "create") && (
          <Button
            size="sm"
            onClick={openBookingDrawer}
            className={cn("cursor-pointer")}
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            <span className={cn("hidden sm:inline ml-1")}>Tambah Booking</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/tutorial" />}
          className={cn("cursor-pointer gap-1.5")}
        >
          <Book weight="BoldDuotone" className="h-4 w-4" />
          <span className={cn("hidden sm:inline")}>Tutorial</span>
        </Button>
        <NotificationBell />
      </div>
    </header>
  );
}
