"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeaveBalances } from "@/hooks/use-leave-balances";
import { getAvailableBalance } from "@/lib/leave-helpers";
import { CalendarMinimalistic } from "@solar-icons/react";

const CURRENT_YEAR = new Date().getFullYear();

function buildYearOptions(): number[] {
  return [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
}

export function LeaveBalanceCards() {
  const { data: session } = useSession();
  const [year, setYear] = useState(CURRENT_YEAR);

  const profileId = session?.user?.profileId;

  const { data: balances, isLoading } = useLeaveBalances(
    profileId ? { profileId, year } : undefined
  );

  const yearOptions = buildYearOptions();

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg">Saldo Cuti</CardTitle>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-full sm:w-28 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && (!balances || balances.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarMinimalistic
              weight="BoldDuotone"
              className="h-10 w-10 text-muted-foreground/40"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Belum ada saldo cuti untuk tahun {year}
            </p>
          </div>
        )}

        {!isLoading && balances && balances.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((balance) => {
              const available = getAvailableBalance(balance);
              const total =
                balance.totalDays +
                balance.carryOverDays +
                balance.adjustmentDays;
              const usedPercent = total > 0
                ? Math.min(Math.round((balance.usedDays / total) * 100), 100)
                : 0;

              return (
                <Card
                  key={balance.id}
                  className="rounded-xl border shadow-sm p-4"
                >
                  <p className="font-heading text-sm font-semibold">
                    {balance.leaveType.name}
                  </p>

                  <div className="mt-3">
                    <Progress value={usedPercent} className="h-2" />
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Terpakai: {balance.usedDays} hari</span>
                      <span>Total: {total} hari</span>
                    </div>
                  </div>

                  <p className="mt-3 text-lg font-bold">
                    Tersedia: {available} hari
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {balance.carryOverDays > 0 && (
                      <Badge variant="secondary" className="rounded-full text-xs">
                        Carry over: {balance.carryOverDays} hari
                      </Badge>
                    )}
                    {balance.adjustmentDays !== 0 && (
                      <span className="text-xs text-muted-foreground">
                        {balance.adjustmentDays > 0 ? "+" : ""}
                        {balance.adjustmentDays} adjustment
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
