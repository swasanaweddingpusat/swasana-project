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
    title: "Profil",
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
  "/dashboard/settings/approval-flow": {
    title: "Approval Flow",
    subtitle: "Atur alur persetujuan",
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

  // ─── Packages ──────────────────────────────────────────────────────────────
  "/dashboard/packages": {
    title: "Packages",
    subtitle: "Kelola paket wedding",
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
  "/dashboard/customers": {
    title: "Customers",
    subtitle: "Kelola data customer",
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
