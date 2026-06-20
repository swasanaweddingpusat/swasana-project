/**
 * Backfill PO Number — Venue/Brand Code Fix
 *
 * Recomputes the brandCode and venueCode segments of every booking's poNumber
 * using the current venue.brand.code and venue.code from the DB.
 *
 * PO format (5 segments): {seq}/{brandCode}/{venueCode}/{typeCode}/{dd-mm-yyyy}
 *   segment[0] = seq        → PRESERVE (never recompute)
 *   segment[1] = brandCode  → recompute from venue.brand.code
 *   segment[2] = venueCode  → recompute from venue.code
 *   segment[3] = typeCode   → recompute from booking.weddingType ?? "R"
 *   segment[4] = date       → PRESERVE (never recompute)
 *
 * Fail-safe: if split("/").length !== 5 → SKIP (legacy/custom format).
 *
 * DEFAULT = DRY RUN (prints only, NO DB writes).
 * Pass --apply flag to execute actual DB updates.
 *
 * Usage:
 *   npx tsx scripts/backfill-po-venue.ts            # dry run
 *   npx tsx scripts/backfill-po-venue.ts --apply    # WRITE (confirm with user first)
 */

import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

// ─── Env loading (manual parse — no dotenv dep needed) ────────────────────────
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env");
  const content = readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      vars[key] = val;
    }
  }
  return vars;
}

const env = loadEnv();
const DATABASE_URL = env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not found in .env");
  process.exit(1);
}

const USE_NEON = env["DB_NEON"] !== "false";
const adapter = USE_NEON
  ? new PrismaNeon({ connectionString: DATABASE_URL })
  : new PrismaPg({ connectionString: DATABASE_URL });

const db = new PrismaClient({ adapter });

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingRow {
  id: string;
  poNumber: string;
  weddingType: string | null;
  venue: {
    id: string;
    code: string;
    brand: {
      id: string;
      code: string;
    } | null;
  };
  customer: {
    name: string;
  };
}

interface ChangeRecord {
  bookingId: string;
  customerName: string;
  poOld: string;
  poNew: string;
}

interface SkipRecord {
  bookingId: string;
  customerName: string;
  poNumber: string;
  reason: "FORMAT_MISMATCH" | "NO_CHANGE";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const applyMode = process.argv.includes("--apply");

  console.log("=".repeat(60));
  console.log(`Backfill PO Number — Venue/Brand Code Fix`);
  console.log(`Mode: ${applyMode ? "APPLY (WRITES ENABLED)" : "DRY RUN (read-only)"}`);
  const dbHost = DATABASE_URL.replace(/:[^:@]*@/, ":***@").match(/@([^/]+)/)?.[1] ?? "(unknown)";
  console.log(`DB Host: ${dbHost}`);
  console.log("=".repeat(60));

  // ─── Fetch all bookings with non-null poNumber ───────────────────────────
  const BATCH_SIZE = 100;
  let offset = 0;
  const allBookings: BookingRow[] = [];

