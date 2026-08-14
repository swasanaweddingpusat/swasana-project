"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TicketMaintenanceTab } from "./ticket/TicketMaintenanceTab";
import { PreventiveMaintenanceTab } from "./preventive/PreventiveMaintenanceTab";

type MainTab = "ticket" | "preventive";

const TABS: { key: MainTab; label: string }[] = [
  { key: "ticket", label: "Ticket Maintenance" },
  { key: "preventive", label: "Preventive Maintenance" },
];

export function MaintenancePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("ticket");

  return (
    <div className="flex flex-col gap-6 py-6 px-4 sm:px-2">
      {/* Level-1 Tab Bar */}
      <div className="border-b border-border w-full overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "pb-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap",
                activeTab === tab.key
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "ticket" && <TicketMaintenanceTab />}
      {activeTab === "preventive" && <PreventiveMaintenanceTab />}
    </div>
  );
}
