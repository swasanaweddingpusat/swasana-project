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
  "/booking/groups/[groupId]": { title: "Detail Group", subtitle: "Kinerja dan target penjualan tim", parent: "/booking/groups" },
  "/hrd/database-karyawan/[id]": { title: "Detail Karyawan", subtitle: "Informasi lengkap karyawan", parent: "/hrd/database-karyawan" },
  "/general/wedding-indicators/create": { title: "Buat Kuesioner Pernikahan", subtitle: "Isi form untuk membuat kuesioner penilaian kepuasan", parent: "/general/wedding-indicators" },
  "/general/wedding-indicators/[id]": { title: "Detail Kuesioner Pernikahan", subtitle: "Lihat dan edit detail kuesioner pernikahan", parent: "/general/wedding-indicators" },
  "/purchase/vendor-specialist/evaluations/create": { title: "Buat Evaluasi", subtitle: "Buat evaluasi vendor pasca event", parent: "/purchase/vendor-specialist/evaluations" },
  // Settings subtree (not in nav trees as individual entries) — keep the meaningful ones:
  "/general/settings/users": { title: "Users", subtitle: "Kelola data user, undangan, dan akses", parent: "/general/settings" },
  "/general/settings/roles": { title: "Roles", subtitle: "Kelola role dan permission", parent: "/general/settings" },
  "/general/settings/venues": { title: "Venue Management", subtitle: "Kelola daftar venue dan alamat", parent: "/general/settings" },
  "/general/settings/brands": { title: "Brand", subtitle: "Kelola brand dan pemetaannya ke venue", parent: "/general/settings" },
  "/general/settings/payment-methods": { title: "Payment Methods", subtitle: "Atur metode pembayaran dan rekening", parent: "/general/settings" },
  "/general/settings/source-of-information": { title: "Source of Information", subtitle: "Sumber informasi customer untuk tracking lead", parent: "/general/settings" },
  "/general/settings/lead-status": { title: "Lead Status", subtitle: "Kelola status pipeline lead", parent: "/general/settings" },
  "/general/settings/daily-activity-segment": { title: "Segment Activity", subtitle: "Kelola master segment/kategori untuk daily activity MICE", parent: "/general/settings" },
  "/general/settings/education-level": { title: "Tingkat Pendidikan", subtitle: "Kelola daftar tingkat pendidikan karyawan", parent: "/general/settings" },
  "/general/settings/order-status": { title: "Order Status", subtitle: "Kelola status order vendor", parent: "/general/settings" },
  "/general/settings/event-types": { title: "Event Types", subtitle: "Kelola tipe acara untuk nomor PO", parent: "/general/settings" },
  "/general/settings/approval-flow": { title: "Approval Flow", subtitle: "Konfigurasi step dan role approver per modul", parent: "/general/settings" },
  "/general/settings/customer": { title: "Customers", subtitle: "Kelola data customer", parent: "/general/settings" },
  "/general/settings/maintenance-category": { title: "Maintenance Category", subtitle: "Kelola kategori maintenance", parent: "/general/settings" },
  "/general/settings/maintenance-priority": { title: "Maintenance Priority", subtitle: "Kelola prioritas maintenance", parent: "/general/settings" },
  "/general/settings/maintenance-status": { title: "Maintenance Status", subtitle: "Kelola status maintenance", parent: "/general/settings" },
  "/general/settings/tutorial": { title: "Tutorial CMS", subtitle: "Kelola konten tutorial aplikasi", parent: "/general/settings" },
  "/general/settings/quotation-templates": { title: "Quotation Templates", subtitle: "Kelola template quotation", parent: "/general/settings" },
  "/general/profile": { title: "Profile", subtitle: "Kelola informasi pribadi dan keamanan akun Anda.", parent: "/general/settings" },
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
