"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative bg-white border-r border-gray-200 flex-col h-screen transition-all duration-200 shrink-0",
        "hidden lg:flex",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <SidebarNav collapsed={collapsed} />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-7 -translate-y-1/2 -right-3.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-3.5 w-3.5 text-gray-500" />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5 text-gray-500" />
        )}
      </button>
    </aside>
  );
}
