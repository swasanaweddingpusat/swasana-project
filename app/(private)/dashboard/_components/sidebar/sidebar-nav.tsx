"use client";

import Image from "next/image";
import { navItems, type NavItem, type SubMenuItem } from "./sidebar-config";
import { NavItemRow } from "./nav-item";
import { usePermissions } from "@/hooks/use-permissions";

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

type CanFn = (module: string, action: string) => boolean;

function filterSubMenus(items: SubMenuItem[], can: CanFn): SubMenuItem[] {
  return items.flatMap((item) => {
    if (item.hidden) return [];
    if (item.permission && !can(item.permission.module, item.permission.action)) return [];
    if (item.submenu) {
      const filtered = filterSubMenus(item.submenu, can);
      if (!item.permission && filtered.length === 0) return [];
      return [{ ...item, submenu: filtered }];
    }
    return [item];
  });
}

function filterNavItems(items: NavItem[], can: CanFn): NavItem[] {
  return items.flatMap((item) => {
    if (item.hidden) return [];
    if (item.permission && !can(item.permission.module, item.permission.action)) return [];
    if (item.submenu) {
      const filtered = filterSubMenus(item.submenu, can);
      if (!item.permission && filtered.length === 0) return [];
      return [{ ...item, submenu: filtered }];
    }
    return [item];
  });
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { can, isLoading } = usePermissions();
  // While permissions are loading, show all items (no filtering)
  // Once loaded, filter based on actual permissions
  const visibleItems = isLoading ? [] : filterNavItems(navItems, can);

  return (
    <>
      {/* Logo */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-200 h-16 flex items-center px-5">
        {collapsed ? (
          <div className="w-full flex justify-center">
            <Image
              src="/logo-sgp.svg"
              alt="SGP"
              width={100}
              height={100}
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>
        ) : (
          <Image
            src="/logo-swasana.svg"
            alt="Swasana Wedding"
            width={100}
            height={100}
            style={{ width: "65%", height: "auto" }}
            priority
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden" onClick={onNavigate}>
        {visibleItems.map((item) => (
          <NavItemRow key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </>
  );
}
