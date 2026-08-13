"use client";

import { usePathname } from "next/navigation";
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
  type ModuleKey,
  type NavItem,
  type SubMenuItem,
} from "./sidebar-config";
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

function isModuleKey(key: string): key is ModuleKey {
  return Object.prototype.hasOwnProperty.call(MODULE_NAV_MAP, key);
}

export function SidebarNav() {
  const { can, isLoading, isGroupMember } = usePermissions();
  const activeModule = usePathname().split("/")[1];
  const moduleItems: NavItem[] = isModuleKey(activeModule)
    ? MODULE_NAV_MAP[activeModule]
    : [];
  const items: NavItem[] = [...moduleItems, ...GENERAL_NAV];
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
