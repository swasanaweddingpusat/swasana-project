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
  Bolt,
  ChatRound,
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
    { name: "AR", href: "/finance/ar", icon: CardReceive, subtitle: "Status termin pembayaran per booking", permission: { module: "finance-ar", action: "view" } },
    { name: "AP", href: "/finance/ap", icon: CardSend, subtitle: "Kewajiban uang keluar — outstanding & per event", permission: { module: "finance-ap", action: "view" } },
  ],
  hrd: [
    { name: "Database Karyawan", href: "/hrd/database-karyawan", icon: UsersGroupRounded, subtitle: "Data lengkap seluruh karyawan", permission: { module: "hr", action: "view" } },
    { name: "Manajemen Kehadiran", href: "/hrd/manajemen-kehadiran", icon: ClockCircle, subtitle: "Monitoring kehadiran real-time", permission: { module: "hr", action: "view" } },
    { name: "Penggajian & Perpajakan", href: "/hrd/penggajian-perpajakan", icon: Dollar, subtitle: "Proses penggajian dan konfigurasi pajak", permission: { module: "hr", action: "view" } },
    { name: "Slip Gaji", href: "/hrd/slip-gaji", icon: FileText, subtitle: "Rekap slip gaji seluruh karyawan", permission: { module: "hr", action: "view" } },
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
  ],
};

/**
 * General items — cross-module menus that show in EVERY module world as
 * top-level sidebar entries (rendered flat, no wrapping group). Home & Settings
 * intentionally excluded: Home is retired (booking Overview is the landing),
 * Settings renders pinned to the sidebar bottom via SETTINGS_NAV_ITEM. Flat here
 * so route-meta walks each leaf with no synthetic parent (breadcrumbs stay
 * per-page).
 */
export const GENERAL_NAV: NavItem[] = [
  { name: "BITRIX24", href: "/bitrix24", icon: Bolt, subtitle: "Integrasi CRM Bitrix24", permission: { module: "bitrix", action: "view" },
    submenu: [
      { name: "Overview", href: "/bitrix24/overview", icon: PieChart, title: "Overview Bitrix24", subtitle: "Ringkasan perolehan lead & database CRM dari Bitrix24", permission: { module: "bitrix", action: "view" } },
      { name: "Transaksi", href: "/bitrix24/transaksi", icon: ClipboardList, title: "Transaksi Bitrix24", subtitle: "Data transaksi (deals) CRM dari Bitrix24", permission: { module: "bitrix", action: "view" } },
      { name: "Percakapan", href: "/bitrix24/percakapan", icon: ChatRound, title: "Percakapan Bitrix24", subtitle: "Data percakapan Contact Center (Open Lines) dari Bitrix24", permission: { module: "bitrix", action: "view" } },
      { name: "Response Sales", href: "/bitrix24/response-sales", icon: GraphUp, title: "Response Sales Bitrix24", subtitle: "Rata-rata waktu respons sales per percakapan", permission: { module: "bitrix", action: "view" } },
    ] },
  { name: "Indikator Pernikahan", href: "/wedding-indicators", icon: Heart, subtitle: "Kelola kuesioner penilaian kepuasan pasangan pernikahan", permission: { module: "vendor-specialist", action: "view" } },
  { name: "Absensi", href: "/absensi", icon: CheckSquare, subtitle: "Catat kehadiran dengan foto dan lokasi", permission: { module: "hr", action: "view" } },
  { name: "Maintenance", href: "/maintenance", icon: Sledgehammer, subtitle: "Kelola ticket dan jadwal pemeliharaan", permission: { module: "maintenance", action: "view" } },
  { name: "Guestbook", href: "/guestbook", icon: Notebook, subtitle: "Catat kunjungan tamu, vendor, dan client ke kantor", permission: { module: "guestbook", action: "view" } },
  { name: "Vendor", href: "/vendor", icon: ShopMinimalistic, subtitle: "Kelola vendor dan supplier", permission: { module: "vendor", action: "view" } },
  { name: "Procurement", href: "/procurement", icon: CartLarge, subtitle: "Kelola pengajuan pengadaan dan pembelian barang",
    anyPermission: [
      { module: "procurement", action: "view" },
      { module: "procurement-summary", action: "view" },
      { module: "procurement-announcement", action: "view" },
      { module: "procurement-budget", action: "view" },
    ],
    submenu: [
      { name: "Pengadaan", href: "/procurement", icon: BillList, permission: { module: "procurement", action: "view" } },
      { name: "Ringkasan", href: "/procurement/ringkasan", icon: ChartSquare, permission: { module: "procurement-summary", action: "view" } },
      { name: "Pengumuman", href: "/procurement/pengumuman", icon: BellBing, permission: { module: "procurement-announcement", action: "view" } },
      { name: "Anggaran Venue", href: "/procurement/anggaran-venue", icon: Wallet2, permission: { module: "procurement-budget", action: "view" } },
    ] },
  { name: "Pengajuan Cuti", href: "/cuti", icon: CalendarDate, subtitle: "Pengajuan dan saldo cuti" },
  { name: "Slip Gaji", href: "/slip-gaji", icon: FileText, subtitle: "Lihat slip gaji bulanan saya" },
];

/** Settings entry — pinned to the very bottom of the sidebar, always visible
 *  to anyone with access to at least one SETTINGS_MODULES (gated in SidebarNav). */
export const SETTINGS_NAV_ITEM: NavItem = {
  name: "Settings",
  href: "/settings",
  icon: Settings,
  subtitle: "Kelola pengaturan sistem",
};
