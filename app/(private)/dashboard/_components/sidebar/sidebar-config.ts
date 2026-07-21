import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  type IconProps,
  Widget,
  UsersGroupRounded,
  Ticket,
  CalendarDate,
  Wallet,
  Documents,
  ShopMinimalistic,
  CartLarge,
  Accessibility,
  ClockCircle,
  CheckSquare,
  Dollar,
  FileText,
  UserPlus,
  GraphUp,
  CupStar,
  Heart,
  Card,
  UserHands,
  GraphNew,
  TicketSale,
  Settings,
  Volume,
  Bill,
  DocumentAdd,
  Sledgehammer,
  Gift,
  TagPrice,
  ClipboardCheck,
  ChartSquare,
  PieChart,
  Notebook,
  MoneyBag,
  CardReceive,
  CardSend,
  CalendarMark,
} from "@solar-icons/react";

type SolarIcon = ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>>;

export interface Permission {
  module: string;
  action: string;
}

export interface SubMenuItem {
  name: string;
  href: string;
  icon?: SolarIcon;
  permission?: Permission;
  /** Tampil kalau punya SALAH SATU permission ini (OR). Dipakai untuk menu berbagi antar-role. */
  anyPermission?: Permission[];
  submenu?: SubMenuItem[];
  hidden?: boolean;
}

export interface NavItem {
  name: string;
  href: string;
  icon: SolarIcon;
  permission?: Permission;
  /** Tampil kalau punya SALAH SATU permission ini (OR). */
  anyPermission?: Permission[];
  submenu?: SubMenuItem[];
  hidden?: boolean;
}

export const SETTINGS_MODULES = [
  "settings-brands",
  "settings-venues",
  "settings-users",
  "settings-education-level",
  "settings-event-types",
  "settings-order-status",
  "settings-payment-methods",
  "settings-role-permission",
  "settings-source-of-information",
  "settings-lead-status",
  "settings-maintenance-category",
  "settings-maintenance-priority",
  "settings-maintenance-status",
  "settings-tutorial",
  "customers",
] as const;

