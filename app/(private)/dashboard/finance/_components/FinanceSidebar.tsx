"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AltArrowDown, AltArrowRight, SidebarMinimalistic } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { FINANCE_NAV, type FinanceNavItem } from "./finance-nav-config";

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/finance") return pathname === "/dashboard/finance";
  return pathname === href || pathname.startsWith(href + "/");
}

function hasActiveChild(item: FinanceNavItem, pathname: string): boolean {
  return (item.children ?? []).some((c) => isActive(c.href, pathname));
}

function ParentRow({
  item,
  pathname,
  collapsed,
}: {
  item: FinanceNavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const childActive = hasActiveChild(item, pathname);
  const selfActive = isActive(item.href, pathname) && !childActive;
  const [open, setOpen] = useState(childActive || selfActive);
  const Icon = item.icon;
  const highlight = childActive || selfActive;

  return (
    <li>
      <div className="flex items-center">
        <Link
          href={item.href}
          title={collapsed ? item.name : undefined}
          className={cn(
            "flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
            collapsed && "lg:justify-center lg:px-0",
            highlight
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-accent",
          )}
        >
          <Icon weight="BoldDuotone" className="h-4 w-4 shrink-0" />
          <span className={cn("truncate", collapsed && "lg:hidden")}>{item.name}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? `Tutup ${item.name}` : `Buka ${item.name}`}
          className={cn(
            "ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent",
            collapsed && "lg:hidden",
          )}
        >
          {open ? (
            <AltArrowDown weight="BoldDuotone" className="h-4 w-4" />
          ) : (
            <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
          )}
        </button>
      </div>

      {open && (
        <ul
          className={cn(
            "mt-1 ml-4 flex flex-col gap-0.5 border-l border-border pl-3",
            collapsed && "lg:hidden",
          )}
        >
          {item.children!.map((child) => {
            const ChildIcon = child.icon;
            const active = isActive(child.href, pathname);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent font-semibold text-foreground"
                      : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <ChildIcon
                    weight="BoldDuotone"
                    className={cn("h-4 w-4 shrink-0", active && "text-primary")}
                  />
                  <span className="truncate">{child.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function LeafRow({
  item,
  pathname,
  collapsed,
}: {
  item: FinanceNavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isActive(item.href, pathname);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        title={collapsed ? item.name : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
          collapsed && "lg:justify-center lg:px-0",
          active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
        )}
      >
        <Icon weight="BoldDuotone" className="h-4 w-4 shrink-0" />
        <span className={cn("truncate", collapsed && "lg:hidden")}>{item.name}</span>
      </Link>
    </li>
  );
}

export function FinanceSidebar(): React.ReactElement {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      aria-label="Navigasi Finance"
      className={cn(
        // Mobile: flush full-width block under the header, divider at the bottom.
        "-mx-4 -mt-4 mb-2 border-b border-border bg-card",
        // Desktop: flush rail glued to the global sidebar and header, full height.
        // Sticky threshold is -top-6 (not top-0) so it clamps flush against the
        // header instead of below <main>'s 1.5rem top padding.
        "lg:mx-0 lg:mb-0 lg:-ml-6 lg:-mt-6 lg:sticky lg:-top-6 lg:self-start",
        "lg:h-[calc(100dvh-3.5rem)] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r",
        "lg:transition-[width] lg:duration-200",
        collapsed ? "lg:w-16" : "lg:w-60",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 lg:py-3">
        <p
          className={cn(
            "px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
            collapsed && "lg:hidden",
          )}
        >
          Finance
        </p>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Lebarkan menu" : "Ciutkan menu"}
          title={collapsed ? "Lebarkan menu" : "Ciutkan menu"}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent lg:flex"
        >
          <SidebarMinimalistic weight="BoldDuotone" className="h-4 w-4" />
        </button>
      </div>

      <ul className="flex flex-col gap-0.5 px-2 pb-3">
        {FINANCE_NAV.map((item) =>
          item.children?.length ? (
            <ParentRow key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ) : (
            <LeafRow key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ),
        )}
      </ul>
    </aside>
  );
}
