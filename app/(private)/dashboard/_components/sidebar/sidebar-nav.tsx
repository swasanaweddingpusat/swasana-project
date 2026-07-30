"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { navItems, SETTINGS_MODULES, type NavItem, type SubMenuItem } from "./sidebar-config";
import { NavItemRow } from "./nav-item";
import { usePermissions } from "@/hooks/use-permissions";

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
    if (item.href === "/dashboard/settings") {
      const hasSettingsAccess = SETTINGS_MODULES.some((mod) => can(mod, "view"));
      if (!hasSettingsAccess) return [];
      return [item];
    }
    if (item.href === "/dashboard/groups") {
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

export function SidebarNav() {
  const { can, isLoading, isGroupMember } = usePermissions();
  const visibleItems = isLoading ? [] : filterNavItems(navItems, can, isGroupMember);

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
