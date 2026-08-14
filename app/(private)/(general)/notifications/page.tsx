"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckRead, CalendarAdd, CalendarMark, Calendar, DangerTriangle, TransferHorizontal, FileText, Eye, UserPlus, Shop, ChefHat, MentionCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

const TYPE_LABEL: Record<string, string> = {
  booking_created: "Booking Baru",
  booking_approved: "Booking Disetujui",
  booking_rejected: "Booking Ditolak",
  booking_lost: "Booking Lost",
  booking_transferred: "Booking Transfer",
  agreement_signed: "Agreement Signed",
  agreement_viewed: "Agreement Viewed",
  user_invited: "User Invited",
  vendor_updated: "Vendor Updated",
  catering_updated: "Catering Updated",
  comment_mention: "Disebut di Komentar",
};

export default function NotificationsPage() {
  const router = useRouter();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const filtered = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const handleClick = (n: typeof notifications[number]) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.entityType === "booking") router.push("/booking/booking-weddings");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={cn('flex', 'flex-col', 'sm:flex-row', 'sm:items-center', 'justify-between', 'gap-3')}>
        <div className={cn('flex', 'items-center', 'gap-3')}>
          <h2 className={cn('text-lg', 'font-bold', 'text-foreground')}>Notifikasi</h2>
          {unreadCount > 0 && (
            <span className={cn('text-sm', 'text-muted-foreground', 'bg-muted', 'border', 'border-border', 'rounded-full', 'px-3', 'py-0.5')}>
              {unreadCount} belum dibaca
            </span>
          )}
        </div>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          {/* Filter tabs */}
          <div className={cn('flex', 'border', 'border-gray-200', 'rounded-lg', 'overflow-hidden')}>
            <button type="button" onClick={() => setFilter("all")}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer", filter === "all" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent")}>
              Semua
            </button>
            <button type="button" onClick={() => setFilter("unread")}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border-l border-border", filter === "unread" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent")}>
              Belum Dibaca
            </button>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} className={cn('text-xs', 'cursor-pointer')}>
              <CheckRead weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'mr-1')} /> Tandai Semua Dibaca
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-16', 'text-center')}>
              <Bell weight="BoldDuotone" className={cn('h-10', 'w-10', 'text-muted-foreground/40', 'mb-3')} />
              <p className={cn('text-sm', 'text-muted-foreground')}>{filter === "unread" ? "Semua notifikasi sudah dibaca." : "Belum ada notifikasi."}</p>
            </div>
          ) : (
            <div className={cn('divide-y', 'divide-border')}>
              {filtered.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                return (
                  <button key={n.id} type="button" onClick={() => handleClick(n)}
                    className={cn("w-full text-left px-5 py-4 hover:bg-accent transition-colors cursor-pointer flex gap-4", !n.isRead && "bg-primary/5")}>
                    <div className={cn("shrink-0 h-9 w-9 rounded-full flex items-center justify-center", !n.isRead ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <Icon weight="BoldDuotone" className={cn('h-4', 'w-4')} />
                    </div>
                    <div className={cn('flex-1', 'min-w-0')}>
                      <div className={cn('flex', 'items-center', 'gap-2')}>
                        <p className={cn("text-sm", !n.isRead ? "font-semibold text-foreground" : "text-foreground/70")}>{n.title}</p>
                        <span className={cn('text-[10px]', 'text-muted-foreground', 'bg-muted', 'rounded', 'px-1.5', 'py-0.5', 'shrink-0')}>
                          {TYPE_LABEL[n.type] ?? n.type}
                        </span>
                        {!n.isRead && <span className={cn('h-2', 'w-2', 'rounded-full', 'bg-primary', 'shrink-0')} />}
                      </div>
                      <p className={cn('text-xs', 'text-muted-foreground', 'mt-0.5', 'line-clamp-2')}>{n.message}</p>
                      <p className={cn('text-[10px]', 'text-muted-foreground/60', 'mt-1')}>
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: localeId })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
