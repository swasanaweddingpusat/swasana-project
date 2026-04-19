"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export function UserMenu() {
  const { data: session } = useSession();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full cursor-pointer outline-none">
        <div className="hidden sm:flex flex-col items-end leading-none">
          <span className="text-sm font-semibold text-gray-800">
            {session?.user?.name ?? "—"}
          </span>
          <span className="text-xs text-gray-400 mt-0.5">
            {session?.user?.email ?? ""}
          </span>
        </div>
        <Avatar className="h-9 w-9">
          <AvatarImage src={session?.user?.image ?? ""} />
          <AvatarFallback className="text-sm font-medium">
            {getInitials(session?.user?.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-gray-900">{session?.user?.name}</p>
            <p className="text-xs font-normal text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => (window.location.href = "/dashboard/profile")}
          className="cursor-pointer"
        >
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="text-red-600 cursor-pointer focus:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
