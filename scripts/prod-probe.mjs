/** Temporary READ-ONLY probe for PRODUCTION. Makes NO writes. Delete after use. */
import { readFileSync } from "fs";
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
console.log("HOST:", url.replace(/:[^:@]*@/, ":***@").match(/@([^/]+)/)?.[1]);
const sql = neon(url);

async function main() {
  console.log("\n=== _prisma_migrations (last 8 + any FAILED) ===");
  const migs = await sql`
    SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
    FROM _prisma_migrations ORDER BY started_at`;
  const failed = migs.filter((m) => !m.finished_at || m.rolled_back_at);
  console.log(`total=${migs.length}, failed/rolledback=${failed.length}`);
  for (const m of migs.slice(-8)) {
    const st = m.rolled_back_at ? "ROLLED_BACK" : m.finished_at ? "ok" : "FAILED";
    console.log(`  ${st} | ${m.migration_name} | steps=${m.applied_steps_count}`);
  }
  if (failed.length) {
    console.log("  -- FAILED/ROLLED-BACK entries --");
    for (const m of failed) {
      const st = m.rolled_back_at ? "ROLLED_BACK" : "FAILED";
      console.log(`  ${st} | ${m.migration_name} | steps=${m.applied_steps_count}`);
    }
  }

  console.log("\n=== Row counts ===");
  const c = await sql`
    SELECT (SELECT COUNT(*) FROM users) AS users,
           (SELECT COUNT(*) FROM profiles) AS profiles,
           (SELECT COUNT(*) FROM packages) AS packages,
           (SELECT COUNT(*) FROM bookings) AS bookings,
           (SELECT COUNT(*) FROM customers) AS customers`;
  console.log(`  users=${c[0].users} profiles=${c[0].profiles} packages=${c[0].packages} bookings=${c[0].bookings} customers=${c[0].customers}`);

  console.log("\n=== Schema drift markers ===");
  const driftTables = ["snap_package_variants", "snap_package_pricing", "package_variants"];
  for (const t of driftTables) {
    const r = await sql`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${t}`;
    console.log(`  table ${t}: ${r.length ? "EXISTS" : "absent"}`);
  }
  const pkgCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='packages'
      AND column_name IN ('selling_price','sellingPrice','term_and_condition','termAndCondition')`;
  console.log("  packages legacy/new cols:", pkgCols.map((x) => x.column_name).join(", ") || "(none)");

  console.log("\n=== NULL packageId (would break 053946 SET NOT NULL) ===");
  for (const t of ["package_category_prices", "package_internal_items", "package_vendor_items"]) {
    const hasCol = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${t} AND column_name='packageId'`;
    if (hasCol.length === 0) { console.log(`  ${t}: no packageId col`); continue; }
    const r = await sql.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE "packageId" IS NULL) AS nulls FROM "${t}"`);
    console.log(`  ${t}: total=${r[0].total}, nulls=${r[0].nulls}`);
  }

  // ---- VARIANT EXPORT RECON ----
  console.log("\n=== PACKAGE-related tables present in prod ===");
  const pkgTables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND (table_name LIKE 'package%' OR table_name LIKE '%variant%')
    ORDER BY table_name`;
  console.log(pkgTables.map((t) => "  " + t.table_name).join("\n") || "  (none)");

  console.log("\n=== columns: packages ===");
  await dumpCols("packages");
  console.log("\n=== columns: package_variants (if exists) ===");
  await dumpCols("package_variants");
  console.log("\n=== columns: package_variant_category_prices (if exists) ===");
  await dumpCols("package_variant_category_prices");
  console.log("\n=== columns: package_internal_items ===");
  await dumpCols("package_internal_items");
  console.log("\n=== columns: package_vendor_items ===");
  await dumpCols("package_vendor_items");

  console.log("\n=== counts ===");
  await safeCount("package_variants");
  await safeCount("package_variant_category_prices");
  await safeCount("package_internal_items");
  await safeCount("package_vendor_items");

  console.log("\n=== variants per package (mapping recon) ===");
  const vpp = await sql`
    SELECT "packageId", COUNT(*) AS variants
    FROM package_variants
    GROUP BY "packageId" ORDER BY variants DESC`;
  for (const r of vpp) console.log(`  pkg ${r.packageId}: ${r.variants} variant(s)`);

  console.log("\n=== sample: 1 package + its variants (T&C, price) ===");
  const oneVar = await sql`
    SELECT pv.*, p."packageName"
    FROM package_variants pv
    JOIN packages p ON p.id = pv."packageId"
    LIMIT 3`;
  console.log(JSON.stringify(oneVar, null, 2));

  async function dumpCols(t) {
    const cols = await sql.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    if (!cols.length) { console.log("  (table absent or no cols)"); return; }
    for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type} (null=${c.is_nullable})`);
  }
  async function safeCount(t) {
    const ex = await sql.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [t]);
    if (!ex.length) { console.log(`  ${t}: ABSENT`); return; }
    const r = await sql.query(`SELECT COUNT(*) AS c FROM "${t}"`);
    console.log(`  ${t}: ${r[0].c} rows`);
  }
}
main().catch((e) => { console.error("PROBE ERROR:", e.message); process.exit(1); });
