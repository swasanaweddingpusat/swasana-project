"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import {
  MODULE_NAV_MAP,
  GENERAL_NAV,
  SETTINGS_MODULES,
  type NavItem,
  type SubMenuItem,
} from "./sidebar-config";
import { NavItemRow } from "./nav-item";
import { usePermissions } from "@/hooks/use-permissions";
import { useActiveModule, GENERAL_MODULE } from "./use-active-module";

type CanFn = (module: string, action: string) => boolean;

function passesPermission(
  item: { permission?: { module: string; action: string }; anyPermission?: { module: string; action: string }[] },
  can: CanFn,
): boolean {
  if (item.permission && !can(item.permission.module, item.permission.action)) return false;
  if (item.anyPermission && !item.anyPermission.some((p) => can(p.module, p.action))) return false;
  return true;
}

function filterSubMenus(items: SubMenuItem[], can: CanFn): SubMenuItem[] {
  return items.flatMap((item) => {
    if (item.hidden) return [];
    if (!passesPermission(item, can)) return [];
    if (item.submenu) {
      const filtered = filterSubMenus(item.submenu, can);
      if (!item.permission && !item.anyPermission && filtered.length === 0) return [];
      return [{ ...item, submenu: filtered }];
    }
    return [item];
  });
}

function filterNavItems(items: NavItem[], can: CanFn, isGroupMember: boolean): NavItem[] {
  return items.flatMap((item) => {
    if (item.hidden) return [];
    if (item.href === "/settings") {
      const hasSettingsAccess = SETTINGS_MODULES.some((mod) => can(mod, "view"));
      if (!hasSettingsAccess) return [];
      return [item];
    }
    if (item.href === "/booking/groups") {
      if (!can("groups", "view") && !isGroupMember) return [];
      return [item];
    }
    if (!passesPermission(item, can)) return [];
    if (item.submenu) {
      const filtered = filterSubMenus(item.submenu, can);
      if (!item.permission && !item.anyPermission && filtered.length === 0) return [];
      return [{ ...item, submenu: filtered }];
    }
    return [item];
  });
}

// "Home" is pinned to the very top of the sidebar in every world; the remaining
// general items (Maintenance, Guestbook, Cuti, Settings, …) belong ONLY to the
// "General" world and are hidden while a module (Finance, HRD, …) is active.
const HOME_ITEM = GENERAL_NAV.find((item) => item.href === "/");
const GENERAL_REST = GENERAL_NAV.filter((item) => item.href !== "/");

export function SidebarNav() {
  const { can, isLoading, isGroupMember } = usePermissions();
  const activeModule = useActiveModule();
  // General world → Home + general items. Module world → Home + that module's nav.
  const worldItems: NavItem[] =
    activeModule === GENERAL_MODULE ? GENERAL_REST : MODULE_NAV_MAP[activeModule];
  const items: NavItem[] = [
    ...(HOME_ITEM ? [HOME_ITEM] : []),
    ...worldItems,
  ];
  const visibleItems = isLoading ? [] : filterNavItems(items, can, isGroupMember);

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading
            ? Array.from({ length: 7 }).map((_, i) => (
                <SidebarMenuSkeleton key={i} showIcon />
              ))
            : visibleItems.map((item) => (
                <NavItemRow key={item.href} item={item} />
              ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
