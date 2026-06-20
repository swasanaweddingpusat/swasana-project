// One-shot script: backfill BookingRevision.snapshotData
// Adds key "eventDate" = value of "bookingDate" for rows that have bookingDate but no eventDate
// Run: node scripts/backfill-snapshot.mjs
// SAFE: does NOT remove the bookingDate key from snapshot (kept as fallback)

import pg from 'pg';

const { Client } = pg;

const DB_URL =
  'postgresql://postgres:hwqYPOcVwFEXYWcnoIDLahJLXTIrjIHz@thomas.proxy.rlwy.net:10947/railway?sslmode=disable';

const client = new Client({ connectionString: DB_URL, ssl: false });

await client.connect();
console.log('Connected to DB dev (thomas.proxy.rlwy.net:10947)');

// ── BEFORE ─────────────────────────────────────────────────────────────────
const before = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE "snapshotData"::jsonb ? 'bookingDate') AS has_booking_date,
    COUNT(*) FILTER (WHERE "snapshotData"::jsonb ? 'eventDate')   AS has_event_date,
    COUNT(*) FILTER (
      WHERE "snapshotData"::jsonb ? 'bookingDate'
        AND NOT ("snapshotData"::jsonb ? 'eventDate')
    ) AS needs_backfill,
    COUNT(*) AS total
  FROM "booking_revisions"
  WHERE "snapshotData" IS NOT NULL
`);
console.log('\n=== BEFORE BACKFILL ===');
console.table(before.rows);

const needsBackfill = parseInt(before.rows[0].needs_backfill, 10);
if (needsBackfill === 0) {
  console.log('\nNothing to backfill. All rows already have eventDate (or no bookingDate). Exiting.');
  await client.end();
  process.exit(0);
}

// ── BACKFILL ────────────────────────────────────────────────────────────────
// jsonb_set adds/overwrites the 'eventDate' key with the value from 'bookingDate'
// Only touch rows that have 'bookingDate' AND do NOT yet have 'eventDate'
const update = await client.query(`
  UPDATE "booking_revisions"
  SET "snapshotData" = jsonb_set(
        "snapshotData",
        '{eventDate}',
        "snapshotData" -> 'bookingDate'
      )
  WHERE "snapshotData" IS NOT NULL
    AND "snapshotData" ? 'bookingDate'
    AND NOT ("snapshotData" ? 'eventDate')
`);
console.log(`\nBackfilled ${update.rowCount} rows.`);

// ── AFTER ───────────────────────────────────────────────────────────────────
const after = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE "snapshotData"::jsonb ? 'bookingDate') AS has_booking_date,
    COUNT(*) FILTER (WHERE "snapshotData"::jsonb ? 'eventDate')   AS has_event_date,
    COUNT(*) FILTER (
      WHERE "snapshotData"::jsonb ? 'bookingDate'
        AND NOT ("snapshotData"::jsonb ? 'eventDate')
    ) AS still_needs_backfill,
    COUNT(*) AS total
  FROM "booking_revisions"
  WHERE "snapshotData" IS NOT NULL
`);
console.log('\n=== AFTER BACKFILL ===');
console.table(after.rows);

const stillNeeds = parseInt(after.rows[0].still_needs_backfill, 10);
if (stillNeeds > 0) {
  console.error(`\nERROR: ${stillNeeds} rows still need backfill! Investigate.`);
  await client.end();
  process.exit(1);
}

console.log('\nBackfill complete. bookingDate key preserved in snapshots (fallback-safe).');
await client.end();
