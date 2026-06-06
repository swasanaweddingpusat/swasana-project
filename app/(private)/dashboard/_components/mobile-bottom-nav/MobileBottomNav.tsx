"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Widget,
  UsersGroupRounded,
  Documents,
  UserCircle,
  UserPlus,
  DocumentAdd,
  CalendarAdd,
  Buildings,
  User,
  Logout,
  AddSquare,
} from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePermissions } from "@/hooks/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getInitials } from "@/lib/utils";
import { useLeadDrawer } from "@/components/providers/lead-drawer-provider";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { useMiceBookingDrawer } from "@/components/providers/mice-booking-drawer-provider";
import { useQuotationDrawer } from "@/components/providers/quotation-drawer-provider";
import type { OpenDrawerOptions } from "@/hooks/use-drawer-controller";

type SolarIcon = ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>>;

/** Drawer-backed create actions surfaced inside the center "+" sheet. */
type DrawerKey = "lead" | "quotation" | "booking" | "mice";

interface BottomNavItem {
  key: string;
  label: string;
  href: string;
  Icon: SolarIcon;
  visible: (can: (m: string, a: string) => boolean, isGroupMember: boolean) => boolean;
}

interface CreateSheetItem {
  key: string;
  label: string;
  description: string;
  /** List page to land on after a successful create (onSuccess redirect). */
  href: string;
  Icon: SolarIcon;
  drawerKey: DrawerKey;
  visible: (can: (m: string, a: string) => boolean) => boolean;
}

/** Left / right navigation slots — the center "+" is rendered separately as a FAB. */
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
    key: "package",
    label: "Package",
    href: "/dashboard/packages",
    Icon: Documents,
    visible: (can) => can("package", "view"),
  },
  {
    key: "profile",
    label: "Profile",
    href: "/dashboard/profile",
    Icon: UserCircle,
    visible: () => true,
  },
];

/** Items inside the center "+" create sheet. Gated by the `create` action so it
 *  mirrors the desktop header "Tambah Baru" menu. */
const CREATE_SHEET_ITEMS: CreateSheetItem[] = [
  {
    key: "lead",
    label: "Tambah Lead",
    description: "Catat prospek baru",
    href: "/dashboard/leads",
    Icon: UserPlus,
    drawerKey: "lead",
    visible: (can) => can("leads", "create"),
  },
  {
    key: "quotation",
    label: "Tambah Quotation",
    description: "Buat penawaran harga untuk klien",
    href: "/dashboard/quotations",
    Icon: DocumentAdd,
    drawerKey: "quotation",
    visible: (can) => can("quotations", "create"),
  },
  {
    key: "booking-weddings",
    label: "Booking Wedding",
    description: "Buat booking pernikahan",
    href: "/dashboard/booking-weddings",
    Icon: CalendarAdd,
    drawerKey: "booking",
    visible: (can) => can("booking", "create"),
  },
  {
    key: "booking-mice",
    label: "Booking MICE",
    description: "Meeting, insentif, konferensi",
    href: "/dashboard/booking-mice",
    Icon: Buildings,
    drawerKey: "mice",
    visible: (can) => can("booking-mice", "create"),
  },
];

const GOLD_DOT = { backgroundColor: "var(--brand-gold)" } as const;