  console.log("\nFetching bookings...");
  while (true) {
    const batch = await db.booking.findMany({
      where: { poNumber: { not: null } },
      select: {
        id: true,
        poNumber: true,
        weddingType: true,
        venue: {
          select: {
            id: true,
            code: true,
            brand: {
              select: { id: true, code: true },
            },
          },
        },
        customer: {
          select: { name: true },
        },
      },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    if (batch.length === 0) break;
    // We know poNumber is non-null here because of the where clause,
    // but the type still allows null. We cast after filtering.
    const validBatch = batch.filter(
      (b): b is typeof b & { poNumber: string } => b.poNumber !== null
    );
    allBookings.push(...(validBatch as BookingRow[]));
    offset += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  console.log(`Total bookings with poNumber: ${allBookings.length}`);

  // ─── Analyze each booking ────────────────────────────────────────────────
  const toChange: ChangeRecord[] = [];
  const skippedMismatch: SkipRecord[] = [];
  const skippedNoChange: SkipRecord[] = [];

  for (const booking of allBookings) {
    const poOld = booking.poNumber;
    const segments = poOld.split("/");

    if (segments.length !== 5) {
      skippedMismatch.push({
        bookingId: booking.id,
        customerName: booking.customer.name,
        poNumber: poOld,
        reason: "FORMAT_MISMATCH",
      });
      continue;
    }

    const [oldSeq, , , , oldDate] = segments;
    const newBrandCode = booking.venue.brand?.code ?? "";
    const newVenueCode = booking.venue.code;
    const newTypeCode = booking.weddingType ?? "R";
    const poNew = `${oldSeq}/${newBrandCode}/${newVenueCode}/${newTypeCode}/${oldDate}`;

    if (poNew === poOld) {
      skippedNoChange.push({
        bookingId: booking.id,
        customerName: booking.customer.name,
        poNumber: poOld,
        reason: "NO_CHANGE",
      });
      continue;
    }

    toChange.push({
      bookingId: booking.id,
      customerName: booking.customer.name,
      poOld,
      poNew,
    });
  }

  // ─── Report ──────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("SUMMARY");
  console.log("─".repeat(60));
  console.log(`  Total scanned          : ${allBookings.length}`);
  console.log(`  Will change            : ${toChange.length}`);
  console.log(`  Skip — no change       : ${skippedNoChange.length}`);
  console.log(`  Skip — format mismatch : ${skippedMismatch.length}`);
  console.log("─".repeat(60));

  if (toChange.length > 0) {
    console.log("\nCHANGES (before → after):");
    const displayCount = Math.min(toChange.length, 30);
    for (let i = 0; i < displayCount; i++) {
      const r = toChange[i];
      console.log(
        `  [${i + 1}] ${r.bookingId.slice(0, 8)}... | ${r.customerName}`
      );
      console.log(`       OLD: ${r.poOld}`);
      console.log(`       NEW: ${r.poNew}`);
    }
    if (toChange.length > 30) {
      console.log(
        `  ... and ${toChange.length - 30} more (not shown — run with --apply to process all)`
      );
    }
  } else {
    console.log("\nNo changes needed.");
  }

  if (skippedMismatch.length > 0) {
    console.log("\nSKIPPED — FORMAT MISMATCH (showing up to 10):");
    const displayCount = Math.min(skippedMismatch.length, 10);
    for (let i = 0; i < displayCount; i++) {
      const r = skippedMismatch[i];
      console.log(
        `  [${i + 1}] ${r.bookingId.slice(0, 8)}... | ${r.customerName} | PO: "${r.poNumber}"`
      );
    }
    if (skippedMismatch.length > 10) {
      console.log(`  ... and ${skippedMismatch.length - 10} more`);
    }
  }

  // ─── Apply ───────────────────────────────────────────────────────────────
  if (applyMode) {
    if (toChange.length === 0) {
      console.log("\n[APPLY] No changes to apply.");
    } else {
      console.log(`\n[APPLY] Writing ${toChange.length} updates...`);
      let successCount = 0;
      let failCount = 0;

      // Process in batches of 50 to avoid overloading the transaction
      const WRITE_BATCH = 50;
      for (let i = 0; i < toChange.length; i += WRITE_BATCH) {
        const chunk = toChange.slice(i, i + WRITE_BATCH);
        try {
          await db.$transaction(
            chunk.map((r) =>
              db.booking.update({
                where: { id: r.bookingId },
                data: { poNumber: r.poNew },
              })
            )
          );
          successCount += chunk.length;
          console.log(
            `  Batch ${Math.floor(i / WRITE_BATCH) + 1}: applied ${chunk.length} updates (total ${successCount}/${toChange.length})`
          );
        } catch (err) {
          failCount += chunk.length;
          console.error(
            `  Batch ${Math.floor(i / WRITE_BATCH) + 1}: FAILED — ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      console.log(`\n[APPLY DONE] success=${successCount}, failed=${failCount}`);
    }
  } else {
    console.log("\n[DRY RUN] No DB writes performed.");
    if (toChange.length > 0) {
      console.log(
        `  Run with --apply to execute ${toChange.length} update(s).`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
