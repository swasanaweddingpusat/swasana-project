"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "User Management", href: "/dashboard/settings/user-management" },
  { label: "Role & Permission", href: "/dashboard/settings/roles" },
  { label: "PDF Configuration", href: "/dashboard/settings/pdf-config" },
  { label: "Profile", href: "/dashboard/settings/profile" },
  { label: "Account", href: "/dashboard/settings/account" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith(item.href)
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
