"use client";

import { cn } from "@/lib/utils";
import type { FinanceTabType } from "@/types/finance";

interface FinanceTabsProps {
  activeTab: FinanceTabType;
  onTabChange: (tab: FinanceTabType) => void;
}

const tabs: { key: FinanceTabType; label: string }[] = [
  { key: "receivable", label: "Accounts Receivable" },
  { key: "payable", label: "Accounts Payable" },
];

export function FinanceTabs({ activeTab, onTabChange }: FinanceTabsProps) {
  return (
    <div className="border-b border-border w-full">
      <div className="flex gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors",
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
  );
}
