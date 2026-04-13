"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Building2,
  Package,
  Wallet,
  Settings,
  UserSquare2,
  BarChart3,
  ShoppingCart,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Bookings",
    href: "/dashboard/bookings",
    icon: CalendarCheck,
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: Users,
  },
  {
    label: "Vendors",
    href: "/dashboard/vendors",
    icon: Building2,
  },
  {
    label: "Venues",
    href: "/dashboard/venues",
    icon: Building2,
  },
  {
    label: "Packages",
    href: "/dashboard/packages",
    icon: Package,
  },
  {
    label: "Finance",
    href: "/dashboard/finance",
    icon: Wallet,
  },
  {
    label: "HR",
    icon: UserSquare2,
    children: [
      { label: "Rekrutmen & Onboarding", href: "/dashboard/hr/rekrutmen-onboarding" },
      { label: "Sistem Cuti", href: "/dashboard/hr/sistem-cuti" },
      { label: "Slip Gaji", href: "/dashboard/hr/slip-gaji" },
      { label: "Kinerja Tim", href: "/dashboard/hr/kinerja-tim" },
    ],
  },
  {
    label: "Vendor Specialist",
    icon: BarChart3,
    children: [
      { label: "Indikator Pernikahan", href: "/dashboard/vendor-specialist/indikator-pernikahan" },
      { label: "Kinerja Vendor", href: "/dashboard/vendor-specialist/kinerja-vendor" },
      { label: "Evaluasi Vendor", href: "/dashboard/vendor-specialist/evaluasi-vendor" },
      { label: "Pemeliharaan Venue", href: "/dashboard/vendor-specialist/pemeliharaan-venue" },
    ],
  },
  {
    label: "Pengadaan Barang",
    href: "/dashboard/pengadaan-barang",
    icon: ShoppingCart,
  },
  {
    label: "Settings",
    icon: Settings,
    children: [
      { label: "User Management", href: "/dashboard/settings/user-management" },
      { label: "Roles", href: "/dashboard/settings/roles" },
      { label: "Group Management", href: "/dashboard/settings/group-management" },
      { label: "Brands", href: "/dashboard/settings/brands" },
      { label: "Venues", href: "/dashboard/settings/venues" },
      { label: "Payment Methods", href: "/dashboard/settings/payment-methods" },
    ],
  },
];

function NavGroup({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.children?.some((c) => pathname.startsWith(c.href));
  const [open, setOpen] = useState(isActive ?? false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-1 ml-7 space-y-1">
          {item.children?.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "block px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname === child.href || pathname.startsWith(child.href + "/")
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">Swasana Wedding</h2>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            return <NavGroup key={item.label} item={item} />;
          }
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href! + "/")
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
