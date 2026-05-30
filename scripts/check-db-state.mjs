/**
 * Temporary diagnostic script — check DB migration state and table existence.
 * Run: node scripts/check-db-state.mjs
 * Delete after use.
 */
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Read env file manually
const envContent = readFileSync(".env", "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const directUrl = envVars["DIRECT_URL"] || envVars["DATABASE_URL"];
if (!directUrl) {
  console.error("No DIRECT_URL or DATABASE_URL found in .env");
  process.exit(1);
}

const { neon } = require("@neondatabase/serverless");
const sql = neon(directUrl);

async function main() {
  console.log("=== _prisma_migrations ===");
  const migrations = await sql`
    SELECT migration_name, started_at, finished_at, applied_steps_count, logs
    FROM _prisma_migrations
    ORDER BY started_at
  `;
  for (const m of migrations) {
    const status = m.finished_at ? "OK    " : "FAILED";
    const logs = m.logs ? ` | LOG: ${m.logs.substring(0, 200)}` : "";
    console.log(`${status} | ${m.migration_name} | steps=${m.applied_steps_count}${logs}`);
  }

  console.log("\n=== Tables check ===");
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'snap_package_pricing',
        'snap_package_variants',
        'package_category_prices',
        'package_variant_category_prices',
        'snap_package_category_prices',
        'packages',
        'package_variants'
      )
    ORDER BY table_name
  `;
  console.log("Tables found:", tables.map((t) => t.table_name).join(", "));

  console.log("\n=== packages columns ===");
  const pkgCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'packages'
    ORDER BY ordinal_position
  `;
  for (const c of pkgCols) console.log(`  ${c.column_name}: ${c.data_type} (nullable=${c.is_nullable})`);

  console.log("\n=== snap_package_pricing columns ===");
  const sppCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'snap_package_pricing'
    ORDER BY ordinal_position
  `;
  for (const c of sppCols) console.log(`  ${c.column_name}: ${c.data_type} (nullable=${c.is_nullable})`);

  console.log("\n=== package_category_prices columns ===");
  const pcpCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'package_category_prices'
    ORDER BY ordinal_position
  `;
  for (const c of pcpCols) console.log(`  ${c.column_name}: ${c.data_type} (nullable=${c.is_nullable})`);

  console.log("\n=== Constraints on package_category_prices ===");
  const constraints = await sql`
    SELECT conname, contype
    FROM pg_constraint
    WHERE conrelid = 'package_category_prices'::regclass
  `;
  for (const c of constraints) console.log(`  ${c.conname}: type=${c.contype}`);

  console.log("\n=== Row counts (to confirm fresh DB) ===");
  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM bookings) AS bookings,
      (SELECT COUNT(*) FROM packages) AS packages
  `;
  console.log(`  users=${counts[0].users}, bookings=${counts[0].bookings}, packages=${counts[0].packages}`);
}

main().catch(console.error);
