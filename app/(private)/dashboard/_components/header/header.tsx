"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ROUTE_META } from "@/lib/route-meta";
import { useSidebar } from "../sidebar/sidebar-context";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { useHeaderAction } from "@/components/providers/header-action-provider";

export function Header() {
  const pathname = usePathname();
  const meta = ROUTE_META[pathname];
  const { toggleMobile } = useSidebar();
  const { action } = useHeaderAction();

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-16 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleMobile}
          className="lg:hidden p-1.5 -ml-1 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-gray-600" />
        </button>

        {meta && (
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className="text-xs text-gray-500 truncate">{meta.subtitle}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {action}
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
