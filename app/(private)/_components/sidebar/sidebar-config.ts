import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  type IconProps,
  Widget,
  UsersGroupRounded,
  Ticket,
  CalendarDate,
  Documents,
  ShopMinimalistic,
  CartLarge,
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
  ClipboardList,
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
  BillList,
  BellBing,
  Wallet2,
  Case,
  Chart2,
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
  /** Header title override for route-meta derivation. Falls back to `name`. */
  title?: string;
  /** Header subtitle for route-meta derivation. */
  subtitle?: string;
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
  /** Header title override for route-meta derivation. Falls back to `name`. */
  title?: string;
  /** Header subtitle for route-meta derivation. */
  subtitle?: string;
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
  "settings-daily-activity-segment",
  "settings-maintenance-category",
  "settings-maintenance-priority",
  "settings-maintenance-status",
  "settings-tutorial",
  "customers",
] as const;

export type ModuleKey = "finance" | "hrd" | "booking" | "purchase";

export const MODULE_NAV_MAP: Record<ModuleKey, NavItem[]> = {
  finance: [
    { name: "Overview", href: "/finance/overview", icon: PieChart, subtitle: "Overview keuangan",
      anyPermission: [{ module: "finance-ar", action: "view" }, { module: "finance-ap", action: "view" }] },
    { name: "Report & Analytics", href: "/finance/report-analytics", icon: Chart2, subtitle: "Laporan dan analitik performa keuangan",
      anyPermission: [{ module: "finance-ar", action: "view" }, { module: "finance-ap", action: "view" }] },
    { name: "Income", href: "/finance/income", icon: Notebook, subtitle: "Catatan kas masuk — uang riil yang sudah diterima & diverifikasi Finance.",
      anyPermission: [{ module: "finance-ar", action: "view" }, { module: "finance-ap", action: "view" }] },
    { name: "Expense", href: "/finance/expense", icon: MoneyBag, permission: { module: "finance-ap", action: "view" } },
    { name: "AR", href: "/finance/ar", icon: CardReceive, subtitle: "Status termin pembayaran per booking", permission: { module: "finance-ar", action: "view" },
      submenu: [
        { name: "Aging", href: "/finance/ar/aging", subtitle: "Umur piutang per booking" },
        { name: "Client", href: "/finance/ar/client", subtitle: "Piutang per client" },
      ] },
    { name: "AP", href: "/finance/ap", icon: CardSend, subtitle: "Kewajiban uang keluar — outstanding & per event", permission: { module: "finance-ap", action: "view" },
      submenu: [
        { name: "Customer Payout", href: "/finance/ap/customer", subtitle: "Kewajiban uang keluar ke customer — cashback & refund overpay" },
      ] },
  ],
  hrd: [
    { name: "Overview", href: "/hrd/overview", icon: Widget, subtitle: "Ringkasan SDM dan penggajian", permission: { module: "hr", action: "view" } },
    { name: "Database Karyawan", href: "/hrd/database-karyawan", icon: UsersGroupRounded, subtitle: "Data lengkap seluruh karyawan", permission: { module: "hr", action: "view" } },
    { name: "Manajemen Kehadiran", href: "/hrd/manajemen-kehadiran", icon: ClockCircle, subtitle: "Monitoring kehadiran real-time", permission: { module: "hr", action: "view" } },
    { name: "Absensi", href: "/hrd/absensi", icon: CheckSquare, subtitle: "Catat kehadiran dengan foto dan lokasi", permission: { module: "hr", action: "view" } },
    { name: "Penggajian & Perpajakan", href: "/hrd/penggajian-perpajakan", icon: Dollar, subtitle: "Proses penggajian dan konfigurasi pajak", permission: { module: "hr", action: "view" } },
    { name: "Slip Gaji", href: "/hrd/slip-gaji", icon: FileText, subtitle: "Lihat dan unduh slip gaji", permission: { module: "hr", action: "view" } },
    { name: "Sistem Cuti", href: "/hrd/sistem-cuti", icon: CalendarDate, subtitle: "Pengajuan dan saldo cuti karyawan", permission: { module: "hr", action: "view" } },
    { name: "Rekrutmen & Onboarding", href: "/hrd/rekrutmen-onboarding", icon: UserPlus, subtitle: "Pipeline rekrutmen hingga onboarding", permission: { module: "hr-recruitment", action: "view" } },
    { name: "Pengembangan SDM", href: "/hrd/pengembangan-sdm", icon: GraphUp, subtitle: "Pelatihan, pengembangan, dan sertifikasi", permission: { module: "hr", action: "view" } },
    { name: "Manajemen Kinerja", href: "/hrd/manajemen-kinerja", icon: CupStar, subtitle: "Review kinerja dan KPI karyawan", permission: { module: "hr", action: "view" } },
    { name: "Manajemen Kesehatan", href: "/hrd/manajemen-kesehatan", icon: Heart, subtitle: "Rekam medis dan asuransi karyawan", permission: { module: "hr", action: "view" } },
    { name: "Reimbursement & Loan", href: "/hrd/reimbursement-loan", icon: Card, subtitle: "Klaim biaya dan pinjaman karyawan", permission: { module: "hr", action: "view" } },
    { name: "Hubungan Industrial", href: "/hrd/hubungan-industrial", icon: UserHands, subtitle: "SP tracking dan pengaduan karyawan", permission: { module: "hr", action: "view" } },
    { name: "Analitik & Laporan", href: "/hrd/analitik-laporan", icon: GraphNew, subtitle: "Dashboard metrik HR dan laporan", permission: { module: "hr", action: "view" } },
  ],
  booking: [
    { name: "Overview", href: "/booking/overview", icon: Widget, subtitle: "Ringkasan booking dan sales", permission: { module: "booking", action: "view" } },
    { name: "Calendar Events", href: "/booking/calendar-events", icon: CalendarDate, subtitle: "Lihat jadwal event di kalender", permission: { module: "booking", action: "view" } },
    { name: "Groups", href: "/booking/groups", icon: UsersGroupRounded, subtitle: "Kelola tim dan pantau kinerja penjualan", permission: { module: "groups", action: "view" } },
    { name: "Daily Activity", href: "/booking/daily-activity", icon: ClipboardList, subtitle: "Kelola data daily activity dan pipeline penjualan", permission: { module: "daily-activity", action: "view" } },
    { name: "Quotations", href: "/booking/quotations", icon: DocumentAdd, subtitle: "Kelola penawaran harga untuk lead", permission: { module: "quotations", action: "view" } },
    { name: "Booking MICE", href: "/booking/booking-mice", icon: TicketSale, subtitle: "Kelola data booking MICE", permission: { module: "booking-mice", action: "view" } },
    { name: "Booking Weddings", href: "/booking/booking-weddings", icon: Ticket, subtitle: "Kelola data booking weddings", permission: { module: "booking", action: "view" } },
    { name: "Wedding Package", href: "/booking/packages", icon: Documents, subtitle: "Kelola paket wedding", permission: { module: "package", action: "view" } },
    { name: "Mice Package", href: "/booking/package-mice", icon: Case, subtitle: "Kelola paket MICE per venue", permission: { module: "package-mice", action: "view" } },
    { name: "Complimentary", href: "/booking/complimentary", icon: Gift, subtitle: "Kelola master item complimentary untuk booking", permission: { module: "complimentary", action: "view" } },
    { name: "Voucher / Program", href: "/booking/voucher", icon: TagPrice, subtitle: "Program voucher & discount aktif", permission: { module: "promo", action: "view" } },
  ],
  purchase: [
    { name: "Overview", href: "/purchase/overview", icon: Widget, subtitle: "Ringkasan pengadaan dan vendor", permission: { module: "procurement", action: "view" } },
    { name: "Purchase Order", href: "/purchase/purchase-order", icon: Bill, subtitle: "Kelola purchase order vendor per booking", permission: { module: "vendor-specialist", action: "view" },
      submenu: [
        { name: "Purchase Order", href: "/purchase/purchase-order" },
        { name: "Evaluasi", href: "/purchase/vendor-specialist/evaluations", icon: ClipboardCheck, subtitle: "Lihat dan kelola evaluasi kinerja vendor" },
        { name: "Analitik", href: "/purchase/vendor-specialist/analytics", icon: ChartSquare, subtitle: "Statistik dan analisis kinerja vendor" },
      ] },
    { name: "Vendor", href: "/purchase/vendors", icon: ShopMinimalistic, subtitle: "Kelola vendor dan supplier", permission: { module: "vendor", action: "view" } },
    { name: "Procurement", href: "/purchase/pengadaan-barang", icon: CartLarge, subtitle: "Kelola pengajuan pengadaan dan pembelian barang", permission: { module: "procurement", action: "view" },
      submenu: [
        { name: "Pengadaan", href: "/purchase/pengadaan-barang", icon: BillList, permission: { module: "procurement", action: "view" } },
        { name: "Ringkasan", href: "/purchase/pengadaan-barang/ringkasan", icon: ChartSquare, permission: { module: "procurement", action: "view" } },
        { name: "Pengumuman", href: "/purchase/pengadaan-barang/pengumuman", icon: BellBing, permission: { module: "procurement", action: "view" } },
        { name: "Anggaran Venue", href: "/purchase/pengadaan-barang/anggaran-venue", icon: Wallet2, permission: { module: "procurement", action: "view" } },
      ] },
  ],
};

