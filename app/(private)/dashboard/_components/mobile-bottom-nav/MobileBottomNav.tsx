"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Widget,
  UsersGroupRounded,
  Volume,
  DocumentAdd,
  Ticket,
  Heart,
  TicketSale,
} from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLeadDrawer } from "@/components/providers/lead-drawer-provider";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { useQuotationDrawer } from "@/components/providers/quotation-drawer-provider";
import type { OpenDrawerOptions } from "@/hooks/use-drawer-controller";

type SolarIcon = ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>>;

/** Items that own a global "create" drawer. Tapping the nav entry while off the
 *  item's page opens the drawer instead of navigating; on submit it redirects
 *  to the list page. While already on the page, the entry is a plain link. */
type DrawerKey = "lead" | "quotation" | "booking";

interface BottomNavItem {
  key: string;
  label: string;
  href?: string;
  Icon: SolarIcon;
  visible: (can: (m: string, a: string) => boolean, isGroupMember: boolean) => boolean;
  isBookingTrigger?: true;
  drawerKey?: DrawerKey;
}

interface BookingSheetItem {
  key: string;
  label: string;
  href: string;
  Icon: SolarIcon;
  visible: (can: (m: string, a: string) => boolean) => boolean;
  drawerKey?: DrawerKey;
}

const NAV_ITEMS: BottomNavItem[] = [
  {
    key: "home",
    label: "Home",
    href: "/dashboard",
    Icon: Widget,
    visible: () => true,
  },
  {
    key: "groups",
    label: "Groups",
    href: "/dashboard/groups",
    Icon: UsersGroupRounded,
    visible: (can, isGroupMember) => can("groups", "view") || isGroupMember,
  },
  {
    key: "leads",
    label: "Leads",
    href: "/dashboard/leads",
    Icon: Volume,
    visible: (can) => can("leads", "view"),
    drawerKey: "lead",
  },
  {
    key: "quotations",
    label: "Quotations",
    href: "/dashboard/quotations",
    Icon: DocumentAdd,
    visible: (can) => can("quotations", "view"),
    drawerKey: "quotation",
  },
  {
    key: "bookings",
    label: "Bookings",
    Icon: Ticket,
    isBookingTrigger: true,
    visible: (can) => can("booking", "view") || can("booking-mice", "view"),
  },
];

const BOOKING_SHEET_ITEMS: BookingSheetItem[] = [
  {
    key: "booking-weddings",
    label: "Booking Weddings",
    href: "/dashboard/booking-weddings",
    Icon: Heart,
    visible: (can) => can("booking", "view"),
    drawerKey: "booking",
  },
  {
    key: "booking-mice",
    label: "Booking MICE",
    href: "/dashboard/booking-mice",
    Icon: TicketSale,
    visible: (can) => can("booking-mice", "view"),
  },
];

const GOLD_DOT = { backgroundColor: "var(--brand-gold)" } as const;

/** Icon + label + active indicator — shared across link / drawer / sheet entries. */
function NavItemBody({
  Icon,
  label,
  active,
}: {
  Icon: SolarIcon;
  label: string;
  active: boolean;
}): React.JSX.Element {
  return (
    <>
      <Icon weight="BoldDuotone" className="h-6 w-6 shrink-0" />
      <span className="text-[10px] font-medium leading-none truncate">{label}</span>
      {active && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full"
          style={GOLD_DOT}
        />
      )}
    </>
  );
}

export function MobileBottomNav(): React.JSX.Element | null {
  const pathname = usePathname();
  const router = useRouter();
  const { can, isLoading, isGroupMember } = usePermissions();
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const { openLeadDrawer } = useLeadDrawer();
  const { openBookingDrawer } = useBookingDrawer();
  const { openQuotationDrawer } = useQuotationDrawer();

  const drawerOpeners: Record<DrawerKey, (opts?: OpenDrawerOptions) => void> = {
    lead: openLeadDrawer,
    quotation: openQuotationDrawer,
    booking: openBookingDrawer,
  };

  /** Open the create drawer for `key`; redirect to `href` once a record is saved. */
  const openCreateDrawer = (key: DrawerKey, href: string): void => {
    drawerOpeners[key]({ onSuccess: () => router.push(href) });
  };

  const isActive = (href: string): boolean => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const isBookingActive =
    pathname.startsWith("/dashboard/booking-weddings") ||
    pathname.startsWith("/dashboard/booking-mice");

  if (isLoading) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border bg-card">
        <div
          className="flex items-center justify-around px-2 pt-2 pb-2"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-3 py-1">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-2.5 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.visible(can, isGroupMember)
  );

  if (visibleItems.length === 0) return null;

  const visibleBookingItems = BOOKING_SHEET_ITEMS.filter((item) =>
    item.visible(can)
  );

  const navItemClass = (active: boolean): string =>
    cn(
      "relative flex flex-col items-center gap-1 px-3 pb-2 min-w-0 flex-1",
      "transition-colors duration-150",
      active ? "text-foreground" : "text-muted-foreground"
    );

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border bg-card shadow-[0_-2px_12px_0_hsl(var(--foreground)/0.06)]">
        <div
          className="flex items-center justify-around px-1 pt-2"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {visibleItems.map((item) => {
            // Bookings → opens the category bottom sheet.
            if (item.isBookingTrigger) {
              const active = isBookingActive || bookingSheetOpen;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setBookingSheetOpen(true)}
                  className={navItemClass(active)}
                >
                  <NavItemBody Icon={item.Icon} label={item.label} active={active} />
                </button>
              );
            }

            const active = isActive(item.href!);

            // Create-drawer items, while off-page → open drawer instead of navigating.
            if (item.drawerKey && !active) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openCreateDrawer(item.drawerKey!, item.href!)}
                  className={navItemClass(active)}
                >
                  <NavItemBody Icon={item.Icon} label={item.label} active={active} />
                </button>
              );
            }

            return (
              <Link key={item.key} href={item.href!} className={navItemClass(active)}>
                <NavItemBody Icon={item.Icon} label={item.label} active={active} />
              </Link>
            );
          })}
        </div>
      </div>

      <Sheet open={bookingSheetOpen} onOpenChange={setBookingSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="rounded-t-2xl px-0 pb-0"
        >
          <SheetHeader className="px-5 pb-3">
            <SheetTitle>Bookings</SheetTitle>
          </SheetHeader>

          <div
            className="flex flex-col gap-1 px-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            {visibleBookingItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setBookingSheetOpen(false);
                    if (active) return;
                    if (item.drawerKey) {
                      openCreateDrawer(item.drawerKey, item.href);
                    } else {
                      router.push(item.href);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 w-full text-left",
                    "transition-colors duration-150",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <item.Icon weight="BoldDuotone" className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
