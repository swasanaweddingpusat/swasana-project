/**
 * copy-packages.mjs — copy package data from DEV (live) into a target DB
 * (staging or prod). Remaps venueId and categoryId BY NAME, since IDs differ
 * per environment. Generates fresh UUIDs for every copied row.
 *
 * SAFETY:
 *   - DEV is read-only here.
 *   - Target must be passed explicitly:  --target staging | --target prod
 *   - For prod you must ALSO pass --confirm-prod (extra guard).
 *   - Asserts the target host matches the expected fragment before writing.
 *   - Asserts target `packages` is EMPTY before inserting (run cleanup first).
 *
 * Tables copied (FK-safe order): packages -> package_category_prices,
 *   package_vendor_items, package_internal_items.
 * Categories are NOT copied (target already seeds 23 canonical via migration
 * 20260601120000); categoryId is remapped by name, NULL if no match.
 *
 * Usage:
 *   node scripts/copy-packages.mjs --target staging
 *   node scripts/copy-packages.mjs --target prod --confirm-prod
 */
import postgres from "postgres";
import crypto from "crypto";
import { resolveDbUrls, ENV_HOST, hostOf } from "./db-url.mjs";

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i !== -1;
}
function opt(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

const target = opt("--target");
if (!["staging", "prod"].includes(target)) {
  console.error("ERROR: --target must be 'staging' or 'prod'");
  process.exit(1);
}
if (target === "prod" && !flag("--confirm-prod")) {
  console.error("ERROR: writing to prod requires --confirm-prod");
  process.exit(1);
}

const devUrl = resolveDbUrls("dev").direct;
const tgtUrl = resolveDbUrls(target).direct;

// Host assertion guards (never write to the wrong DB)
if (!hostOf(devUrl).includes(ENV_HOST.dev)) {
  console.error("ERROR: dev host mismatch");
  process.exit(1);
}
if (!hostOf(tgtUrl).includes(ENV_HOST[target])) {
  console.error(`ERROR: target host does not match ${target}`);
  process.exit(1);
}

const norm = (s) => (s ?? "").trim().toLowerCase();

async function main() {
  console.log(`=== copy-packages: DEV -> ${target.toUpperCase()} ===`);
  console.log(`  source DEV : ${hostOf(devUrl)}`);
  console.log(`  target ${target}: ${hostOf(tgtUrl)}`);

  const dev = postgres(devUrl, { ssl: "require", max: 1 });
  const tgt = postgres(tgtUrl, { ssl: "require", max: 1 });

  try {
    // ── Guard: target packages must be empty ────────────────────────────────
    const [{ c: pkgCount }] = await tgt`SELECT COUNT(*)::int c FROM packages`;
    if (pkgCount !== 0) {
      console.error(`ERROR: target has ${pkgCount} packages. Run cleanup-sync-safe.sql first.`);
      process.exit(1);
    }

    // ── Read from DEV ───────────────────────────────────────────────────────
    const packages = await dev`SELECT * FROM packages`;
    const pcp = await dev`SELECT * FROM package_category_prices`;
    const pvi = await dev`SELECT * FROM package_vendor_items`;
    const pii = await dev`SELECT * FROM package_internal_items`;
    const devVenues = await dev`SELECT id, name FROM venues`;
    const devCats = await dev`SELECT id, name FROM categories`;
    console.log(`\nDEV: packages=${packages.length} pcp=${pcp.length} pvi=${pvi.length} pii=${pii.length}`);

    // ── Build remap: dev venueId/categoryId -> name -> target id ─────────────
    const tgtVenues = await tgt`SELECT id, name FROM venues`;
    const tgtCats = await tgt`SELECT id, name FROM categories`;
    const venueNameToTgt = new Map(tgtVenues.map((v) => [norm(v.name), v.id]));
    const catNameToTgt = new Map(tgtCats.map((c) => [norm(c.name), c.id]));
    const devVenueName = new Map(devVenues.map((v) => [v.id, v.name]));
    const devCatName = new Map(devCats.map((c) => [c.id, c.name]));

    function mapVenue(devVenueId) {
      if (!devVenueId) return { id: null, warn: null };
      const name = devVenueName.get(devVenueId);
      const tid = name ? venueNameToTgt.get(norm(name)) : undefined;
      return { id: tid ?? null, warn: tid ? null : `venue "${name ?? devVenueId}" not in ${target}` };
    }
    function mapCat(devCatId, fallbackName) {
      // prefer categoryId->name->target; else use row.categoryName
      let name = devCatId ? devCatName.get(devCatId) : null;
      if (!name) name = fallbackName;
      if (!name) return { id: null };
      return { id: catNameToTgt.get(norm(name)) ?? null };
    }

    // group children by old packageId
    const byPkg = (rows) => {
      const m = new Map();
      for (const r of rows) {
        if (!m.has(r.packageId)) m.set(r.packageId, []);
        m.get(r.packageId).push(r);
      }
      return m;
    };
    const pcpByPkg = byPkg(pcp);
    const pviByPkg = byPkg(pvi);
    const piiByPkg = byPkg(pii);

    // ── Insert per package (atomic per package) ─────────────────────────────
    let okPkg = 0, nVenueNull = 0, nCatNull = 0;
    const venueWarns = new Set();

    for (const p of packages) {
      const newPkgId = crypto.randomUUID();
      const vm = mapVenue(p.venueId);
      if (vm.warn) { venueWarns.add(vm.warn); nVenueNull++; }

      const cpRows = (pcpByPkg.get(p.id) ?? []).map((r) => {
        const cm = mapCat(r.categoryId, r.categoryName);
        if (r.categoryId && !cm.id) nCatNull++;
        return { ...r, _newId: crypto.randomUUID(), _catId: cm.id, _pkgId: newPkgId };
      });
      const viRows = (pviByPkg.get(p.id) ?? []).map((r) => {
        const cm = mapCat(r.categoryId, r.categoryName);
        if (r.categoryId && !cm.id) nCatNull++;
        return { ...r, _newId: crypto.randomUUID(), _catId: cm.id, _pkgId: newPkgId };
      });
      const inRows = (piiByPkg.get(p.id) ?? []).map((r) => ({
        ...r, _newId: crypto.randomUUID(), _pkgId: newPkgId,
      }));

      await tgt.begin(async (tx) => {
        await tx`INSERT INTO packages
          (id, "packageName", available, "approvalStatus", "venueId", notes, pax, margin, "sellingPrice", "termAndCondition", "createdAt", "updatedAt")
          VALUES (${newPkgId}, ${p.packageName}, ${p.available}, ${p.approvalStatus}, ${vm.id},
                  ${p.notes ?? null}, ${p.pax}, ${p.margin}, ${p.sellingPrice}, ${p.termAndCondition ?? null},
                  ${p.createdAt}, ${p.updatedAt})`;

        for (const r of cpRows) {
          await tx`INSERT INTO package_category_prices
            (id, "packageId", "categoryId", "categoryName", "basePrice", "sortOrder", "isShow", "createdAt", "updatedAt")
            VALUES (${r._newId}, ${r._pkgId}, ${r._catId}, ${r.categoryName ?? null}, ${r.basePrice},
                    ${r.sortOrder}, ${r.isShow}, ${r.createdAt}, ${r.updatedAt})`;
        }
        for (const r of viRows) {
          await tx`INSERT INTO package_vendor_items
            (id, "packageId", "categoryId", "categoryName", "itemText", "sortOrder", "createdAt", "updatedAt")
            VALUES (${r._newId}, ${r._pkgId}, ${r._catId}, ${r.categoryName ?? null}, ${r.itemText},
                    ${r.sortOrder}, ${r.createdAt}, ${r.updatedAt})`;
        }
        for (const r of inRows) {
          await tx`INSERT INTO package_internal_items
            (id, "packageId", "itemName", "itemDescription", "sortOrder", "createdAt", "updatedAt")
            VALUES (${r._newId}, ${r._pkgId}, ${r.itemName}, ${r.itemDescription ?? ""}, ${r.sortOrder},
                    ${r.createdAt}, ${r.updatedAt})`;
        }
      });
      okPkg++;
    }

    console.log(`\nInserted into ${target}: packages=${okPkg}`);
    console.log(`  venueId set NULL (name not found): ${nVenueNull}`);
    console.log(`  categoryId set NULL (name not matched): ${nCatNull}`);
    if (venueWarns.size) {
      console.log("  venue warnings:");
      for (const w of venueWarns) console.log("    - " + w);
    }
    console.log("\nDone.");
  } catch (e) {
    console.error("COPY ERROR:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    await dev.end();
    await tgt.end();
  }
}

main();
