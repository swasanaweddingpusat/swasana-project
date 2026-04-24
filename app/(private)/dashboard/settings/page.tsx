import Link from "next/link";
import { requirePagePermission } from "@/lib/require-page-permission";
import {
  UsersRound,
  Users,
  ShieldCheck,
  MapPinHouse,
  Palette,
  CreditCard,
  Info,
  ListOrdered,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

interface SettingItem {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

interface SettingGroup {
  title: string;
  description: string;
  items: SettingItem[];
}

const GROUPS: SettingGroup[] = [
  {
    title: "User",
    description: "Kelola semua user dan permission di sistem.",
    items: [
      {
        title: "Users",
        description: "Kelola data user dan undangan.",
        icon: UsersRound,
        href: "/dashboard/settings/users",
      },
      {
        title: "Groups",
        description: "Kelola grup data untuk scope akses.",
        icon: Users,
        href: "/dashboard/settings/groups",
      },
      {
        title: "Roles",
        description: "Kelola role dan permission.",
        icon: ShieldCheck,
        href: "/dashboard/settings/roles",
      },
    ],
  },
  {
    title: "Business",
    description: "Pengaturan operasional bisnis dan channel penjualan.",
    items: [
      {
        title: "Venue Management",
        description: "Kelola daftar venue dan alamat.",
        icon: MapPinHouse,
        href: "/dashboard/settings/venues",
      },
      {
        title: "Brand",
        description: "Kelola brand dan pemetaannya ke venue.",
        icon: Palette,
        href: "/dashboard/settings/brands",
      },
      {
        title: "Payment Methods",
        description: "Atur metode pembayaran dan rekening.",
        icon: CreditCard,
        href: "/dashboard/settings/payment-methods",
      },
      {
        title: "Source of Information",
        description: "Sumber informasi customer untuk tracking lead.",
        icon: Info,
        href: "/dashboard/settings/source-of-information",
      },
      {
        title: "Tingkat Pendidikan",
        description: "Kelola daftar tingkat pendidikan karyawan.",
        icon: GraduationCap,
        href: "/dashboard/settings/education-level",
      },
      {
        title: "Order Status",
        description: "Kelola status order vendor (belum diorder, sudah diajukan, dll).",
        icon: ListOrdered,
        href: "/dashboard/settings/order-status",
      },
    ],
  },
];

export default async function SettingsHubPage() {
  await requirePagePermission("settings");
  return (
    <div className="px-6 pb-6 space-y-8">
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {group.title}
            </h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start gap-3 p-4 bg-white border-b sm:border-r border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors shrink-0">
                      <Icon className="h-4 w-4 text-gray-700" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
