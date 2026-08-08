"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, UserPlus, CalendarAdd, Buildings, DocumentAdd, AltArrowDown, BoxMinimalistic, BellBing, Wallet2 } from "@solar-icons/react";
import { resolveRouteMeta } from "@/lib/route-meta";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "./notification-bell";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useDailyActivityDrawer } from "@/components/providers/daily-activity-drawer-provider";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { useMiceBookingDrawer } from "@/components/providers/mice-booking-drawer-provider";
import { useQuotationDrawer } from "@/components/providers/quotation-drawer-provider";
import { useProcurementDrawer } from "@/components/providers/procurement-drawer-provider";
import { usePermissions } from "@/hooks/use-permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { usePoll } from "@/hooks/use-poll";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const meta = resolveRouteMeta(pathname)?.meta;
  const { action } = useHeaderAction();
  const { openDailyActivityDrawer } = useDailyActivityDrawer();
  const { openBookingDrawer } = useBookingDrawer();
  const { openMiceBookingDrawer } = useMiceBookingDrawer();
  const { openQuotationDrawer } = useQuotationDrawer();
  const { openProcurementDrawer, openAnnouncementDrawer, openBudgetDrawer } = useProcurementDrawer();
  const { can, isLoading: permLoading } = usePermissions();
  usePoll();

  // Permissions come from a client-only fetch (/api/me/permissions), so the
  // "Tambah Baru" dropdown can only be known after hydration. Gate it behind a
  // mounted flag so the server and first client render produce identical markup
  // — otherwise the sibling order in this flex row differs (server starts with
  // the Tutorial <a>, client with the dropdown <button>) → hydration mismatch.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration flag, intentional
  useEffect(() => setMounted(true), []);

  const canCreateLead = can("daily-activity", "create");
  const canCreateWedding = can("booking", "create");
  const canCreateMice = can("booking-mice", "create");
  const canCreateQuotation = can("quotations", "create");
  const canCreateProcurement = can("procurement", "create");
  const hasAnyCreatePermission = canCreateLead || canCreateWedding || canCreateMice || canCreateQuotation || canCreateProcurement;

  return (
    <header className={cn("sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4")}>
      <div className={cn("flex items-center gap-2 min-w-0")}>
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 self-center! data-vertical:self-center" />
        {meta && (
          <div className="min-w-0">
            <h1 className={cn("text-sm font-semibold truncate text-foreground")}>
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className={cn("text-xs text-muted-foreground truncate")}>{meta.subtitle}</p>
            )}
          </div>
        )}
      </div>

      <div className={cn("flex items-center gap-2")}>
        {action}

        {mounted && !permLoading && hasAnyCreatePermission && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="cursor-pointer gap-1.5 hidden sm:inline-flex"
              >
                <span>Tambah Baru</span>
                <AltArrowDown weight="BoldDuotone" className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {canCreateLead && (
                <DropdownMenuItem
                  className="gap-3 py-2.5 cursor-pointer"
                  onClick={() => openDailyActivityDrawer()}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <UserPlus weight="BoldDuotone" className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">Tambah Lead</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Catat prospek baru</p>
                  </div>
                </DropdownMenuItem>
              )}
              {canCreateQuotation && (
                <DropdownMenuItem
                  className="gap-3 py-2.5 cursor-pointer"
                  onClick={() => openQuotationDrawer()}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <DocumentAdd weight="BoldDuotone" className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">Tambah Quotation</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Buat penawaran harga untuk klien</p>
                  </div>
                </DropdownMenuItem>
              )}
              {canCreateWedding && (
                <DropdownMenuItem
                  className="gap-3 py-2.5 cursor-pointer"
                  onClick={() => openBookingDrawer()}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CalendarAdd weight="BoldDuotone" className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">Booking Wedding</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Buat booking pernikahan</p>
                  </div>
                </DropdownMenuItem>
              )}
              {canCreateMice && (
                <DropdownMenuItem
                  className="gap-3 py-2.5 cursor-pointer"
                  onClick={() => openMiceBookingDrawer()}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Buildings weight="BoldDuotone" className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">Booking MICE</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Meeting, insentif, konferensi</p>
                  </div>
                </DropdownMenuItem>
              )}
              {canCreateProcurement && (
                <>
                  <DropdownMenuItem
                    className="gap-3 py-2.5 cursor-pointer"
                    onClick={() => openProcurementDrawer()}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <BoxMinimalistic weight="BoldDuotone" className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none">Tambah Pengajuan</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Ajukan pembelian barang baru</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-3 py-2.5 cursor-pointer"
                    onClick={() => openAnnouncementDrawer()}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <BellBing weight="BoldDuotone" className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none">Tambah Pengumuman</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Buat pengumuman untuk tim</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-3 py-2.5 cursor-pointer"
                    onClick={() => openBudgetDrawer()}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Wallet2 weight="BoldDuotone" className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none">Tambah Anggaran</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Atur anggaran venue per periode</p>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/tutorial" />}
          className={cn("cursor-pointer gap-1.5")}
        >
          <Book weight="BoldDuotone" className="h-4 w-4" />
          <span className={cn("hidden sm:inline")}>Tutorial</span>
        </Button>
        <NotificationBell />
      </div>
    </header>
  );
}
