/**
 * READ-ONLY export of production package data (variant-era schema).
 * Dumps packages + variants + category prices + internal/vendor items + venue refs
 * to scripts/exports/prod-packages-export.json. Makes NO writes to the DB.
 * Run: node scripts/prod-export-packages.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const envContent = readFileSync(".env", "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { neon } = require("@neondatabase/serverless");
const url = envVars["DIRECT_URL"] || envVars["DATABASE_URL"];
const host = url.match(/@([^/]+)/)?.[1] ?? "unknown";
const sql = neon(url);

async function main() {
  console.log("Exporting from host:", host);

  const packages = await sql`
    SELECT id, "packageName", available, "venueId", notes, "approvalStatus",
           "createdAt", "updatedAt"
    FROM packages ORDER BY "packageName"`;

  const variants = await sql`
    SELECT id, "packageId", "variantName", pax, available, margin,
           "termAndCondition", "sellingPrice", "deletedAt", "createdAt", "updatedAt"
    FROM package_variants ORDER BY "packageId", "sellingPrice"`;

  const categoryPrices = await sql`
    SELECT id, "packageVariantId", "categoryName", "basePrice", "sortOrder",
           "isShow", "createdAt", "updatedAt"
    FROM package_variant_category_prices ORDER BY "packageVariantId", "sortOrder"`;

  const internalItems = await sql`
    SELECT id, "packageVariantId", "itemName", "itemDescription", "sortOrder",
           "createdAt", "updatedAt"
    FROM package_internal_items ORDER BY "packageVariantId", "sortOrder"`;

  const vendorItems = await sql`
    SELECT id, "packageVariantId", "categoryName", "itemText", "sortOrder",
           "createdAt", "updatedAt"
    FROM package_vendor_items ORDER BY "packageVariantId", "sortOrder"`;

  const venues = await sql`
    SELECT id, name, code FROM venues ORDER BY name`;

  // Build nested structure: package -> variants -> (categoryPrices, internalItems, vendorItems)
  const cpByVariant = groupBy(categoryPrices, "packageVariantId");
  const iiByVariant = groupBy(internalItems, "packageVariantId");
  const viByVariant = groupBy(vendorItems, "packageVariantId");
  const varByPackage = groupBy(variants, "packageId");
  const venueById = Object.fromEntries(venues.map((v) => [v.id, v]));

  const nested = packages.map((p) => ({
    ...p,
    venue: venueById[p.venueId] ?? null,
    variants: (varByPackage[p.id] ?? []).map((v) => ({
      ...v,
      categoryPrices: cpByVariant[v.id] ?? [],
      internalItems: iiByVariant[v.id] ?? [],
      vendorItems: viByVariant[v.id] ?? [],
    })),
  }));

  const out = {
    exportedFromHost: host,
    counts: {
      packages: packages.length,
      variants: variants.length,
      categoryPrices: categoryPrices.length,
      internalItems: internalItems.length,
      vendorItems: vendorItems.length,
      venues: venues.length,
    },
    venues,
    packages: nested,
    // also keep flat raw arrays for safety / alternate processing
    raw: { packages, variants, categoryPrices, internalItems, vendorItems },
  };

  mkdirSync("scripts/exports", { recursive: true });
  const path = "scripts/exports/prod-packages-export.json";
  writeFileSync(path, JSON.stringify(out, null, 2), "utf-8");
  console.log("\nCounts:", JSON.stringify(out.counts));
  console.log("Written to:", path);

  // quick integrity: variants with null T&C / zero price
  const nullTc = variants.filter((v) => !v.termAndCondition).length;
  const zeroPrice = variants.filter((v) => !v.sellingPrice).length;
  const softDeleted = variants.filter((v) => v.deletedAt).length;
  console.log(`Variants: total=${variants.length}, null T&C=${nullTc}, zero price=${zeroPrice}, soft-deleted=${softDeleted}`);
}

function groupBy(rows, key) {
  const out = {};
  for (const r of rows) (out[r[key]] ??= []).push(r);
  return out;
}

main().catch((e) => { console.error("EXPORT ERROR:", e.message); process.exit(1); });
