"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { AltArrowDown } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { FINANCE_NAV, type FinanceNavItem } from "./finance-nav-config";

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/finance") return pathname === "/dashboard/finance";
  return pathname === href || pathname.startsWith(href + "/");
}

function isParentActive(item: FinanceNavItem, pathname: string): boolean {
  if (isActive(item.href, pathname)) return true;
  return (item.children ?? []).some((c) => isActive(c.href, pathname));
}

function TabWithDropdown({
  item,
  pathname,
}: {
  item: FinanceNavItem;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = isParentActive(item, pathname);
  const Icon = item.icon;

  const openDropdown = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <div
        onMouseEnter={openDropdown}
        onMouseLeave={scheduleClose}
        className="relative"
      >
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon weight="BoldDuotone" className="h-4 w-4 shrink-0" />
            {item.name}
            <AltArrowDown
              weight="BoldDuotone"
              className={cn(
                "h-3 w-3 shrink-0 transition-transform duration-150",
                open && "rotate-180",
              )}
            />
          </button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            onMouseEnter={openDropdown}
            onMouseLeave={scheduleClose}
            align="start"
            sideOffset={0}
            className={cn(
              "z-50 min-w-[200px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-lg",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2",
            )}
          >
            {item.children!.map((child) => {
              const childActive = isActive(child.href, pathname);
              const ChildIcon = child.icon;
              return (
                <DropdownMenuPrimitive.Item key={child.href} asChild>
                  <Link
                    href={child.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors select-none",
                      childActive
                        ? "bg-accent font-semibold text-foreground"
                        : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        childActive ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <ChildIcon weight="BoldDuotone" className="h-4 w-4" />
                    </span>
                    {child.name}
                  </Link>
                </DropdownMenuPrimitive.Item>
              );
            })}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </div>
    </DropdownMenuPrimitive.Root>
  );
}

function SimpleTab({
  item,
  pathname,
}: {
  item: FinanceNavItem;
  pathname: string;
}) {
  const active = isParentActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon weight="BoldDuotone" className="h-4 w-4 shrink-0" />
      {item.name}
    </Link>
  );
}

export function FinanceTabNav(): React.ReactElement {
  const pathname = usePathname();

  return (
    <div className="sticky top-14 z-20 -mx-4 -mt-4 mb-6 border-b border-border bg-background lg:-mx-6 lg:-mt-6">
      <div className="flex items-end gap-0 overflow-x-auto px-4 md:px-6">
        {FINANCE_NAV.map((item) =>
          item.children?.length ? (
            <TabWithDropdown key={item.href} item={item} pathname={pathname} />
          ) : (
            <SimpleTab key={item.href} item={item} pathname={pathname} />
          ),
        )}
      </div>
    </div>
  );
}
