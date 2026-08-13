import Link from "next/link";
import { auth } from "@/lib/auth";
import { requirePagePermission } from "@/lib/require-page-permission";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  UsersGroupRounded,
  ShieldCheck,
  MapPoint,
  Palette,
  Card as CardIcon,
  InfoCircle,
  List,
  Diploma,
  CalendarMark,
  UserRounded,
  Route,
  Sledgehammer,
  Document,
  Book,
  Buildings2,
  type IconProps,
} from "@solar-icons/react";
import type { ComponentType } from "react";

type LucideIcon = ComponentType<IconProps>;

interface SettingItem {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  module: string;
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
        description: "Kelola data user, undangan, dan akses.",
        icon: UsersGroupRounded,
        href: "/settings/users",
        module: "settings-users",
      },
      {
        title: "Roles & Permissions",
        description: "Kelola role dan permission.",
        icon: ShieldCheck,
        href: "/settings/roles",
        module: "settings-role-permission",
      },
      {
        title: "Approval Flow",
        description: "Konfigurasi step dan role approver untuk setiap modul approval.",
        icon: Route,
        href: "/settings/approval-flow",
        module: "settings-role-permission",
      },
      {
        title: "Customers",
        description: "Kelola data customer, member status, dan riwayat booking.",
        icon: UserRounded,
        href: "/settings/customer",
        module: "customers",
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
        icon: MapPoint,
        href: "/settings/venues",
        module: "settings-venues",
      },
      {
        title: "Brand",
        description: "Kelola brand dan pemetaannya ke venue.",
        icon: Palette,
        href: "/settings/brands",
        module: "settings-brands",
      },
      {
        title: "Payment Methods",
        description: "Atur metode pembayaran dan rekening.",
        icon: CardIcon,
        href: "/settings/payment-methods",
        module: "settings-payment-methods",
      },
      {
        title: "Quotation Templates",
        description: "Template item & rekening default quotation per venue.",
        icon: Document,
        href: "/settings/quotation-templates",
        module: "settings-quotation-templates",
      },
      {
        title: "Tutorial CMS",
        description: "Atur konten tutorial aplikasi yang dapat diakses user.",
        icon: Book,
        href: "/settings/tutorial",
        module: "settings-tutorial",
      },
      {
        title: "Source of Information",
        description: "Sumber informasi customer untuk tracking lead.",
        icon: InfoCircle,
        href: "/settings/source-of-information",
        module: "settings-source-of-information",
      },
      {
        title: "Segment Activity",
        description: "Kelola master segment/kategori untuk daily activity MICE.",
        icon: Buildings2,
        href: "/settings/daily-activity-segment",
        module: "settings-daily-activity-segment",
      },
      {
        title: "Tingkat Pendidikan",
        description: "Kelola daftar tingkat pendidikan karyawan.",
        icon: Diploma,
        href: "/settings/education-level",
        module: "settings-education-level",
      },
      {
        title: "Order Status",
        description: "Kelola status order vendor (belum diorder, sudah diajukan, dll).",
        icon: List,
        href: "/settings/order-status",
        module: "settings-order-status",
      },
      {
        title: "Event Types",
        description: "Kelola tipe acara (Resepsi, Akad & Resepsi, dll) untuk nomor PO.",
        icon: CalendarMark,
        href: "/settings/event-types",
        module: "settings-event-types",
      },
    ],
  },
  {
    title: "Maintenance",
    description: "Pengaturan data master untuk modul maintenance.",
    items: [
      {
        title: "Maintenance Category",
        description: "Kelola kategori maintenance (Jaringan, Listrik, dll).",
        icon: Sledgehammer,
        href: "/settings/maintenance-category",
        module: "settings-maintenance-category",
      },
      {
        title: "Maintenance Priority",
        description: "Kelola prioritas dan estimasi deadline.",
        icon: Sledgehammer,
        href: "/settings/maintenance-priority",
        module: "settings-maintenance-priority",
      },
      {
        title: "Maintenance Status",
        description: "Kelola status ticket maintenance.",
        icon: Sledgehammer,
        href: "/settings/maintenance-status",
        module: "settings-maintenance-status",
      },
    ],
  },
];

export default async function SettingsHubPage() {
  await requirePagePermission([
    "settings-users", "settings-brands", "settings-venues",
    "settings-role-permission", "settings-payment-methods",
    "settings-source-of-information", "settings-education-level",
    "settings-event-types", "settings-order-status",
    "settings-quotation-templates", "settings-tutorial",
    "customers", "settings-role-permission",
    "settings-daily-activity-segment",
    "settings-maintenance-category",
    "settings-maintenance-priority",
    "settings-maintenance-status",
  ]);

  const session = await auth();
  const roleId = session?.user?.roleId ?? null;
  const isAdmin = await isSuperAdmin(roleId);

  // Filter items per group based on user permission
  const visibleGroups = (
    await Promise.all(
      GROUPS.map(async (group) => {
        const visibleItems = (
          await Promise.all(
            group.items.map(async (item) => {
              const allowed = isAdmin || await hasPermission(roleId, item.module, "view");
              return allowed ? item : null;
            })
          )
        ).filter((item): item is SettingItem => item !== null);
        return visibleItems.length > 0 ? { ...group, items: visibleItems } : null;
      })
    )
  ).filter((group): group is SettingGroup => group !== null);

  return (
    <div className={cn('px-6', 'pb-6', 'space-y-8')}>
      {visibleGroups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h2 className={cn('text-base', 'font-semibold', 'text-foreground')}>
              {group.title}
            </h2>
            <p className={cn('text-sm', 'text-muted-foreground')}>{group.description}</p>
          </div>
          <div className={cn('rounded-lg', 'border', 'border-border', 'bg-background', 'overflow-hidden')}>
            <div className={cn('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3')}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn('group', 'flex', 'items-start', 'gap-3', 'p-4', 'bg-background', 'border-b', 'sm:border-r', 'border-border', 'hover:bg-accent', 'transition-colors')}
                  >
                    <div className={cn('flex', 'items-center', 'justify-center', 'h-10', 'w-10', 'rounded-lg', 'bg-muted', 'group-hover:bg-muted/80', 'transition-colors', 'shrink-0')}>
                      <Icon weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-foreground/70')} />
                    </div>
                    <div className="min-w-0">
                      <h3 className={cn('text-sm', 'font-semibold', 'text-foreground')}>
                        {item.title}
                      </h3>
                      <p className={cn('text-xs', 'text-muted-foreground', 'mt-0.5', 'line-clamp-2')}>
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
