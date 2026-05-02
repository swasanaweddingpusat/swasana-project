import { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import { SalesStatCards } from "./_components/sales-stat-cards";
import { GroupAchievementSection } from "./_components/group-achievement-section";
import { SalesLeaderboard } from "./_components/sales-leaderboard";
import type { GroupAchievementData } from "./_components/group-achievement-section";
import type { SalesPerformanceItem } from "./_components/sales-leaderboard";

export const metadata: Metadata = { title: "Dashboard" };

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_STATS = {
  totalBookings: 48,
  totalRevenue: 2_850_000_000,
  pendingBookings: 12,
  lostBookings: 5,
};

const MOCK_GROUPS: GroupAchievementData[] = [
  {
    id: "1",
    name: "Team Alpha",
    leaderName: "Rina Marlina",
    memberCount: 4,
    revenue: 1_450_000_000,
    target: 2_000_000_000,
    confirmedBookings: 18,
  },
  {
    id: "2",
    name: "Team Beta",
    leaderName: "Doni Pratama",
    memberCount: 3,
    revenue: 980_000_000,
    target: 1_500_000_000,
    confirmedBookings: 12,
  },
  {
    id: "3",
    name: "Team Gamma",
    leaderName: "Yuni Astuti",
    memberCount: 5,
    revenue: 420_000_000,
    target: 1_000_000_000,
    confirmedBookings: 7,
  },
];

const MOCK_SALES: SalesPerformanceItem[] = [
  { profileId: "1", name: "Rina Marlina", avatarUrl: null, revenue: 620_000_000, confirmedBookings: 8, target: 700_000_000 },
  { profileId: "2", name: "Doni Pratama", avatarUrl: null, revenue: 540_000_000, confirmedBookings: 7, target: 600_000_000 },
  { profileId: "3", name: "Yuni Astuti", avatarUrl: null, revenue: 290_000_000, confirmedBookings: 4, target: 500_000_000 },
  { profileId: "4", name: "Hendra Wijaya", avatarUrl: null, revenue: 440_000_000, confirmedBookings: 6, target: 500_000_000 },
  { profileId: "5", name: "Sari Dewi", avatarUrl: null, revenue: 380_000_000, confirmedBookings: 5, target: 450_000_000 },
  { profileId: "6", name: "Budi Santoso", avatarUrl: null, revenue: 130_000_000, confirmedBookings: 2, target: 400_000_000 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div className={cn("flex", "flex-col", "gap-6", "py-6")}>
      {params.error === "forbidden" && (
        <div className={cn("flex", "items-center", "gap-3", "p-4", "bg-destructive/10", "border", "border-destructive/20", "rounded-lg", "text-destructive")}>
          <ShieldX className={cn("h-5", "w-5", "shrink-0")} />
          <div>
            <p className={cn("font-semibold", "text-sm")}>Akses Ditolak</p>
            <p className={cn("text-sm", "mt-0.5")}>Anda tidak memiliki izin untuk mengakses halaman tersebut.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className={cn("text-2xl", "font-bold", "text-foreground")}>Dashboard</h1>
        <p className={cn("text-sm", "text-muted-foreground", "mt-1")}>Overview penjualan — Mei 2026</p>
      </div>

      {/* Stat Cards */}
      <SalesStatCards stats={MOCK_STATS} />

      {/* Main Content: 2 kolom */}
      <div className={cn("grid", "grid-cols-1", "lg:grid-cols-2", "gap-6")}>
        <GroupAchievementSection groups={MOCK_GROUPS} />
        <SalesLeaderboard sales={MOCK_SALES} />
      </div>
    </div>
  );
}
