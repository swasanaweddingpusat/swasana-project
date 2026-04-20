"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./sidebar-config";
import { SubMenuItemRow } from "./sub-menu-item";

function isPathActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function hasActiveChild(submenu: { href: string; submenu?: typeof submenu }[], pathname: string): boolean {
  return submenu.some(
    (s) => isPathActive(s.href, pathname) || (s.submenu && hasActiveChild(s.submenu, pathname))
  );
}

export function NavItemRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = isPathActive(item.href, pathname);
  const childActive = item.submenu ? hasActiveChild(item.submenu, pathname) : false;
  const [open, setOpen] = useState(active || childActive);

  useEffect(() => {
    if (active || childActive) setOpen(true);
  }, [active, childActive]);

  const Icon = item.icon;

  if (item.submenu) {
    return (
      <div>
        <div
          className={cn(
            "w-full flex items-center rounded-md transition-colors cursor-pointer",
            collapsed ? "justify-center px-2 py-3" : "justify-between px-3 py-2",
            "text-sm font-medium",
            active || childActive
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          {collapsed ? (
            <Link href={item.href}>
              <Icon className="h-5 w-5" style={{ color: "#A4A7AE" }} />
            </Link>
          ) : (
            <>
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center flex-1 min-w-0 text-left"
              >
                <Icon className="mr-3 h-5 w-5 shrink-0" style={{ color: "#A4A7AE" }} />
                <span className="font-semibold">{item.name}</span>
              </button>
              <span className="p-1 shrink-0 pointer-events-none">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            </>
          )}
        </div>
        {open && !collapsed && (
          <div className="ml-4 mt-2 space-y-1">
            {item.submenu.map((sub) => (
              <SubMenuItemRow key={sub.href} item={sub} collapsed={collapsed} depth={1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center text-sm font-medium rounded-md transition-colors",
        collapsed ? "justify-center px-2 py-3" : "px-3 py-2",
        active
          ? "bg-gray-100 text-gray-900"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      )}
      title={collapsed ? item.name : ""}
    >
      <Icon className={cn("h-5 w-5", !collapsed && "mr-3")} style={{ color: "#A4A7AE" }} />
      {!collapsed && <span className="font-semibold">{item.name}</span>}
    </Link>
  );
}
