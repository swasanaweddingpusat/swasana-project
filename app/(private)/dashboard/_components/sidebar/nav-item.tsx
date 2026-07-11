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
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavItem, SubMenuItem } from "./sidebar-config";

// Tooltip cuma muncul saat sidebar collapsed (mini). Saat expanded/mobile,
// render anak apa adanya supaya tidak ada Tooltip.Trigger tanpa Root.
function NavTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}): React.ReactElement {
  const { state, isMobile } = useSidebar();
  if (state !== "collapsed" || isMobile) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

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

/**
 * Di antara sibling yang cocok, yang paling spesifik (href terpanjang) menang.
 * Mencegah leaf ber-href pendek (mis. Overview "/dashboard/finance") ikut aktif
 * saat sibling yang lebih dalam (Cashflow "/dashboard/finance/ledger") yang
 * sebenarnya cocok.
 */
function mostSpecificActiveHref(items: { href: string }[], pathname: string): string | null {
  let best: string | null = null;
  for (const it of items) {
    if (isPathActive(it.href, pathname) && (best === null || it.href.length > best.length)) {
      best = it.href;
    }
  }
  return best;
}

function SubItemRow({
  item,
  pathname,
  activeHref,
}: {
  item: SubMenuItem;
  pathname: string;
  /** href sibling paling spesifik yang aktif — leaf hanya aktif kalau ini href-nya. */
  activeHref: string | null;
}) {
  const active = isPathActive(item.href, pathname) && item.href === activeHref;
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
              <SubItemRow
                key={sub.href}
                item={sub}
                pathname={pathname}
                activeHref={mostSpecificActiveHref(item.submenu!, pathname)}
              />
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
        <NavTooltip label={item.name}>
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
        </NavTooltip>
        {open && (
          <SidebarMenuSub>
            {item.submenu.map((sub) => (
              <SubItemRow
                key={sub.href}
                item={sub}
                pathname={pathname}
                activeHref={mostSpecificActiveHref(item.submenu!, pathname)}
              />
            ))}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <NavTooltip label={item.name}>
        <SidebarMenuButton
          render={<Link href={item.href} />}
          isActive={active}
          className="font-semibold"
        >
          <Icon weight="BoldDuotone" className="text-sidebar-foreground" />
          <span>{item.name}</span>
        </SidebarMenuButton>
      </NavTooltip>
    </SidebarMenuItem>
  );
}
