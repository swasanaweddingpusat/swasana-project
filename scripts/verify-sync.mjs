/**
 * verify-sync.mjs — read-only verification that a target DB (staging|prod)
 * matches DEV after the package + RBAC sync. Checks counts, permission tuples,
 * FK orphans, and (critically) that users/profiles are intact.
 *
 * Usage: node scripts/verify-sync.mjs --target staging
 *        node scripts/verify-sync.mjs --target prod --expect-users 36
 */
import postgres from "postgres";
import { resolveDbUrls, hostOf } from "./db-url.mjs";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : undefined; };
const target = opt("--target");
const expectUsers = opt("--expect-users") ? Number(opt("--expect-users")) : null;
if (!["staging", "prod"].includes(target)) {
  console.error("ERROR: --target must be staging|prod");
  process.exit(1);
}

const dev = postgres(resolveDbUrls("dev").direct, { ssl: "require", max: 1 });
const tgt = postgres(resolveDbUrls(target).direct, { ssl: "require", max: 1 });

const countTables = [
  "packages", "package_category_prices", "package_vendor_items",
  "package_internal_items", "categories", "roles", "permissions",
  "role_permissions", "venues", "users", "profiles",
];

async function counts(sql) {
  const out = {};
  for (const t of countTables) {
    const [{ c }] = await sql`SELECT COUNT(*)::int c FROM ${sql(t)}`;
    out[t] = c;
  }
  return out;
}

async function main() {
  console.log(`=== verify-sync: ${target.toUpperCase()} vs DEV ===`);
  console.log(`  target: ${hostOf(resolveDbUrls(target).direct)}`);
  let pass = true;
  const fail = (m) => { pass = false; console.log("  ✗ " + m); };
  const ok = (m) => console.log("  ✓ " + m);

  try {
    const [d, t] = [await counts(dev), await counts(tgt)];
    console.log("\n-- counts (DEV / TARGET) --");
    for (const k of countTables) {
      const same = d[k] === t[k];
      const line = `${k.padEnd(24)} ${String(d[k]).padStart(5)} / ${String(t[k]).padStart(5)}`;
      // users/profiles intentionally differ per-env; just display, don't gate equality
      if (["users", "profiles", "venues"].includes(k)) { console.log("  · " + line); continue; }
      if (same) ok(line); else fail(line + "  (mismatch)");
    }

    // users intact gate
    if (expectUsers !== null) {
      if (t.users === expectUsers) ok(`users == ${expectUsers} (intact)`);
      else fail(`users == ${t.users}, expected ${expectUsers}`);
    }

    // permission tuple set-equality
    const dPerms = (await dev`SELECT module, action FROM permissions`).map((r) => `${r.module}:${r.action}`).sort();
    const tPerms = (await tgt`SELECT module, action FROM permissions`).map((r) => `${r.module}:${r.action}`).sort();
    const missing = dPerms.filter((p) => !tPerms.includes(p));
    const extra = tPerms.filter((p) => !dPerms.includes(p));
    if (missing.length === 0 && extra.length === 0) ok(`permission tuples match (${dPerms.length})`);
    else fail(`permission tuples differ: missing=${missing.join(",")} extra=${extra.join(",")}`);

    // sales-mice role + super-admin flag
    const salesMice = await tgt`SELECT 1 FROM roles WHERE name = 'sales-mice'`;
    if (salesMice.length) ok("role sales-mice present"); else fail("role sales-mice MISSING");
    const sa = await tgt`SELECT "isSystemRole" FROM roles WHERE name = 'super-admin'`;
    if (sa[0]?.isSystemRole === true) ok("super-admin isSystemRole=true"); else fail("super-admin isSystemRole NOT true");

    // FK orphan checks on target
    const [{ c: orphanPkg }] = await tgt`
      SELECT COUNT(*)::int c FROM package_category_prices p
      WHERE NOT EXISTS (SELECT 1 FROM packages k WHERE k.id = p."packageId")`;
    if (orphanPkg === 0) ok("no orphan package_category_prices.packageId"); else fail(`orphan pcp.packageId=${orphanPkg}`);

    const [{ c: orphanCat }] = await tgt`
      SELECT COUNT(*)::int c FROM package_category_prices p
      WHERE p."categoryId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = p."categoryId")`;
    if (orphanCat === 0) ok("no orphan package_category_prices.categoryId"); else fail(`orphan pcp.categoryId=${orphanCat}`);

    const [{ c: orphanVenue }] = await tgt`
      SELECT COUNT(*)::int c FROM packages p
      WHERE p."venueId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM venues v WHERE v.id = p."venueId")`;
    if (orphanVenue === 0) ok("no orphan packages.venueId"); else fail(`orphan packages.venueId=${orphanVenue}`);

    // categoryId NULL comparison (informational)
    const [{ c: dNull }] = await dev`SELECT COUNT(*)::int c FROM package_category_prices WHERE "categoryId" IS NULL`;
    const [{ c: tNull }] = await tgt`SELECT COUNT(*)::int c FROM package_category_prices WHERE "categoryId" IS NULL`;
    console.log(`  · pcp categoryId NULL  DEV=${dNull} TARGET=${tNull}`);

    // packages schema parity (camelCase cols present)
    const camel = await tgt`SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='packages' AND column_name IN ('sellingPrice','termAndCondition')`;
    if (camel.length === 2) ok("packages has sellingPrice/termAndCondition"); else fail("packages missing camelCase cols");

    console.log("\n" + (pass ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"));
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.error("VERIFY ERROR:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    await dev.end();
    await tgt.end();
  }
}

main();
