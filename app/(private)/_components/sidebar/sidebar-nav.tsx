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
  SETTINGS_NAV_ITEM,
  SETTINGS_MODULES,
  type NavItem,
  type SubMenuItem,
} from "./sidebar-config";
import { NavItemRow } from "./nav-item";
import { usePermissions } from "@/hooks/use-permissions";
import { useActiveModule } from "./use-active-module";

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

export function SidebarNav() {
  const { can, isLoading, isGroupMember } = usePermissions();
  const activeModule = useActiveModule();

  // The active module's nav, followed by the always-present General items as
  // flat top-level rows — they show in every module world, never swap it out.
  const moduleItems = isLoading ? [] : filterNavItems(MODULE_NAV_MAP[activeModule], can, isGroupMember);
  const generalItems = isLoading ? [] : filterNavItems(GENERAL_NAV, can, isGroupMember);
  const settingsVisible = !isLoading && SETTINGS_MODULES.some((mod) => can(mod, "view"));

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <SidebarMenuSkeleton key={i} showIcon />
            ))
          ) : (
            <>
              {moduleItems.map((item) => (
                <NavItemRow key={item.href} item={item} />
              ))}
              {generalItems.map((item) => (
                <NavItemRow key={item.href} item={item} />
              ))}
              {settingsVisible ? <NavItemRow item={SETTINGS_NAV_ITEM} /> : null}
            </>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
