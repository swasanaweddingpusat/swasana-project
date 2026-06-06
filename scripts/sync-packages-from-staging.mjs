/**
 * sync-packages-from-staging.mjs — copy package data FROM STAGING into a target
 * DB (dev or prod), transforming vendor/internal item descriptions to the final
 * pipe-separated plain-text format on the way in.
 *
 * Remaps venueId / categoryId BY NAME (IDs differ per env). Fresh UUID per row.
 *
 * SAFETY:
 *   - STAGING is read-only here.
 *   - Target must be passed explicitly:  --target dev | --target prod
 *   - For prod you must ALSO pass --confirm-prod.
 *   - Asserts host fragments match before any write.
 *   - --dry prints what would happen without writing.
 *   - Deletes ONLY package tables (FK-safe order); never TRUNCATE CASCADE, so
 *     bookings and everything else are untouched.
 *
 * Usage:
 *   node scripts/sync-packages-from-staging.mjs --target dev --dry
 *   node scripts/sync-packages-from-staging.mjs --target dev
 *   node scripts/sync-packages-from-staging.mjs --target prod --confirm-prod
 */
import postgres from "postgres";
import crypto from "crypto";
import { resolveDbUrls, ENV_HOST, hostOf } from "./db-url.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i !== -1 ? args[i + 1] : undefined;
};

const target = opt("--target");
const DRY = flag("--dry");
if (!["dev", "prod"].includes(target)) {
  console.error("ERROR: --target must be 'dev' or 'prod'");
  process.exit(1);
}
if (target === "prod" && !flag("--confirm-prod")) {
  console.error("ERROR: writing to prod requires --confirm-prod");
  process.exit(1);
}

// ── Description transform (mirrors scripts/_transform_pkg_desc.mjs) ──────────
function htmlToPipe(html) {
  if (!html || (!html.includes("<ol") && !html.includes("<ul"))) return html;
  let s = html;
  const HDR = "@@HDR@@";
  s = s.replace(/<p><strong>(.*?)<\/strong><\/p>\s*(?=<(?:ol|ul)\b)/gi, HDR + "$1: ");
  s = s.replace(/<(ol|ul)\b[^>]*>(.*?)<\/\1>/gis, (_m, _t, inner) =>
    [...inner.matchAll(/<li\b[^>]*>(.*?)<\/li>/gis)].map((m) => m[1].trim()).join(" | "),
  );
  s = s.replace(new RegExp("^" + HDR), "");
  s = s.split(HDR).join(" | ");
  return s;
}

const srcUrl = resolveDbUrls("staging").direct;
const tgtUrl = resolveDbUrls(target).direct;

if (!hostOf(srcUrl).includes(ENV_HOST.staging)) {
  console.error("ERROR: staging host mismatch");
  process.exit(1);
}
if (!hostOf(tgtUrl).includes(ENV_HOST[target])) {
  console.error(`ERROR: target host does not match ${target}`);
  process.exit(1);
}

const norm = (s) => (s ?? "").trim().toLowerCase();

