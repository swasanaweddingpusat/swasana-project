import { TrendingUp, CalendarCheck, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SalesStats {
  totalBookings: number;
  totalRevenue: number;
  pendingBookings: number;
  lostBookings: number;
}

interface SalesStatCardsProps {
  stats: SalesStats;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}Jt`;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

const cards = [
  {
    key: "totalBookings" as keyof SalesStats,
    label: "Total Booking",
    icon: CalendarCheck,
    format: (v: number) => v.toString(),
  },
  {
    key: "totalRevenue" as keyof SalesStats,
    label: "Revenue Confirmed",
    icon: TrendingUp,
    format: formatCurrency,
  },
  {
    key: "pendingBookings" as keyof SalesStats,
    label: "Pending Approval",
    icon: Clock,
    format: (v: number) => v.toString(),
  },
  {
    key: "lostBookings" as keyof SalesStats,
    label: "Lost / Canceled",
    icon: XCircle,
    format: (v: number) => v.toString(),
  },
];

export function SalesStatCards({ stats }: SalesStatCardsProps) {
  return (
    <div className={cn("flex", "flex-wrap", "gap-4")}>
      {cards.map(({ key, label, icon: Icon, format }) => (
        <div
          key={key}
          className={cn("min-w-40", "flex-1", "bg-card", "border", "rounded-xl", "p-6", "flex", "flex-col", "gap-3")}
        >
          <Icon className={cn("h-5", "w-5", "text-muted-foreground")} />
          <span className={cn("text-3xl", "font-bold", "leading-none", "text-foreground")}>
            {format(stats[key])}
          </span>
          <span className={cn("text-sm", "text-muted-foreground")}>{label}</span>
        </div>
      ))}
    </div>
  );
}
