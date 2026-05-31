import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  type IconProps,
  Widget,
  UsersGroupRounded,
  Ticket,
  CalendarDate,
  Wallet,
  PieChart,
  CardReceive,
  CardSend,
  Buildings2,
  Buildings,
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
  UserRounded,
  Settings,
  Volume,
  Bill,
  DocumentAdd,
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
  submenu?: SubMenuItem[];
  hidden?: boolean;
}

export interface NavItem {
  name: string;
  href: string;
  icon: SolarIcon;
  permission?: Permission;
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
] as const;

export const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Widget,
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
    name: "Customers",
    href: "/dashboard/customers",
    icon: UserRounded,
    permission: { module: "customers", action: "view" },
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
    name: "Calendar Events",
    href: "/dashboard/calendar-events",
    icon: CalendarDate,
    permission: { module: "booking", action: "view" },
  },
  {
    name: "Purchase Order",
    href: "/dashboard/purchase-order",
    icon: Bill,
    permission: { module: "vendor-specialist", action: "view" },
  },
  {
    name: "Groups",
    href: "/dashboard/groups",
    icon: UsersGroupRounded,
    permission: { module: "groups", action: "view" },
  },
  {
    name: "Finance",
    href: "/dashboard/finance",
    icon: Wallet,
    permission: { module: "finance-ar", action: "view" },
    submenu: [
      {
        name: "Overview",
        href: "/dashboard/finance",
        icon: PieChart,
        permission: { module: "finance-ar", action: "view" },
      },
      {
        name: "Accounts Receivable",
        href: "/dashboard/finance/accounts-receivable",
        icon: CardReceive,
        permission: { module: "finance-ar", action: "view" },
      },
      {
        name: "Accounts Payable",
        href: "/dashboard/finance/accounts-payable",
        icon: CardSend,
        permission: { module: "finance-ar", action: "view" },
        submenu: [
          {
            name: "Rekening Vendor",
            href: "/dashboard/finance/accounts-payable/rekening-vendor",
            icon: Buildings2,
            permission: { module: "finance-ar", action: "view" },
          },
          {
            name: "Rekening Venue",
            href: "/dashboard/finance/accounts-payable/rekening-venue",
            icon: Buildings,
            permission: { module: "finance-ar", action: "view" },
          },
        ],
      },
    ],
  },
  {
    name: "Package",
    href: "/dashboard/packages",
    icon: Documents,
    permission: { module: "package", action: "view" },
  },
  {
    name: "Vendor",
    href: "/dashboard/vendors",
    icon: ShopMinimalistic,
    permission: { module: "vendor", action: "view" },
  },
  {
    name: "Procurement",
    href: "/dashboard/pengadaan-barang",
    icon: CartLarge,
    permission: { module: "procurement", action: "view" },
    hidden: true,
  },
  {
    name: "HR & Payroll",
    href: "/dashboard/hr",
    icon: Accessibility,
    permission: { module: "hr", action: "view" },
    hidden: true, // TODO: sementara disembunyiin — balikin ke false/hapus buat munculin lagi
    submenu: [
      { name: "Database Karyawan", href: "/dashboard/hr/database-karyawan", icon: UsersGroupRounded, permission: { module: "hr", action: "view" } },
      { name: "Manajemen Kehadiran", href: "/dashboard/hr/manajemen-kehadiran", icon: ClockCircle, permission: { module: "hr", action: "view" } },
      { name: "Absensi", href: "/dashboard/hr/absensi", icon: CheckSquare, permission: { module: "hr", action: "view" } },
      { name: "Penggajian & Perpajakan", href: "/dashboard/hr/penggajian-perpajakan", icon: Dollar, permission: { module: "hr", action: "view" } },
      { name: "Slip Gaji", href: "/dashboard/hr/slip-gaji", icon: FileText, permission: { module: "hr", action: "view" } },
      { name: "Sistem Cuti", href: "/dashboard/hr/sistem-cuti", icon: CalendarDate, permission: { module: "hr", action: "view" } },
      { name: "Rekrutmen & Onboarding", href: "/dashboard/hr/rekrutmen-onboarding", icon: UserPlus, permission: { module: "hr", action: "view" } },
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
