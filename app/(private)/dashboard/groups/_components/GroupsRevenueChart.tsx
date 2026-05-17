"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { GroupWithPerformance } from "@/lib/queries/groups";

const chartConfig = {
  revenue: { label: "Revenue" },
} satisfies ChartConfig;

interface Props {
  groups: GroupWithPerformance[];
}

export function GroupsRevenueChart({ groups }: Props) {
  const data = groups.map((g) => ({
    name: g.name.length > 10 ? `${g.name.slice(0, 10)}…` : g.name,
    revenue: g.revenue,
  }));

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Perbandingan Revenue per Group</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) =>
                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : v.toString()
              }
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `Rp ${Number(value).toLocaleString("id-ID")}`}
                />
              }
            />
            <Bar dataKey="revenue" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
