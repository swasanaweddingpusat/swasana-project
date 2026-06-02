"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckRead, CalendarAdd, CalendarMark, Calendar, DangerTriangle, TransferHorizontal, FileText, Eye, UserPlus, Shop, ChefHat, Refresh, MentionCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { cn } from "../../../../../lib/utils";

const TYPE_ICON: Record<string, typeof Bell> = {
  booking_created: CalendarAdd,
  booking_approved: CalendarMark,
  booking_rejected: Calendar,
  booking_lost: DangerTriangle,
  booking_transferred: TransferHorizontal,
  agreement_signed: FileText,
  agreement_viewed: Eye,
  user_invited: UserPlus,
  vendor_updated: Shop,
  catering_updated: ChefHat,
  comment_mention: MentionCircle,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data, refetch, isFetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = (n: typeof notifications[number]) => {
    if (!n.isRead) markRead.mutate(n.id);
    router.push("/dashboard/booking-weddings");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className={cn('relative', 'cursor-pointer', 'bg-primary', 'text-primary-foreground', 'hover:bg-primary/90', 'hover:text-primary-foreground')} onClick={() => setOpen(!open)}>
        <Bell weight="BoldDuotone" className={cn('h-5', 'w-5', 'text-primary-foreground')} />
        {unreadCount > 0 && (
          <span className={cn('absolute', '-top-0.5', '-right-0.5', 'h-4', 'min-w-4', 'px-1', 'flex', 'items-center', 'justify-center', 'rounded-full', 'bg-destructive', 'text-destructive-foreground', 'text-[10px]', 'font-bold')}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className={cn('absolute', 'right-0', 'top-full', 'mt-2', 'w-80', 'sm:w-96', 'bg-popover', 'border', 'border-border', 'rounded-xl', 'shadow-lg', 'z-50', 'overflow-hidden')}>
          <div className={cn('flex', 'items-center', 'justify-between', 'px-4', 'py-3', 'border-b', 'border-border')}>
            <p className={cn('text-sm', 'font-semibold', 'text-foreground')}>Notifikasi</p>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <button type="button" onClick={() => refetch()} className={cn('p-1', 'rounded-md', 'hover:bg-accent', 'cursor-pointer', 'transition-colors')} title="Refresh">
                <Refresh weight="BoldDuotone" className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
              </button>
              {unreadCount > 0 && (
                <button type="button" onClick={() => markAll.mutate()} className={cn('text-xs', 'text-primary', 'hover:text-primary/80', 'flex', 'items-center', 'gap-1', 'cursor-pointer')}>
                  <CheckRead weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} /> Tandai semua dibaca
                </button>
              )}
            </div>
          </div>

          <div className={cn('max-h-80', 'overflow-y-auto')}>
            {notifications.length === 0 ? (
              <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-10', 'text-center')}>
                <Bell weight="BoldDuotone" className={cn('h-8', 'w-8', 'text-muted-foreground/40', 'mb-2')} />
                <p className={cn('text-sm', 'text-muted-foreground')}>Belum ada notifikasi</p>
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                return (
                  <button key={n.id} type="button" onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-border hover:bg-accent transition-colors cursor-pointer flex gap-3 ${!n.isRead ? "bg-primary/5" : ""}`}>
                    <div className={cn('shrink-0', 'mt-0.5', 'h-7', 'w-7', 'rounded-full', 'bg-muted', 'flex', 'items-center', 'justify-center')}>
                      <Icon weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'text-muted-foreground')} />
                    </div>
                    <div className={cn('flex-1', 'min-w-0')}>
                      <p className={`text-sm truncate ${!n.isRead ? "font-semibold text-foreground" : "text-foreground/70"}`}>{n.title}</p>
                      <p className={cn('text-xs', 'text-muted-foreground', 'line-clamp-2', 'mt-0.5')}>{n.message}</p>
                      <p className={cn('text-[10px]', 'text-muted-foreground/60', 'mt-1')}>
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: localeId })}
                      </p>
                    </div>
                    {!n.isRead && <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-primary', 'shrink-0', 'mt-2')} />}
                  </button>
                );
              })
            )}
          </div>

          {/* View all */}
          {notifications.length > 0 && (
            <button type="button" onClick={() => { router.push("/dashboard/notifications"); setOpen(false); }}
              className={cn('w-full', 'text-center', 'py-2.5', 'text-xs', 'font-medium', 'text-muted-foreground', 'hover:text-foreground', 'hover:bg-accent', 'border-t', 'border-border', 'cursor-pointer', 'transition-colors')}>
              Lihat Semua Notifikasi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
