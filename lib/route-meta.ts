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

  // ─── Settings hub ────────────────────────────────────────────────────────
  "/dashboard/settings": {
    title: "Settings",
    subtitle: "Kelola pengaturan sistem",
  },
  "/dashboard/settings/users": {
    title: "Users",
    subtitle: "Kelola data user dan undangan",
    parent: "/dashboard/settings",
  },
  "/dashboard/settings/groups": {
    title: "Groups",
    subtitle: "Kelola grup data untuk scope akses",
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
};

export interface Breadcrumb {
  href: string;
  title: string;
}

export function getBreadcrumbs(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [];
  let current: string | undefined = pathname;
  while (current) {
    const meta: RouteMeta | undefined = ROUTE_META[current];
    if (!meta) break;
    crumbs.unshift({ href: current, title: meta.title });
    current = meta.parent;
  }
  return crumbs;
}
