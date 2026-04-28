"use client";

import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";
import { ROUTE_META } from "@/lib/route-meta";
import { useSidebar } from "../sidebar/sidebar-context";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "../../../../../lib/utils";

export function Header() {
  const pathname = usePathname();
  const meta = ROUTE_META[pathname];
  const { toggleMobile } = useSidebar();
  const { action } = useHeaderAction();
  const { openBookingDrawer } = useBookingDrawer();
  const { can } = usePermissions();

  return (
    <header className={cn('bg-white', 'border-b', 'border-gray-200', 'px-4', 'lg:px-6', 'h-16', 'flex', 'items-center', 'justify-between', 'shrink-0')}>
      <div className={cn('flex', 'items-center', 'gap-3', 'min-w-0')}>
        <button
          onClick={toggleMobile}
          className={cn('lg:hidden', 'p-1.5', '-ml-1', 'rounded-md', 'hover:bg-gray-100', 'transition-colors')}
          aria-label="Open menu"
        >
          <Menu className={cn('h-5', 'w-5', 'text-gray-600')} />
        </button>

        {meta && (
          <div className="min-w-0">
            <h1 className={cn('text-sm', 'font-semibold', 'text-gray-900', 'truncate')}>
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className={cn('text-xs', 'text-gray-500', 'truncate')}>{meta.subtitle}</p>
            )}
          </div>
        )}
      </div>

      <div className={cn('flex', 'items-center', 'gap-2')}>
        {action}
        {can("booking", "create") && (
          <Button size="sm" onClick={openBookingDrawer} className={cn('cursor-pointer', 'bg-gray-900', 'hover:bg-gray-800', 'text-white')}>
            <Plus className={cn('h-4', 'w-4')} />
            <span className={cn('hidden', 'sm:inline', 'ml-1')}>Tambah Booking</span>
          </Button>
        )}
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