export const GENERAL_NAV: NavItem[] = [
  { name: "Home", href: "/", icon: Widget, subtitle: "Overview sistem" },
  { name: "Indikator Pernikahan", href: "/wedding-indicators", icon: Heart, subtitle: "Kelola kuesioner penilaian kepuasan pasangan pernikahan", permission: { module: "vendor-specialist", action: "view" } },
  { name: "Maintenance", href: "/maintenance", icon: Sledgehammer, subtitle: "Kelola ticket dan jadwal pemeliharaan", permission: { module: "maintenance", action: "view" } },
  { name: "Guestbook", href: "/guestbook", icon: Notebook, subtitle: "Catat kunjungan tamu, vendor, dan client ke kantor", permission: { module: "guestbook", action: "view" } },
  { name: "Cuti", href: "/cuti", icon: CalendarDate, subtitle: "Pengajuan dan saldo cuti" },
  { name: "Slip Gaji", href: "/slip-gaji", icon: FileText, subtitle: "Lihat slip gaji bulanan saya" },
  { name: "Notifikasi", href: "/notifications", icon: BellBing, subtitle: "Semua notifikasi" },
  { name: "Tutorial", href: "/tutorial", icon: FileText, subtitle: "Panduan penggunaan aplikasi" },
  { name: "Settings", href: "/settings", icon: Settings, subtitle: "Kelola pengaturan sistem" },
];
