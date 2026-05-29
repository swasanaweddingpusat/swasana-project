"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AltArrowDown, AltArrowRight } from "@solar-icons/react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import type { NavItem, SubMenuItem } from "./sidebar-config";

function isPathActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

function hasActiveChild(
  submenu: { href: string; submenu?: typeof submenu }[],
  pathname: string
): boolean {
  return submenu.some(
    (s) => isPathActive(s.href, pathname) || (s.submenu && hasActiveChild(s.submenu, pathname))
  );
}

function SubItemRow({ item, pathname }: { item: SubMenuItem; pathname: string }) {
  const active = isPathActive(item.href, pathname);
  const childActive = item.submenu ? hasActiveChild(item.submenu, pathname) : false;
  const [open, setOpen] = useState(active || childActive);

  if (item.submenu) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          render={<button type="button" onClick={() => setOpen((v) => !v)} />}
          isActive={active || childActive}
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2 min-w-0">
            {item.icon && (
              <item.icon weight="BoldDuotone" className="size-4 shrink-0 text-sidebar-foreground" />
            )}
            <span className="truncate">{item.name}</span>
          </span>
          {open
            ? <AltArrowDown weight="BoldDuotone" className="size-3.5 shrink-0 text-sidebar-foreground/60" />
            : <AltArrowRight weight="BoldDuotone" className="size-3.5 shrink-0 text-sidebar-foreground/60" />
          }
        </SidebarMenuSubButton>
        {open && (
          <SidebarMenuSub>
            {item.submenu.map((sub) => (
              <SubItemRow key={sub.href} item={sub} pathname={pathname} />
            ))}
          </SidebarMenuSub>
        )}
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        render={<Link href={item.href} />}
        isActive={active}
      >
        {item.icon && (
          <item.icon weight="BoldDuotone" className="size-4 shrink-0 text-sidebar-foreground" />
        )}
        <span>{item.name}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

export function NavItemRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isPathActive(item.href, pathname);
  const childActive = item.submenu ? hasActiveChild(item.submenu, pathname) : false;
  const [open, setOpen] = useState(active || childActive);

  const Icon = item.icon;

  if (item.submenu) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<button type="button" onClick={() => setOpen((v) => !v)} />}
          isActive={active || childActive}
          className="font-semibold"
        >
          <Icon weight="BoldDuotone" className="text-sidebar-foreground" />
          <span>{item.name}</span>
          <span className="ml-auto group-data-[collapsible=icon]:hidden">
            {open
              ? <AltArrowDown weight="BoldDuotone" className="size-4 text-sidebar-foreground/60" />
              : <AltArrowRight weight="BoldDuotone" className="size-4 text-sidebar-foreground/60" />
            }
          </span>
        </SidebarMenuButton>
        {open && (
          <SidebarMenuSub>
            {item.submenu.map((sub) => (
              <SubItemRow key={sub.href} item={sub} pathname={pathname} />
            ))}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.href} />}
        isActive={active}
        className="font-semibold"
      >
        <Icon weight="BoldDuotone" className="text-sidebar-foreground" />
        <span>{item.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
