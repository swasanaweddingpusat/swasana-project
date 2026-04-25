import {
  LayoutDashboard,
  Users,
  Ticket,
  CalendarRange,
  NotebookPen,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Building2,
  Landmark,
  NotepadTextDashed,
  Bubbles,
  ShoppingCart,
  Briefcase,
  Clock,
  CheckSquare,
  DollarSign,
  FileText,
  Calendar,
  UserRoundPlus,
  TrendingUp,
  Award,
  Heart,
  CreditCard,
  Handshake,
  BarChart3,
  Wrench,
  CheckCircle,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface Permission {
  module: string;
  action: string;
}

export interface SubMenuItem {
  name: string;
  href: string;
  icon?: LucideIcon;
  permission?: Permission;
  submenu?: SubMenuItem[];
  hidden?: boolean;
}

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  submenu?: SubMenuItem[];
  hidden?: boolean;
}

export const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    permission: { module: "customers", action: "view" },
  },
  {
    name: "Booking",
    href: "/dashboard/bookings",
    icon: Ticket,
    permission: { module: "booking", action: "view" },
  },
  {
    name: "Calendar Event",
    href: "/dashboard/events/calendar-events",
    icon: CalendarRange,
    permission: { module: "booking", action: "view" },
  },
  {
    name: "Finance",
    href: "/dashboard/finance",
    icon: NotebookPen,
    permission: { module: "finance", action: "view" },
    submenu: [
      {
        name: "Accounts Receivable",
        href: "/dashboard/finance/accounts-receivable",
        icon: BanknoteArrowDown,
        permission: { module: "finance", action: "view" },
      },
      {
        name: "Accounts Payable",
        href: "/dashboard/finance/accounts-payable",
        icon: BanknoteArrowUp,
        permission: { module: "finance", action: "view" },
        submenu: [
          {
            name: "Rekening Vendor",
            href: "/dashboard/finance/accounts-payable/rekening-vendor",
            icon: Building2,
            permission: { module: "finance", action: "view" },
          },
          {
            name: "Rekening Venue",
            href: "/dashboard/finance/accounts-payable/rekening-venue",
            icon: Landmark,
            permission: { module: "finance", action: "view" },
          },
        ],
      },
    ],
  },
  {
    name: "Package",
    href: "/dashboard/packages",
    icon: NotepadTextDashed,
    permission: { module: "package", action: "view" },
  },
  {
    name: "Vendor",
    href: "/dashboard/vendors",
    icon: Bubbles,
    permission: { module: "vendor", action: "view" },
  },
  {
    name: "Procurement",
    href: "/dashboard/pengadaan-barang",
    icon: ShoppingCart,
    permission: { module: "procurement", action: "view" },
    hidden: true,
  },
  {
    name: "HR & Payroll",
    href: "/dashboard/hr",
    icon: Briefcase,
    permission: { module: "hr", action: "view" },
    submenu: [
      { name: "Database Karyawan", href: "/dashboard/hr/database-karyawan", icon: Users, permission: { module: "hr", action: "view" } },
      { name: "Manajemen Kehadiran", href: "/dashboard/hr/manajemen-kehadiran", icon: Clock, permission: { module: "hr", action: "view" } },
      { name: "Absensi", href: "/dashboard/hr/absensi", icon: CheckSquare, permission: { module: "hr", action: "view" } },
      { name: "Penggajian & Perpajakan", href: "/dashboard/hr/penggajian-perpajakan", icon: DollarSign, permission: { module: "hr", action: "view" } },
      { name: "Slip Gaji", href: "/dashboard/hr/slip-gaji", icon: FileText, permission: { module: "hr", action: "view" } },
      { name: "Sistem Cuti", href: "/dashboard/hr/sistem-cuti", icon: Calendar, permission: { module: "hr", action: "view" } },
      { name: "Rekrutmen & Onboarding", href: "/dashboard/hr/rekrutmen-onboarding", icon: UserRoundPlus, permission: { module: "hr", action: "view" } },
      { name: "Pengembangan SDM", href: "/dashboard/hr/pengembangan-sdm", icon: TrendingUp, permission: { module: "hr", action: "view" } },
      { name: "Manajemen Kinerja", href: "/dashboard/hr/manajemen-kinerja", icon: Award, permission: { module: "hr", action: "view" } },
      { name: "Manajemen Kesehatan", href: "/dashboard/hr/manajemen-kesehatan", icon: Heart, permission: { module: "hr", action: "view" } },
      { name: "Reimbursement & Loan", href: "/dashboard/hr/reimbursement-loan", icon: CreditCard, permission: { module: "hr", action: "view" } },
      { name: "Hubungan Industrial", href: "/dashboard/hr/hubungan-industrial", icon: Handshake, permission: { module: "hr", action: "view" } },
      { name: "Analitik & Laporan", href: "/dashboard/hr/analitik-laporan", icon: BarChart3, permission: { module: "hr", action: "view" } },
    ],
  },
  {
    name: "Vendor Specialist",
    href: "/dashboard/vendor-specialist/pemeliharaan-venue",
    icon: Wrench,
    permission: { module: "vendor_specialist", action: "view" },
    hidden: true,
    submenu: [
      { name: "Pemeliharaan Venue", href: "/dashboard/vendor-specialist/pemeliharaan-venue", icon: Wrench, permission: { module: "vendor_specialist", action: "view" } },
      { name: "Evaluasi Vendor", href: "/dashboard/vendor-specialist/evaluasi-vendor", icon: CheckCircle, permission: { module: "vendor_specialist", action: "view" } },
      { name: "Kinerja Vendor", href: "/dashboard/vendor-specialist/kinerja-vendor", icon: BarChart3, permission: { module: "vendor_specialist", action: "view" } },
      { name: "Analisis Kinerja Sales", href: "/dashboard/vendor-specialist/analisis-kinerja-sales", icon: TrendingUp, permission: { module: "vendor_specialist", action: "view" } },
      { name: "Indikator Pernikahan", href: "/dashboard/vendor-specialist/indikator-pernikahan", icon: Heart, permission: { module: "vendor_specialist", action: "view" } },
    ],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    permission: { module: "settings", action: "view" },
  },
];
