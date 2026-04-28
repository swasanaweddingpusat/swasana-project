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
import { cn } from "../../../../../lib/utils";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function UserMenu() {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { data: session } = useSession();

  if (!mounted) {
    return <div className={cn('h-8', 'w-8', 'rounded-full', 'bg-gray-200', 'animate-pulse')} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('flex', 'items-center', 'gap-2.5', 'rounded-lg', 'px-2', 'py-1.5', 'cursor-pointer', 'outline-none', 'hover:bg-gray-100', 'transition-colors')}>
        <div className={cn('hidden', 'sm:flex', 'flex-col', 'items-end', 'leading-none')}>
          <span className={cn('text-xs', 'font-semibold', 'text-gray-800')}>
            {session?.user?.name ?? "—"}
          </span>
          <span className={cn('text-[10px]', 'text-gray-400', 'mt-0.5')}>
            {session?.user?.email ?? ""}
          </span>
        </div>
        <Avatar className={cn('h-8', 'w-8')}>
          <AvatarImage src={session?.user?.image ?? ""} />
          <AvatarFallback className={cn('text-xs', 'font-medium', 'bg-gray-200', 'text-gray-700')}>
            {getInitials(session?.user?.name)}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className={cn('h-3.5', 'w-3.5', 'text-gray-400', 'hidden', 'sm:block')} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className={cn('flex', 'items-center', 'gap-2.5', 'px-1.5', 'py-2')}>
          <Avatar className={cn('h-8', 'w-8')}>
            <AvatarImage src={session?.user?.image ?? ""} />
            <AvatarFallback className={cn('text-xs', 'font-medium', 'bg-gray-200', 'text-gray-700')}>
              {getInitials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className={cn('flex', 'flex-col', 'gap-0.5', 'min-w-0')}>
            <p className={cn('text-sm', 'font-semibold', 'text-gray-900', 'truncate')}>
              {session?.user?.name}
            </p>
            <p className={cn('text-xs', 'text-muted-foreground', 'truncate')}>
              {session?.user?.email}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => (window.location.href = "/dashboard/profile")}
          className={cn('cursor-pointer', 'gap-2')}
        >
          <User className={cn('h-4', 'w-4')} />
          Profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className={cn('text-red-600', 'cursor-pointer', 'focus:text-red-600', 'gap-2')}
        >
          <LogOut className={cn('h-4', 'w-4')} />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
