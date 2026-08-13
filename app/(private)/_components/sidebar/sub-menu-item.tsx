"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AltArrowDown, AltArrowRight } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { SubMenuItem } from "./sidebar-config";

function isPathActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

function hasActiveChild(submenu: SubMenuItem[], pathname: string): boolean {
  return submenu.some(
    (s) => isPathActive(s.href, pathname) || (s.submenu && hasActiveChild(s.submenu, pathname))
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
  const active = item.submenu
    ? isPathActive(item.href, pathname)
    : pathname === item.href;
  const childActive = item.submenu ? hasActiveChild(item.submenu, pathname) : false;
  const [open, setOpen] = useState(active || childActive);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (active || childActive) setOpen(true);
  }, [active, childActive]);

  const Icon = item.icon;

  if (item.submenu) {
    return (
      <div>
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
            active || childActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Link href={item.href} className="flex items-center flex-1 min-w-0">
            {Icon && <Icon weight="BoldDuotone" className="mr-2 h-4 w-4 shrink-0 text-foreground" />}
            {!collapsed && <span>{item.name}</span>}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setOpen(!open)}
              className={cn('p-1', 'rounded', 'hover:bg-accent', 'transition-colors', 'cursor-pointer', 'shrink-0')}
            >
              {open ? <AltArrowDown weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} /> : <AltArrowRight weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />}
            </button>
          )}
        </div>
        {open && !collapsed && (
          <div className={cn('ml-4')}>
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
        "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {Icon && <Icon weight="BoldDuotone" className="mr-2 h-4 w-4 text-foreground" />}
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );
}
