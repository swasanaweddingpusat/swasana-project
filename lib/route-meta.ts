export interface RouteMeta {
  title: string;
  subtitle?: string;
  parent?: string; // href of parent route for breadcrumb chain
}

export const ROUTE_META: Record<string, RouteMeta> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Overview sistem",
  },

  "/dashboard/profile": {
    title: "Profile",
    subtitle: "Kelola informasi pribadi dan keamanan akun Anda.",
  },

  // ─── Settings hub ────────────────────────────────────────────────────────
  "/dashboard/settings": {
    title: "Settings",
    subtitle: "Kelola pengaturan sistem",
  },
  "/dashboard/settings/users": {
    title: "Users",
    subtitle: "Kelola data user, undangan, dan akses",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/roles": {
    title: "Roles",
    subtitle: "Kelola role dan permission",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/venues": {
    title: "Venue Management",
    subtitle: "Kelola daftar venue dan alamat",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/brands": {
    title: "Brand",
    subtitle: "Kelola brand dan pemetaannya ke venue",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/payment-methods": {
    title: "Payment Methods",
    subtitle: "Atur metode pembayaran dan rekening",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/source-of-information": {
    title: "Source of Information",
    subtitle: "Sumber informasi customer untuk tracking lead",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/lead-status": {
    title: "Lead Status",
    subtitle: "Kelola status pipeline lead",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/education-level": {
    title: "Tingkat Pendidikan",
    subtitle: "Kelola daftar tingkat pendidikan karyawan",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/order-status": {
    title: "Order Status",
    subtitle: "Kelola status order vendor",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/event-types": {
    title: "Event Types",
    subtitle: "Kelola tipe acara untuk nomor PO",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/user-management": {
    title: "User Management",
    subtitle: "Kelola akses dan undangan user",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/approval-flow": {
    title: "Approval Flow",
    subtitle: "Konfigurasi step dan role approver per modul",
    parent: "/dashboard/settings",
  },

  // ─── Packages ──────────────────────────────────────────────────────────────
  "/dashboard/packages": {
    title: "Packages",
    subtitle: "Kelola paket wedding",
  },

  // ─── Complimentary ─────────────────────────────────────────────────────────
  "/dashboard/complimentary": {
    title: "Complimentary",
    subtitle: "Kelola master item complimentary untuk booking",
  },

  // ─── Vendors ───────────────────────────────────────────────────────────────
  "/dashboard/vendors": {
    title: "Vendors",
    subtitle: "Kelola vendor dan supplier",
  },

  // ─── Bookings ───────────────────────────────────────────────────────────────
  "/dashboard/booking-weddings": {
    title: "Booking Weddings",
    subtitle: "Kelola data booking weddings",
  },
  "/dashboard/booking-mice": {
    title: "Booking MICE",
    subtitle: "Kelola data booking MICE",
  },
  // ─── Finance ────────────────────────────────────────────────────────────────
  "/dashboard/finance": {
    title: "Finance",
    subtitle: "Overview keuangan",
  },
  "/dashboard/finance/accounts-receivable": {
    title: "Accounts Receivable",
    subtitle: "Kelola piutang dan pembayaran masuk",
    parent: "/dashboard/finance",
  },
  "/dashboard/finance/accounts-receivable/termin": {
    title: "Termin",
    subtitle: "Status termin pembayaran per booking",
    parent: "/dashboard/finance/accounts-receivable",
  },
  "/dashboard/finance/accounts-receivable/aging": {
    title: "Aging",
    subtitle: "Umur piutang per booking",
    parent: "/dashboard/finance/accounts-receivable",
  },
  "/dashboard/finance/accounts-receivable/client": {
    title: "Client",
    subtitle: "Piutang per client",
    parent: "/dashboard/finance/accounts-receivable",
  },
  "/dashboard/finance/accounts-payable": {
    title: "Accounts Payable",
    subtitle: "Kelola hutang dan pembayaran keluar",
    parent: "/dashboard/finance",
  },
  "/dashboard/finance/accounts-payable/rekening-vendor": {
    title: "Rekening Vendor",
    subtitle: "Daftar rekening pembayaran vendor",
    parent: "/dashboard/finance/accounts-payable",
  },
  "/dashboard/finance/accounts-payable/rekening-venue": {
    title: "Rekening Venue",
    subtitle: "Daftar rekening pembayaran venue",
    parent: "/dashboard/finance/accounts-payable",
  },
  "/dashboard/discount-promo": {
    title: "Discount / Promo",
    subtitle: "Program promo & discount aktif",
  },

  // ─── Notifications ─────────────────────────────────────────────────────────
  "/dashboard/notifications": {
    title: "Notifikasi",
    subtitle: "Semua notifikasi",
  },

  // ─── Leads ─────────────────────────────────────────────────────────────────
  "/dashboard/leads": {
    title: "Leads",
    subtitle: "Kelola data lead dan pipeline penjualan",
  },

  // ─── Quotations ───────────────────────────────────────────────────────────
  "/dashboard/quotations": {
    title: "Quotations",
    subtitle: "Kelola penawaran harga untuk lead",
  },

  // ─── Customers ─────────────────────────────────────────────────────────────
  "/dashboard/settings/customer": {
    title: "Customers",
    subtitle: "Kelola data customer",
    parent: "/dashboard/settings",
  },

  // ─── Calendar Events ──────────────────────────────────────────────────────
  "/dashboard/calendar-events": {
    title: "Calendar Events",
    subtitle: "Lihat jadwal event di kalender",
  },
  "/dashboard/groups": {
    title: "Groups",
    subtitle: "Kelola tim dan pantau kinerja penjualan",
  },
  "/dashboard/groups/[groupId]": {
    title: "Detail Group",
    subtitle: "Kinerja dan target penjualan tim",
    parent: "/dashboard/groups",
  },
  "/dashboard/purchase-order": {
    title: "Purchase Order",
    subtitle: "Kelola purchase order vendor per booking",
  },

  // ─── Pengadaan Barang ──────────────────────────────────────────────────────
  "/dashboard/pengadaan-barang": {
    title: "Pengadaan Barang",
    subtitle: "Kelola pengajuan pengadaan dan pembelian barang",
  },

  // ─── HR & Payroll ──────────────────────────────────────────────────────────
  "/dashboard/hr": {
    title: "HR & Payroll",
    subtitle: "Kelola SDM, penggajian, dan administrasi karyawan",
  },
  "/dashboard/hr/database-karyawan": {
    title: "Database Karyawan",
    subtitle: "Data lengkap seluruh karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/database-karyawan/[id]": {
    title: "Detail Karyawan",
    subtitle: "Informasi lengkap karyawan",
    parent: "/dashboard/hr/database-karyawan",
  },
  "/dashboard/hr/manajemen-kehadiran": {
    title: "Manajemen Kehadiran",
    subtitle: "Monitoring kehadiran real-time",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/absensi": {
    title: "Absensi",
    subtitle: "Catat kehadiran dengan foto dan lokasi",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/sistem-cuti": {
    title: "Sistem Cuti",
    subtitle: "Pengajuan dan saldo cuti karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/penggajian-perpajakan": {
    title: "Penggajian & Perpajakan",
    subtitle: "Proses penggajian dan konfigurasi pajak",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/slip-gaji": {
    title: "Slip Gaji",
    subtitle: "Lihat dan unduh slip gaji",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/rekrutmen-onboarding": {
    title: "Rekrutmen & Onboarding",
    subtitle: "Pipeline rekrutmen hingga onboarding",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/pengembangan-sdm": {
    title: "Pengembangan SDM",
    subtitle: "Pelatihan, pengembangan, dan sertifikasi",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/manajemen-kinerja": {
    title: "Manajemen Kinerja",
    subtitle: "Review kinerja dan KPI karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/manajemen-kesehatan": {
    title: "Manajemen Kesehatan",
    subtitle: "Rekam medis dan asuransi karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/reimbursement-loan": {
    title: "Reimbursement & Loan",
    subtitle: "Klaim biaya dan pinjaman karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/hubungan-industrial": {
    title: "Hubungan Industrial",
    subtitle: "SP tracking dan pengaduan karyawan",
    parent: "/dashboard/hr",
  },
  "/dashboard/hr/analitik-laporan": {
    title: "Analitik & Laporan",
    subtitle: "Dashboard metrik HR dan laporan",
    parent: "/dashboard/hr",
  },

  // ─── Maintenance ───────────────────────────────────────────────────────────
  "/dashboard/maintenance": {
    title: "Maintenance",
    subtitle: "Kelola ticket dan jadwal pemeliharaan",
  },
  "/dashboard/settings/maintenance-category": {
    title: "Maintenance Category",
    subtitle: "Kelola kategori maintenance",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/maintenance-priority": {
    title: "Maintenance Priority",
    subtitle: "Kelola prioritas maintenance",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/maintenance-status": {
    title: "Maintenance Status",
    subtitle: "Kelola status maintenance",
    parent: "/dashboard/settings",
  },

  // ─── Tutorial ─────────────────────────────────────────────────────────────
  "/dashboard/tutorial": {
    title: "Tutorial",
    subtitle: "Panduan penggunaan aplikasi",
  },

};

export interface Breadcrumb {
  href: string;
  title: string;
}

/**
 * Resolve a runtime pathname (e.g. /dashboard/groups/abc-123) to its
 * ROUTE_META entry by matching dynamic segments ([param]).
 *
 * Returns { template, meta } where `template` is the matched key, or
 * undefined if no match found.
 */
export function resolveRouteMeta(
  pathname: string,
): { template: string; meta: RouteMeta } | undefined {
  // 1. Exact match first (most common path, no regex overhead)
  const exact = ROUTE_META[pathname];
  if (exact) return { template: pathname, meta: exact };

  // 2. Pattern match — convert template keys with [param] to regex
  for (const template of Object.keys(ROUTE_META)) {
    if (!template.includes("[")) continue;
    // Replace each [xxx] segment with a non-empty, non-slash capture
    const pattern = template.replace(/\[[^\]]+\]/g, "[^/]+");
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(pathname)) {
      return { template, meta: ROUTE_META[template] };
    }
  }

  return undefined;
}

export function getBreadcrumbs(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [];
  let current: string | undefined = pathname;

  while (current) {
    const resolved = resolveRouteMeta(current);
    if (!resolved) break;
    crumbs.unshift({ href: current, title: resolved.meta.title });
    current = resolved.meta.parent;
  }

  return crumbs;
}