async function main() {
  console.log(`=== sync-packages: STAGING -> ${target.toUpperCase()}${DRY ? " (DRY RUN)" : ""} ===`);
  console.log(`  source staging: ${hostOf(srcUrl)}`);
  console.log(`  target ${target}: ${hostOf(tgtUrl)}`);

  const src = postgres(srcUrl, { ssl: "require", max: 1 });
  const tgt = postgres(tgtUrl, { ssl: "require", max: 1 });

  try {
    // ── Read from STAGING ──
    const packages = await src`SELECT * FROM packages`;
    const pcp = await src`SELECT * FROM package_category_prices`;
    const pvi = await src`SELECT * FROM package_vendor_items`;
    const pii = await src`SELECT * FROM package_internal_items`;
    const srcVenues = await src`SELECT id, name FROM venues`;
    const srcCats = await src`SELECT id, name FROM categories`;
    console.log(`\nSTAGING: packages=${packages.length} pcp=${pcp.length} pvi=${pvi.length} pii=${pii.length}`);

    // ── Remap tables (by name) ──
    const tgtVenues = await tgt`SELECT id, name FROM venues`;
    const tgtCats = await tgt`SELECT id, name FROM categories`;
    const venueNameToTgt = new Map(tgtVenues.map((v) => [norm(v.name), v.id]));
    const catNameToTgt = new Map(tgtCats.map((c) => [norm(c.name), c.id]));
    const srcVenueName = new Map(srcVenues.map((v) => [v.id, v.name]));
    const srcCatName = new Map(srcCats.map((c) => [c.id, c.name]));

    const mapVenue = (id) => {
      if (!id) return { id: null, warn: null };
      const name = srcVenueName.get(id);
      const tid = name ? venueNameToTgt.get(norm(name)) : undefined;
      return { id: tid ?? null, warn: tid ? null : `venue "${name ?? id}" not in ${target}` };
    };
    const mapCat = (id, fallbackName) => {
      let name = id ? srcCatName.get(id) : null;
      if (!name) name = fallbackName;
      if (!name) return { id: null };
      return { id: catNameToTgt.get(norm(name)) ?? null };
    };

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

    // ── Transform sample preview ──
    const transformedVi = pvi.filter((r) => htmlToPipe(r.itemText) !== r.itemText).length;
    const transformedIi = pii.filter((r) => htmlToPipe(r.itemDescription) !== r.itemDescription).length;
    console.log(`Will transform descriptions: vendorItems=${transformedVi}, internalItems=${transformedIi}`);

    const [{ c: tgtPkgBefore }] = await tgt`SELECT COUNT(*)::int c FROM packages`;
    console.log(`Target currently has ${tgtPkgBefore} packages (will be replaced).`);

    if (DRY) {
      const sampleVi = pvi.find((r) => htmlToPipe(r.itemText) !== r.itemText);
      const sampleIi = pii.find((r) => htmlToPipe(r.itemDescription) !== r.itemDescription);
      console.log("\n-- sample transforms --");
      if (sampleVi) {
        console.log("VENDOR  before:", sampleVi.itemText.slice(0, 120));
        console.log("VENDOR  after :", htmlToPipe(sampleVi.itemText).slice(0, 120));
      }
      if (sampleIi) {
        console.log("INTERN  before:", sampleIi.itemDescription.slice(0, 120));
        console.log("INTERN  after :", htmlToPipe(sampleIi.itemDescription).slice(0, 120));
      }
      console.log("\n(dry run — no writes)");
      return;
    }

    // ── Cleanup target (package tables only, FK-safe) ──
    await tgt`DELETE FROM package_category_prices`;
    await tgt`DELETE FROM package_vendor_items`;
    await tgt`DELETE FROM package_internal_items`;
    await tgt`DELETE FROM packages`;
    console.log("\nCleared target package tables (bookings untouched).");

    // ── Insert per package ──
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
        return { ...r, _newId: crypto.randomUUID(), _catId: cm.id, _pkgId: newPkgId, _text: htmlToPipe(r.itemText) };
      });
      const inRows = (piiByPkg.get(p.id) ?? []).map((r) => ({
        ...r, _newId: crypto.randomUUID(), _pkgId: newPkgId, _desc: htmlToPipe(r.itemDescription ?? ""),
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
            VALUES (${r._newId}, ${r._pkgId}, ${r._catId}, ${r.categoryName ?? null}, ${r._text},
                    ${r.sortOrder}, ${r.createdAt}, ${r.updatedAt})`;
        }
        for (const r of inRows) {
          await tx`INSERT INTO package_internal_items
            (id, "packageId", "itemName", "itemDescription", "sortOrder", "createdAt", "updatedAt")
            VALUES (${r._newId}, ${r._pkgId}, ${r.itemName}, ${r._desc}, ${r.sortOrder},
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
    console.error("SYNC ERROR:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    await src.end();
    await tgt.end();
  }
}

main();
