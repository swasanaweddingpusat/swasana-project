import { MODULE_NAV_MAP, GENERAL_NAV } from "@/app/(private)/_components/sidebar/sidebar-config";
import type { NavItem, SubMenuItem } from "@/app/(private)/_components/sidebar/sidebar-config";

export interface RouteMeta {
  title: string;
  subtitle?: string;
  parent?: string;
}

function walk(
  items: (NavItem | SubMenuItem)[],
  parentHref: string | undefined,
  acc: Record<string, RouteMeta>,
): void {
  for (const item of items) {
    // Skip pure grouping hrefs that duplicate a child (submenu parent whose
    // first child shares the href) — last write wins, which is fine.
    acc[item.href] = {
      title: item.title ?? item.name,
      subtitle: item.subtitle,
      parent: item.href === parentHref ? undefined : parentHref,
    };
    if (item.submenu?.length) {
      walk(item.submenu, item.href, acc);
    }
  }
}

function buildRouteMetaFromNavTrees(): Record<string, RouteMeta> {
  const acc: Record<string, RouteMeta> = {};
  for (const key of Object.keys(MODULE_NAV_MAP) as Array<keyof typeof MODULE_NAV_MAP>) {
    const items = MODULE_NAV_MAP[key];
    const overviewHref = `/${key}/overview`;
    for (const item of items) {
      // Top-level module items get the module overview as parent (except overview itself).
      acc[item.href] = {
        title: item.title ?? item.name,
        subtitle: item.subtitle,
        parent: item.href === overviewHref ? undefined : overviewHref,
      };
      if (item.submenu?.length) walk(item.submenu, item.href, acc);
    }
  }
  walk(GENERAL_NAV, undefined, acc);
  return acc;
}

const DERIVED_ROUTE_META = buildRouteMetaFromNavTrees();

const DYNAMIC_ROUTE_META: Record<string, RouteMeta> = {
  "/": { title: "Dashboard", subtitle: "Ringkasan aktivitas" },
  "/settings": { title: "Settings", subtitle: "Kelola pengaturan sistem" },
  "/booking/groups/[groupId]": { title: "Detail Group", subtitle: "Kinerja dan target penjualan tim", parent: "/booking/groups" },
  "/hrd/database-karyawan/[id]": { title: "Detail Karyawan", subtitle: "Informasi lengkap karyawan", parent: "/hrd/database-karyawan" },
  "/wedding-indicators/create": { title: "Buat Kuesioner Pernikahan", subtitle: "Isi form untuk membuat kuesioner penilaian kepuasan", parent: "/wedding-indicators" },
  "/wedding-indicators/[id]": { title: "Detail Kuesioner Pernikahan", subtitle: "Lihat dan edit detail kuesioner pernikahan", parent: "/wedding-indicators" },
  "/purchase/vendor-specialist/evaluations/create": { title: "Buat Evaluasi", subtitle: "Buat evaluasi vendor pasca event", parent: "/purchase/vendor-specialist/evaluations" },
  // Settings subtree
  "/settings/users": { title: "Users", subtitle: "Kelola data user, undangan, dan akses", parent: "/settings" },
  "/settings/roles": { title: "Roles", subtitle: "Kelola role dan permission", parent: "/settings" },
  "/settings/venues": { title: "Venue Management", subtitle: "Kelola daftar venue dan alamat", parent: "/settings" },
  "/settings/brands": { title: "Brand", subtitle: "Kelola brand dan pemetaannya ke venue", parent: "/settings" },
  "/settings/payment-methods": { title: "Payment Methods", subtitle: "Atur metode pembayaran dan rekening", parent: "/settings" },
  "/settings/source-of-information": { title: "Source of Information", subtitle: "Sumber informasi customer untuk tracking lead", parent: "/settings" },
  "/settings/lead-status": { title: "Lead Status", subtitle: "Kelola status pipeline lead", parent: "/settings" },
  "/settings/daily-activity-segment": { title: "Segment Activity", subtitle: "Kelola master segment/kategori untuk daily activity MICE", parent: "/settings" },
  "/settings/education-level": { title: "Tingkat Pendidikan", subtitle: "Kelola daftar tingkat pendidikan karyawan", parent: "/settings" },
  "/settings/order-status": { title: "Order Status", subtitle: "Kelola status order vendor", parent: "/settings" },
  "/settings/event-types": { title: "Event Types", subtitle: "Kelola tipe acara untuk nomor PO", parent: "/settings" },
  "/settings/approval-flow": { title: "Approval Flow", subtitle: "Konfigurasi step dan role approver per modul", parent: "/settings" },
  "/settings/modules": { title: "Module Registry", subtitle: "Kelola module grup sidebar dan pemetaan permission-nya", parent: "/settings" },
  "/settings/customer": { title: "Customers", subtitle: "Kelola data customer", parent: "/settings" },
  "/settings/maintenance-category": { title: "Maintenance Category", subtitle: "Kelola kategori maintenance", parent: "/settings" },
  "/settings/maintenance-priority": { title: "Maintenance Priority", subtitle: "Kelola prioritas maintenance", parent: "/settings" },
  "/settings/maintenance-status": { title: "Maintenance Status", subtitle: "Kelola status maintenance", parent: "/settings" },
  "/settings/tutorial": { title: "Tutorial CMS", subtitle: "Kelola konten tutorial aplikasi", parent: "/settings" },
  "/settings/quotation-templates": { title: "Quotation Templates", subtitle: "Kelola template quotation", parent: "/settings" },
  "/profile": { title: "Profile", subtitle: "Kelola informasi pribadi dan keamanan akun Anda.", parent: "/settings" },
  "/notifications": { title: "Notifikasi", subtitle: "Semua notifikasi" },
  "/tutorial": { title: "Tutorial", subtitle: "Panduan penggunaan aplikasi" },
  // Internal FAQ
  "/internal-faq": { title: "Internal FAQ", subtitle: "Kelola memo internal dan product knowledge" },
  "/internal-faq/memo": { title: "Memo", subtitle: "Kelola memo internal perusahaan", parent: "/internal-faq" },
  "/internal-faq/memo/[id]": { title: "Detail Memo", subtitle: "Lihat detail, diskusi, dan status pembacaan memo", parent: "/internal-faq/memo" },
  "/internal-faq/product-knowledge": { title: "Product Knowledge", subtitle: "Kelola dokumen product knowledge", parent: "/internal-faq" },
  // Announcement
  "/announcement": { title: "Announcement", subtitle: "Kumpulan pengumuman untuk seluruh karyawan" },
  "/announcement/[id]": { title: "Detail Announcement", subtitle: "Lihat detail dan diskusi pengumuman", parent: "/announcement" },
};

export const ROUTE_META: Record<string, RouteMeta> = { ...DERIVED_ROUTE_META, ...DYNAMIC_ROUTE_META };

export interface Breadcrumb {
  href: string;
  title: string;
}

/**
 * Resolve a runtime pathname (e.g. /booking/groups/abc-123) to its
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
