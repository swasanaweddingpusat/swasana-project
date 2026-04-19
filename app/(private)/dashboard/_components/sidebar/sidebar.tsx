"use client";

import { useState } from "react";
import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./sidebar-config";
import { NavItemRow } from "./nav-item";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "bg-white border-r border-gray-200 flex flex-col h-screen transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b border-gray-200 h-14 shrink-0",
          collapsed ? "justify-center px-2" : "px-4 gap-2"
        )}
      >
        <Image
          src="/swasana-logo.png"
          alt="Swasana"
          width={32}
          height={32}
          className="object-contain shrink-0"
        />
        {!collapsed && (
          <span className="font-bold text-sm text-gray-900 truncate">
            Swasana Wedding
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavItemRow key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-200 shrink-0 px-2 py-2 flex justify-end">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
