"use client";

import { useState } from "react";
import { Upload, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCards } from "./_components/stat-cards";
import { FinanceTabs } from "./_components/finance-tabs";
import { RecentBookingsTable } from "./_components/recent-bookings-table";
import { WeeklyActivity } from "./_components/weekly-activity";
import { LeaderboardSales } from "./_components/leaderboard-sales";
import type { FinanceStats, FinanceBooking, ActivityItem, SalesLeader, FinanceTabType } from "@/types/finance";
import { cn } from "../../../../lib/utils";

const MOCK_STATS: FinanceStats = {
  pendingBookingProcess: 12,
  pendingPOApproval: 5,
  lateInvoiceOverdue: 3,
  bookingsNeedSignature: 8,
};

const MOCK_BOOKINGS: FinanceBooking[] = [
  { id: "1", customerName: "Budi Santoso", customerPhone: "081234567890", bookingDate: "2026-04-10", bookingStatus: "Confirmed", paymentStatus: "Paid", paymentMethod: "Transfer BCA" },
  { id: "2", customerName: "Siti Rahayu", customerPhone: "082345678901", bookingDate: "2026-04-12", bookingStatus: "Pending", paymentStatus: "Partial", paymentMethod: "Transfer BRI" },
  { id: "3", customerName: "Ahmad Fauzi", customerPhone: "083456789012", bookingDate: "2026-04-15", bookingStatus: "New", paymentStatus: "Unpaid", paymentMethod: "-" },
  { id: "4", customerName: "Dewi Lestari", customerPhone: "084567890123", bookingDate: "2026-04-18", bookingStatus: "Confirmed", paymentStatus: "Paid", paymentMethod: "Transfer Mandiri" },
  { id: "5", customerName: "Rudi Hermawan", customerPhone: "085678901234", bookingDate: "2026-04-20", bookingStatus: "Uploaded", paymentStatus: "Partial", paymentMethod: "Cash" },
];

const MOCK_ACTIVITIES: ActivityItem[] = [
  { id: "1", icon: "inquiry", title: "New Inquiry", description: "Budi Santoso mengirim inquiry untuk tanggal 10 Mei 2026" },
  { id: "2", icon: "meeting", title: "Meeting Scheduled", description: "Meeting dengan Siti Rahayu dijadwalkan 25 April 2026" },
  { id: "3", icon: "confirmation", title: "Booking Confirmed", description: "Ahmad Fauzi mengkonfirmasi booking untuk 15 Juni 2026" },
];

const MOCK_LEADERS: SalesLeader[] = [
  { id: "1", name: "Rina Marlina", totalSales: 450000000 },
  { id: "2", name: "Doni Pratama", totalSales: 380000000 },
  { id: "3", name: "Yuni Astuti", totalSales: 310000000 },
  { id: "4", name: "Hendra Wijaya", totalSales: 275000000 },
];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<FinanceTabType>("receivable");

  return (
    <div className={cn('flex', 'flex-col', 'gap-6', 'py-6', 'px-2')}>
      {/* Action Buttons */}
      <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-3')}>
        <Button size="sm">
          <Upload className={cn('h-4', 'w-4', 'mr-2')} /> Export CSV
        </Button>
        <Button variant="outline" size="sm">
          <Calendar className={cn('h-4', 'w-4', 'mr-2')} /> Apr 2026
        </Button>
        <Button variant="outline" size="sm">
          <Filter className={cn('h-4', 'w-4', 'mr-2')} /> Filter
        </Button>
      </div>

      {/* Stat Cards */}
      <StatCards stats={MOCK_STATS} loading={false} />

      {/* Finance Tabs */}
      <FinanceTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div className={cn('flex', 'flex-col', 'md:flex-row', 'gap-6')}>
        <div className={cn('grow', 'min-w-0')}>
          <RecentBookingsTable bookings={MOCK_BOOKINGS} loading={false} />
        </div>
        <div className={cn('flex', 'flex-col', 'gap-6', 'md:w-96', 'shrink-0')}>
          <WeeklyActivity activities={MOCK_ACTIVITIES} loading={false} />
          <LeaderboardSales leaders={MOCK_LEADERS} loading={false} />
        </div>
      </div>
    </div>
  );
}
