"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubMenuItem } from "./sidebar-config";

function isPathActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function hasActiveChild(submenu: SubMenuItem[], pathname: string): boolean {
  return submenu.some(
    (s) =>
      isPathActive(s.href, pathname) ||
      (s.submenu && hasActiveChild(s.submenu, pathname))
  );
}

export function SubMenuItemRow({
  item,
  collapsed,
  depth = 1,
}: {
  item: SubMenuItem;
  collapsed: boolean;
  depth?: number;
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
            "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors",
            depth === 1 ? "pl-9" : "pl-14",
            active || childActive
              ? "text-primary font-medium"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          {!collapsed && <span className="flex-1 text-left">{item.name}</span>}
          {!collapsed && (
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                open && "rotate-180"
              )}
            />
          )}
        </button>
        {open && !collapsed && (
          <div className="mt-0.5">
            {item.submenu.map((sub) => (
              <SubMenuItemRow key={sub.href} item={sub} collapsed={collapsed} depth={depth + 1} />
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
        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors",
        depth === 1 ? "pl-9" : "pl-14",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );
}