export const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Widget,
  },
  {
    name: "Calendar Events",
    href: "/dashboard/calendar-events",
    icon: CalendarDate,
    permission: { module: "booking", action: "view" },
  },
  {
    name: "Groups",
    href: "/dashboard/groups",
    icon: UsersGroupRounded,
    permission: { module: "groups", action: "view" },
  },
  {
    name: "Leads",
    href: "/dashboard/leads",
    icon: Volume,
    permission: { module: "leads", action: "view" },
  },
  {
    name: "Quotations",
    href: "/dashboard/quotations",
    icon: DocumentAdd,
    permission: { module: "quotations", action: "view" },
  },
  {
    name: "Booking Weddings",
    href: "/dashboard/booking-weddings",
    icon: Ticket,
    permission: { module: "booking", action: "view" },
  },
  {
    name: "Booking MICE",
    href: "/dashboard/booking-mice",
    icon: TicketSale,
    permission: { module: "booking-mice", action: "view" },
  },
  {
    name: "Voucher / Program",
    href: "/dashboard/voucher",
    icon: TagPrice,
    permission: { module: "promo", action: "view" },
  },
  {
    name: "Purchase Order",
    href: "/dashboard/purchase-order",
    icon: Bill,
    permission: { module: "vendor-specialist", action: "view" },
    submenu: [
      {
        name: "Purchase Order",
        href: "/dashboard/purchase-order",
      },
      {
        name: "Evaluasi",
        href: "/dashboard/vendor-specialist/evaluations",
        icon: ClipboardCheck,
      },
      {
        name: "Analitik",
        href: "/dashboard/vendor-specialist/analytics",
        icon: ChartSquare,
      },
    ],
  },
  {
    name: "Indikator Pernikahan",
    href: "/dashboard/vendor-specialist/wedding-indicators",
    icon: Heart,
    permission: { module: "vendor-specialist", action: "view" },
  },
  {
    name: "Package",
    href: "/dashboard/packages",
    icon: Documents,
    permission: { module: "package", action: "view" },
  },
  {
    name: "Complimentary",
    href: "/dashboard/complimentary",
    icon: Gift,
    permission: { module: "complimentary", action: "view" },
  },
  {
    name: "Vendor",
    href: "/dashboard/vendors",
    icon: ShopMinimalistic,
    permission: { module: "vendor", action: "view" },
  },
  {
    name: "Finance",
    href: "/dashboard/finance",
    icon: Wallet,
    anyPermission: [
      { module: "finance-ar", action: "view" },
      { module: "finance-ap", action: "view" },
    ],
    submenu: [
      {
        name: "Overview",
        href: "/dashboard/finance",
        icon: PieChart,
        anyPermission: [
          { module: "finance-ar", action: "view" },
          { module: "finance-ap", action: "view" },
        ],
      },
      {
        name: "Cashflow",
        href: "/dashboard/finance/ledger",
        icon: Notebook,
        anyPermission: [
          { module: "finance-ar", action: "view" },
          { module: "finance-ap", action: "view" },
        ],
      },
      {
        name: "AR",
        href: "/dashboard/finance/accounts-receivable",
        icon: CardReceive,
        permission: { module: "finance-ar", action: "view" },
      },
      {
        name: "Expense",
        href: "/dashboard/finance/accounts-payable/expense",
        icon: MoneyBag,
        permission: { module: "finance-ap", action: "view" },
      },
      {
        name: "Accounts Payable",
        href: "/dashboard/finance/accounts-payable",
        icon: CardSend,
        permission: { module: "finance-ap", action: "view" },
        submenu: [
          { name: "Outstanding", href: "/dashboard/finance/accounts-payable/outstanding", icon: Wallet },
          { name: "Event", href: "/dashboard/finance/accounts-payable/event", icon: CalendarMark },
          { name: "Customer Payout", href: "/dashboard/finance/accounts-payable/customer", icon: CardSend },
        ],
      },
    ],
  },
  {
    name: "Maintenance",
    href: "/dashboard/maintenance",
    icon: Sledgehammer,
    permission: { module: "maintenance", action: "view" },
  },
  {
    name: "Procurement",
    href: "/dashboard/pengadaan-barang",
    icon: CartLarge,
    permission: { module: "procurement", action: "view" },
  },
  {
    name: "Absensi",
    href: "/dashboard/hr/absensi",
    icon: CheckSquare,
    permission: { module: "hr", action: "view" },
  },
  {
    name: "HR & Payroll",
    href: "/dashboard/hr",
    icon: Accessibility,
    permission: { module: "hr", action: "view" },
    hidden: false,
    submenu: [
      { name: "Database Karyawan", href: "/dashboard/hr/database-karyawan", icon: UsersGroupRounded, permission: { module: "hr", action: "view" } },
      { name: "Manajemen Kehadiran", href: "/dashboard/hr/manajemen-kehadiran", icon: ClockCircle, permission: { module: "hr", action: "view" } },
      { name: "Penggajian & Perpajakan", href: "/dashboard/hr/penggajian-perpajakan", icon: Dollar, permission: { module: "hr", action: "view" } },
      { name: "Slip Gaji", href: "/dashboard/hr/slip-gaji", icon: FileText, permission: { module: "hr", action: "view" } },
      { name: "Sistem Cuti", href: "/dashboard/hr/sistem-cuti", icon: CalendarDate, permission: { module: "hr", action: "view" } },
      { name: "Rekrutmen & Onboarding", href: "/dashboard/hr/rekrutmen-onboarding", icon: UserPlus, permission: { module: "hr-recruitment", action: "view" } },
      { name: "Pengembangan SDM", href: "/dashboard/hr/pengembangan-sdm", icon: GraphUp, permission: { module: "hr", action: "view" } },
      { name: "Manajemen Kinerja", href: "/dashboard/hr/manajemen-kinerja", icon: CupStar, permission: { module: "hr", action: "view" } },
      { name: "Manajemen Kesehatan", href: "/dashboard/hr/manajemen-kesehatan", icon: Heart, permission: { module: "hr", action: "view" } },
      { name: "Reimbursement & Loan", href: "/dashboard/hr/reimbursement-loan", icon: Card, permission: { module: "hr", action: "view" } },
      { name: "Hubungan Industrial", href: "/dashboard/hr/hubungan-industrial", icon: UserHands, permission: { module: "hr", action: "view" } },
      { name: "Analitik & Laporan", href: "/dashboard/hr/analitik-laporan", icon: GraphNew, permission: { module: "hr", action: "view" } },
    ],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    // No permission here — visibility handled in sidebar-nav via SETTINGS_MODULES
  },
];
