import {
  ChartColumnIncreasing,
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
  type LucideIcon,
} from "lucide-react";

export interface SubMenuItem {
  name: string;
  href: string;
  icon?: LucideIcon;
  submenu?: SubMenuItem[];
}

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  submenu?: SubMenuItem[];
}

export const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: ChartColumnIncreasing,
  },
  {
    name: "Customers",
    href: "/dashboard/customers",
    icon: Users,
  },
  {
    name: "Booking",
    href: "/dashboard/bookings",
    icon: Ticket,
  },
  {
    name: "Calendar Event",
    href: "/dashboard/events/calendar-events",
    icon: CalendarRange,
  },
  {
    name: "Finance",
    href: "/dashboard/finance",
    icon: NotebookPen,
    submenu: [
      {
        name: "Accounts Receivable",
        href: "/dashboard/finance/accounts-receivable",
        icon: BanknoteArrowDown,
      },
      {
        name: "Accounts Payable",
        href: "/dashboard/finance/accounts-payable",
        icon: BanknoteArrowUp,
        submenu: [
          {
            name: "Rekening Vendor",
            href: "/dashboard/finance/accounts-payable/rekening-vendor",
            icon: Building2,
          },
          {
            name: "Rekening Venue",
            href: "/dashboard/finance/accounts-payable/rekening-venue",
            icon: Landmark,
          },
        ],
      },
    ],
  },
  {
    name: "Package",
    href: "/dashboard/packages",
    icon: NotepadTextDashed,
  },
  {
    name: "Vendor",
    href: "/dashboard/vendors",
    icon: Bubbles,
  },
  {
    name: "Procurement",
    href: "/dashboard/pengadaan-barang",
    icon: ShoppingCart,
  },
  {
    name: "HR & Payroll",
    href: "/dashboard/hr",
    icon: Briefcase,
    submenu: [
      { name: "Database Karyawan", href: "/dashboard/hr/database-karyawan", icon: Users },
      { name: "Manajemen Kehadiran", href: "/dashboard/hr/manajemen-kehadiran", icon: Clock },
      { name: "Absensi", href: "/dashboard/hr/absensi", icon: CheckSquare },
      { name: "Penggajian & Perpajakan", href: "/dashboard/hr/penggajian-perpajakan", icon: DollarSign },
      { name: "Slip Gaji", href: "/dashboard/hr/slip-gaji", icon: FileText },
      { name: "Sistem Cuti", href: "/dashboard/hr/sistem-cuti", icon: Calendar },
      { name: "Rekrutmen & Onboarding", href: "/dashboard/hr/rekrutmen-onboarding", icon: UserRoundPlus },
      { name: "Pengembangan SDM", href: "/dashboard/hr/pengembangan-sdm", icon: TrendingUp },
      { name: "Manajemen Kinerja", href: "/dashboard/hr/manajemen-kinerja", icon: Award },
      { name: "Manajemen Kesehatan", href: "/dashboard/hr/manajemen-kesehatan", icon: Heart },
      { name: "Reimbursement & Loan", href: "/dashboard/hr/reimbursement-loan", icon: CreditCard },
      { name: "Hubungan Industrial", href: "/dashboard/hr/hubungan-industrial", icon: Handshake },
      { name: "Analitik & Laporan", href: "/dashboard/hr/analitik-laporan", icon: BarChart3 },
    ],
  },
  {
    name: "Vendor Specialist",
    href: "/dashboard/vendor-specialist/pemeliharaan-venue",
    icon: Wrench,
    submenu: [
      { name: "Pemeliharaan Venue", href: "/dashboard/vendor-specialist/pemeliharaan-venue", icon: Wrench },
      { name: "Evaluasi Vendor", href: "/dashboard/vendor-specialist/evaluasi-vendor", icon: CheckCircle },
      { name: "Kinerja Vendor", href: "/dashboard/vendor-specialist/kinerja-vendor", icon: BarChart3 },
      { name: "Analisis Kinerja Sales", href: "/dashboard/vendor-specialist/analisis-kinerja-sales", icon: TrendingUp },
      { name: "Indikator Pernikahan", href: "/dashboard/vendor-specialist/indikator-pernikahan", icon: Heart },
    ],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];
