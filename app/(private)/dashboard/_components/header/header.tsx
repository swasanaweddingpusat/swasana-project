"use client";

import { usePathname } from "next/navigation";
import { ROUTE_META } from "@/lib/route-meta";
import { UserMenu } from "./user-menu";

export function Header() {
  const pathname = usePathname();
  const meta = ROUTE_META[pathname];

  return (
    <header className="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between shrink-0">
      <div className="min-w-0">
        {meta && (
          <div>
            <h1 className="text-sm font-semibold text-gray-900 truncate">
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className="text-xs text-gray-500 truncate">{meta.subtitle}</p>
            )}
          </div>
        )}
      </div>

      <UserMenu />
    </header>
  );
}
