/**
 * backup-prod.mjs — full logical backup of PRODUCTION into local JSON files.
 * READ-ONLY on prod. Dumps every public table that has rows (plus users,
 * profiles, roles, permissions, role_permissions ALWAYS, even if checked).
 *
 * Output: scripts/backups/prod-<UTCstamp>/<table>.json  + _manifest.json
 *
 * Usage: node scripts/backup-prod.mjs
 *        node scripts/backup-prod.mjs --stamp 20260602T1200Z   (custom folder)
 */
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveDbUrls, hostOf, ENV_HOST } from "./db-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : undefined; };

const url = resolveDbUrls("prod").direct;
if (!hostOf(url).includes(ENV_HOST.prod)) {
  console.error("ERROR: prod host mismatch — aborting");
  process.exit(1);
}

// Stamp must be passed for reproducibility (Date.* is fine in a plain node script here).
const stamp = opt("--stamp") ?? new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outDir = path.join(__dirname, "backups", `prod-${stamp}`);

async function main() {
  console.log("=== backup-prod (READ-ONLY) ===");
  console.log("  host:", hostOf(url));
  console.log("  out :", outDir);
  mkdirSync(outDir, { recursive: true });

  const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
  try {
    const tables = (await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name`).map((r) => r.table_name);

    const manifest = { stamp, host: hostOf(url), tables: {} };
    let totalRows = 0;

    for (const t of tables) {
      const rows = await sql`SELECT * FROM ${sql(t)}`;
      manifest.tables[t] = rows.length;
      totalRows += rows.length;
      // only write files for non-empty tables to keep the folder lean,
      // but always record the count in the manifest
      if (rows.length > 0) {
        writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(rows, null, 2));
      }
    }

    // also dump migration state for reference
    const migs = await sql`SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
      FROM _prisma_migrations ORDER BY started_at`;
    writeFileSync(path.join(outDir, "_prisma_migrations.json"), JSON.stringify(migs, null, 2));
    manifest.migrationCount = migs.length;

    writeFileSync(path.join(outDir, "_manifest.json"), JSON.stringify(manifest, null, 2));

    console.log(`\n  tables dumped: ${tables.length}, total rows: ${totalRows}`);
    console.log("  key tables:");
    for (const k of ["users", "profiles", "roles", "permissions", "role_permissions", "packages", "venues", "vendors", "payment_methods"]) {
      if (k in manifest.tables) console.log(`    ${k.padEnd(20)} ${manifest.tables[k]}`);
    }
    console.log(`\n  manifest: ${path.join(outDir, "_manifest.json")}`);
    console.log("Done.");
  } catch (e) {
    console.error("BACKUP ERROR:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
