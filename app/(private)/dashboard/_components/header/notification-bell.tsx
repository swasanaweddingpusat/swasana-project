"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck, CalendarPlus, CalendarCheck, CalendarX, AlertTriangle, ArrowLeftRight, FileSignature, Eye, UserPlus, Store, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useRouter } from "next/navigation";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  booking_created: CalendarPlus,
  booking_approved: CalendarCheck,
  booking_rejected: CalendarX,
  booking_lost: AlertTriangle,
  booking_transferred: ArrowLeftRight,
  agreement_signed: FileSignature,
  agreement_viewed: Eye,
  user_invited: UserPlus,
  vendor_updated: Store,
  catering_updated: UtensilsCrossed,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data } = useNotifications();
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
    router.push("/dashboard/bookings");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className="relative cursor-pointer" onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifikasi</p>
            {unreadCount > 0 && (
              <button type="button" onClick={() => markAll.mutate()} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                <CheckCheck className="h-3.5 w-3.5" /> Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Belum ada notifikasi</p>
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                return (
                  <button key={n.id} type="button" onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3 ${!n.isRead ? "bg-blue-50/50" : ""}`}>
                    <div className="shrink-0 mt-0.5 h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${!n.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}>{n.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: localeId })}
                      </p>
                    </div>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
                  </button>
                );
              })
            )}
          </div>

          {/* View all */}
          {notifications.length > 0 && (
            <button type="button" onClick={() => { router.push("/dashboard/notifications"); setOpen(false); }}
              className="w-full text-center py-2.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-t border-gray-100 cursor-pointer transition-colors">
              Lihat Semua Notifikasi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
