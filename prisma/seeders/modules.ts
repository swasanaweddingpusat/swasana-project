import { randomUUID } from "node:crypto";
import { prisma } from "./_client";

// ── Module registry (sidebar "worlds") — AUTHORITATIVE source of truth ────────
//
// A module "world" (Finance / HRD / Booking / Purchase) shows in the sidebar
// module-switcher for a role when that role has `view` on ANY of the module's
// mapped permission-modules (see getAccessibleModules() in lib/queries/modules.ts).
//
// A permission-module that is NOT mapped to any world here is treated as
// GENERAL: it never surfaces a world in the switcher; its menu shows as a flat
// top-level item via GENERAL_NAV in sidebar-config.ts. Examples: maintenance,
// guestbook, bitrix (Bitrix24 CRM), and — as of this seeder — procurement
// (+ its split sub-tabs procurement-summary/-announcement/-budget).
//
// This seeder is idempotent AND reconciling: it upserts every module, inserts
// any missing mapping, and DELETES any mapping in the DB that is not listed
// here. That deletion is what demotes `procurement` from the Purchase world to
// a general menu (route moved to app/(private)/(general)/procurement).
//
// To move a feature between "world" and "general", edit MODULE_REGISTRY only:
//   • world   → add its permission-module under the target module's `permissions`
//   • general → remove it from every module's `permissions` (leave it unmapped)

interface ModuleSeed {
  key: string;
  name: string;
  icon: string; // Solar icon name resolved in module-switcher's ICONS map
  sortOrder: number;
  /** permission-module strings whose `view` unlocks this world. */
  permissions: string[];
}

export const MODULE_REGISTRY: ModuleSeed[] = [
  { key: "finance", name: "Finance", icon: "Wallet", sortOrder: 10, permissions: ["finance-ar", "finance-ap"] },
  { key: "hrd", name: "HRD", icon: "UsersGroupRounded", sortOrder: 20, permissions: ["hr", "hr-recruitment"] },
  {
    key: "booking",
    name: "Booking",
    icon: "TicketSale",
    sortOrder: 30,
    permissions: [
      "booking",
      "booking-mice",
      "groups",
      "daily-activity",
      "quotations",
      "package",
      "package-mice",
      "complimentary",
      "promo",
    ],
  },
  // Purchase world: vendor-specialist only. `procurement` intentionally NOT here
  // (route: /(general)/procurement); `vendor` also moved to GENERAL (/vendor).
  { key: "purchase", name: "Purchase", icon: "CartLarge", sortOrder: 40, permissions: ["vendor-specialist"] },
];

export async function seedModules(): Promise<void> {
  for (const m of MODULE_REGISTRY) {
    // Upsert module row (stable by unique `key`).
    const mod = await prisma.module.upsert({
      where: { key: m.key },
      update: { name: m.name, icon: m.icon, sortOrder: m.sortOrder, isActive: true },
      create: { id: `mod_${m.key}`, key: m.key, name: m.name, icon: m.icon, sortOrder: m.sortOrder, isActive: true },
      select: { id: true },
    });

    const desired = new Set(m.permissions);
    const existing = await prisma.modulePermissionMap.findMany({
      where: { moduleId: mod.id },
      select: { id: true, permissionModule: true },
    });
    const existingSet = new Set(existing.map((e) => e.permissionModule));

    // Insert missing mappings.
    const toAdd = m.permissions.filter((p) => !existingSet.has(p));
    // Delete stale mappings (present in DB, absent from desired) — this demotes
    // e.g. procurement from Purchase to general.
    const toRemove = existing.filter((e) => !desired.has(e.permissionModule));

    if (toAdd.length > 0) {
      await prisma.$transaction(
        toAdd.map((permissionModule) =>
          prisma.modulePermissionMap.create({
            data: { id: randomUUID(), moduleId: mod.id, permissionModule },
          }),
        ),
      );
    }
    if (toRemove.length > 0) {
      await prisma.modulePermissionMap.deleteMany({ where: { id: { in: toRemove.map((e) => e.id) } } });
    }

    const removedNote = toRemove.length > 0 ? ` | removed: ${toRemove.map((e) => e.permissionModule).join(", ")}` : "";
    const addedNote = toAdd.length > 0 ? ` | added: ${toAdd.join(", ")}` : "";
    console.error(`✅ ${m.key} → [${m.permissions.join(", ")}]${addedNote}${removedNote}`);
  }
  console.error(`✅ ${MODULE_REGISTRY.length} modules synced (registry authoritative)`);
}

// Run standalone: npm run db:seed:modules
if (process.argv[1]?.includes("modules")) {
  seedModules()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
