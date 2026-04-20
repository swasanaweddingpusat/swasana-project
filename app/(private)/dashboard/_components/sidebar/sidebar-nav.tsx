"use client";

import Image from "next/image";
import { navItems } from "./sidebar-config";
import { NavItemRow } from "./nav-item";

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  return (
    <>
      {/* Logo */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-200 h-16 flex items-center px-5">
        {collapsed ? (
          <div className="w-full flex justify-center">
            <Image
              src="/logo-sgp.svg"
              alt="SGP"
              width={100}
              height={100}
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>
        ) : (
          <Image
            src="/logo-swasana.svg"
            alt="Swasana Wedding"
            width={100}
            height={100}
            style={{ width: "90%", height: "auto" }}
            priority
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden" onClick={onNavigate}>
        {navItems.map((item) => (
          <NavItemRow key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </>
  );
}
