"use client";

import { useSyncExternalStore } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function UserMenu() {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { data: session } = useSession();

  if (!mounted) {
    return <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 cursor-pointer outline-none hover:bg-gray-100 transition-colors">
        <div className="hidden sm:flex flex-col items-end leading-none">
          <span className="text-xs font-semibold text-gray-800">
            {session?.user?.name ?? "—"}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5">
            {session?.user?.email ?? ""}
          </span>
        </div>
        <Avatar className="h-8 w-8">
          <AvatarImage src={session?.user?.image ?? ""} />
          <AvatarFallback className="text-xs font-medium bg-gray-200 text-gray-700">
            {getInitials(session?.user?.name)}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user?.image ?? ""} />
            <AvatarFallback className="text-xs font-medium bg-gray-200 text-gray-700">
              {getInitials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {session?.user?.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {session?.user?.email}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => (window.location.href = "/dashboard/profile")}
          className="cursor-pointer gap-2"
        >
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="text-red-600 cursor-pointer focus:text-red-600 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
