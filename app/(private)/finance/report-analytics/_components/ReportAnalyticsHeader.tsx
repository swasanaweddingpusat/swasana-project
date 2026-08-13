"use client";

import { Calendar, Filter } from "@solar-icons/react";
import { Button } from "@/components/ui/button";

export function ReportAnalyticsHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Report & Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pantau performa bisnis Swasana secara real-time
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-foreground shadow-sm">
          <Calendar weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          <span>03 – 09 Agustus 2026</span>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Filter weight="BoldDuotone" className="h-4 w-4" />
          Filter
        </Button>
      </div>
    </div>
  );
}
