/** ONE-OFF: truncate all booking data (dev/staging only). Delete after use. */
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

const tables = [
  "booking_payment_settlements",
  "booking_comment_reads",
  "booking_comments",
  "booking_documents",
  "term_of_payments",
  "snap_package_category_prices",
  "snap_package_vendor_items",
  "snap_package_internal_items",
  "snap_package_pricing",
  "snap_packages",
  "booking_revisions",
  "bookings",
];

async function counts(label) {
  console.log(`\n=== Row counts (${label}) ===`);
  for (const t of tables) {
    const r = await sql.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
    console.log(`${t.padEnd(34)} ${r[0].c}`);
  }
}

async function main() {
  await counts("BEFORE");
  console.log("\nTruncating bookings CASCADE ...");
  await sql.query(`TRUNCATE TABLE "bookings" RESTART IDENTITY CASCADE`);
  await counts("AFTER");
  console.log("\nDone.");
}
main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
