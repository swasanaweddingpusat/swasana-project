"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { User, Logout, AltArrowDown } from "@solar-icons/react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, cn } from "@/lib/utils";

export function NavUser(): React.ReactElement {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const name = session?.user?.name ?? "—";
  const email = session?.user?.email ?? "";
  const image = session?.user?.image ?? "";
  const roleName =
    session?.user?.roleName
      ?.replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="rounded-xl border border-sidebar-border bg-sidebar shadow-sm group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none">
            <CollapsibleTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className={cn(
                    "cursor-pointer",
                    "hover:bg-sidebar-accent/60",
                    "active:bg-sidebar-accent/60",
                    "data-[panel-open]:bg-sidebar-accent/60",
                  )}
                />
              }
            >
              <Avatar className="size-8 rounded-full shrink-0">
                <AvatarImage src={image} />
                <AvatarFallback className="rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-sidebar-foreground">
                  {name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {roleName || email}
                </span>
              </div>
              <AltArrowDown
                size={16}
                weight="BoldDuotone"
                className={cn(
                  "ml-auto shrink-0 text-sidebar-foreground/60 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
              <div className="border-t border-sidebar-border p-1">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/dashboard/profile" />}
                      isActive={pathname === "/dashboard/profile"}
                    >
                      <User weight="BoldDuotone" className="h-4 w-4" />
                      <span>Profil</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="cursor-pointer text-destructive hover:text-destructive [&_svg]:text-destructive!"
                      onClick={() => signOut({ callbackUrl: "/auth/login" })}
                    >
                      <Logout weight="BoldDuotone" className="h-4 w-4" />
                      <span>Keluar</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
