"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./sidebar-config";
import { SubMenuItemRow } from "./sub-menu-item";

function isPathActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function hasActiveChild(submenu: { href: string; submenu?: typeof submenu }[], pathname: string): boolean {
  return submenu.some(
    (s) =>
      isPathActive(s.href, pathname) ||
      (s.submenu && hasActiveChild(s.submenu, pathname))
  );
}

export function NavItemRow({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
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
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            active || childActive
              ? "bg-primary/10 text-primary"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.name}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  open && "rotate-180"
                )}
              />
            </>
          )}
        </button>
        {open && !collapsed && (
          <div className="mt-0.5 space-y-0.5">
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
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );
}
