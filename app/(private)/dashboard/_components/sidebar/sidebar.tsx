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
        "relative bg-white border-r border-gray-200 flex flex-col h-screen transition-all duration-200 shrink-0",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-200 h-16 flex items-center px-5">
        {collapsed ? (
          <div className="w-full flex justify-center">
            <Image
              src="/logo-sgp.svg"
              alt="SGP"
              width={100}
              height={100}
              priority
            />
          </div>
        ) : (
          <Image
            src="/logo-swasana.svg"
            alt="Swasana Wedding"
            width={120}
            height={100}
            style={{ width: "auto", height: "auto" }}
            priority
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavItemRow key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Collapse toggle — pinned to the right edge, aligned with header */}
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
