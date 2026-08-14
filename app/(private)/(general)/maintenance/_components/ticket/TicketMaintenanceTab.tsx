"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TicketDataTab } from "./TicketDataTab";
import { TicketReportTab } from "./TicketReportTab";

type SubTab = "data" | "report";

export function TicketMaintenanceTab() {
  const [subTab, setSubTab] = useState<SubTab>("data");

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-tab pills */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSubTab("data")}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            subTab === "data"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          Data
        </button>
        <button
          type="button"
          onClick={() => setSubTab("report")}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            subTab === "report"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          Report
        </button>
      </div>

      {subTab === "data" && <TicketDataTab />}
      {subTab === "report" && <TicketReportTab />}
    </div>
  );
}