/** Icon + label + active indicator — shared across nav link entries. */
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
  const { data: session } = useSession();
  const { can, isLoading, isGroupMember } = usePermissions();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const { openLeadDrawer } = useLeadDrawer();
  const { openBookingDrawer } = useBookingDrawer();
  const { openMiceBookingDrawer } = useMiceBookingDrawer();
  const { openQuotationDrawer } = useQuotationDrawer();

  const drawerOpeners: Record<DrawerKey, (opts?: OpenDrawerOptions) => void> = {
    lead: openLeadDrawer,
    quotation: openQuotationDrawer,
    booking: openBookingDrawer,
    mice: openMiceBookingDrawer,
  };

  /**
   * Open the create drawer for `key`.
   * When off the item's list page, register an onSuccess redirect so the user
   * lands on the list after saving. When already on the page, skip the redirect
   * — the list refreshes via TanStack Query invalidation.
   */
  const openCreateDrawer = (key: DrawerKey, href: string, alreadyOnPage: boolean): void => {
    drawerOpeners[key](alreadyOnPage ? undefined : { onSuccess: () => router.push(href) });
  };

  const isActive = (href: string): boolean => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  if (isLoading) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-border bg-card">
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

  const visibleItems = NAV_ITEMS.filter((item) => item.visible(can, isGroupMember));
  const visibleCreateItems = CREATE_SHEET_ITEMS.filter((item) => item.visible(can));

  // Split the nav slots so the FAB sits dead-center: [home, groups] | + | [package, profile].
  const half = Math.ceil(visibleItems.length / 2);
  const leftItems = visibleItems.slice(0, half);
  const rightItems = visibleItems.slice(half);

  const userName = session?.user?.name ?? "—";
  const userImage = session?.user?.image ?? "";
  const userRole =
    session?.user?.roleName
      ?.replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? session?.user?.email ?? "";

  const navItemClass = (active: boolean): string =>
    cn(
      "relative flex flex-col items-center gap-1 px-2 pb-2 min-w-0 flex-1",
      "transition-colors duration-150",
      active ? "text-foreground" : "text-muted-foreground"
    );

  const renderNavItem = (item: BottomNavItem): React.JSX.Element => {
    // Profile opens its own bottom sheet instead of navigating directly.
    if (item.key === "profile") {
      const active = isActive(item.href) || profileSheetOpen;
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => setProfileSheetOpen(true)}
          className={navItemClass(active)}
        >
          <NavItemBody Icon={item.Icon} label={item.label} active={active} />
        </button>
      );
    }

    const active = isActive(item.href);
    return (
      <Link key={item.key} href={item.href} className={navItemClass(active)}>
        <NavItemBody Icon={item.Icon} label={item.label} active={active} />
      </Link>
    );
  };

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-border bg-card shadow-[0_-2px_12px_0_hsl(var(--foreground)/0.06)]">
        <div
          className="flex items-center justify-around px-1 pt-2"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {leftItems.map(renderNavItem)}

          {/* Center "Tambah" — opens the create sheet. Same flat treatment as
              the other nav items. Hidden when the user has no create permission
              for any of the surfaced actions. */}
          {visibleCreateItems.length > 0 && (
            <button
              type="button"
              onClick={() => setCreateSheetOpen(true)}
              aria-label="Tambah baru"
              className={cn(
                "relative flex flex-col items-center gap-1 px-2 pb-2 min-w-0 flex-1",
                "transition-colors duration-150 text-muted-foreground"
              )}
            >
              <AddSquare weight="BoldDuotone" className="h-6 w-6 shrink-0" />
              <span className="text-[10px] font-medium leading-none truncate">Tambah</span>
            </button>
          )}

          {rightItems.map(renderNavItem)}
        </div>
      </div>

      {/* Create sheet — Leads / Quotation / Booking Wedding / Booking MICE */}
      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="rounded-t-2xl px-0 pb-0"
        >
          <SheetHeader className="px-5 pb-3">
            <SheetTitle>Tambah Baru</SheetTitle>
          </SheetHeader>

          <div
            className="flex flex-col gap-1 px-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            {visibleCreateItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setCreateSheetOpen(false);
                    openCreateDrawer(item.drawerKey, item.href, active);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 w-full text-left",
                    "transition-colors duration-150",
                    "text-foreground hover:bg-accent/50"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <item.Icon weight="BoldDuotone" className="h-5 w-5 text-foreground" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-none">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground truncate">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Profile sheet — user card + Profile link + Logout */}
      <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="rounded-t-2xl px-0 pb-0"
        >
          <SheetHeader className="px-5 pb-3">
            <SheetTitle className="sr-only">Profil</SheetTitle>
            <div className="flex items-center gap-3 pt-1">
              <Avatar className="h-11 w-11">
                <AvatarImage src={userImage} />
                <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">{userRole}</p>
              </div>
            </div>
          </SheetHeader>

          <div
            className="flex flex-col gap-1 px-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => {
                setProfileSheetOpen(false);
                router.push("/dashboard/profile");
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 w-full text-left",
                "transition-colors duration-150 text-foreground hover:bg-accent/50"
              )}
            >
              <User weight="BoldDuotone" className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-medium">Profile</span>
            </button>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 w-full text-left",
                "transition-colors duration-150 text-destructive hover:bg-destructive/10"
              )}
            >
              <Logout weight="BoldDuotone" className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Keluar</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
