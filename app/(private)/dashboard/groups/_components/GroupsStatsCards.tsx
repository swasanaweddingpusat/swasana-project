import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, Target, CalendarCheck } from "lucide-react";

interface Props {
  totalGroups: number;
  totalSales: number;
  avgAchievement: number;
  totalConfirmed: number;
}

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function GroupsStatsCards({ totalGroups, totalSales, avgAchievement, totalConfirmed }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { icon: Users, label: "Total Groups", value: totalGroups.toString() },
        { icon: DollarSign, label: "Total Sales", value: formatRp(totalSales) },
        { icon: Target, label: "Avg Achievement", value: `${avgAchievement}%` },
        { icon: CalendarCheck, label: "Booking Confirmed", value: totalConfirmed.toString() },
      ].map(({ icon: Icon, label, value }) => (
        <Card key={label} className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-secondary shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
