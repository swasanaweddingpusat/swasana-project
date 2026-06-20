/**
 * scripts/refresh-booking-price.cjs
 *
 * Refresh snap_package_pricing.price + fullPrice untuk satu booking
 * ke harga master packages.sellingPrice terbaru.
 *
 * DEFAULT: DRY RUN — hanya print before/after, tidak nulis ke DB.
 * Gunakan flag --apply untuk eksekusi sesungguhnya.
 *
 * Usage:
 *   node scripts/refresh-booking-price.cjs                  # dry run (prints plan)
 *   node scripts/refresh-booking-price.cjs --apply          # apply ke prod
 *
 * Catatan:
 *   - Script ini HANYA update snap_package_pricing (price + fullPrice).
 *   - TOP (term_of_payments) TIDAK diupdate oleh script ini secara otomatis.
 *     Lihat bagian "TOP ADJUSTMENT" di output dry run untuk panduan manual.
 *   - Script ini tidak trigger re-approval workflow.
 */

"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const APPLY = process.argv.includes("--apply");

const { PrismaClient } = require("@prisma/client");
const { PrismaNeonHttp } = require("@prisma/adapter-neon");

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL);
const db = new PrismaClient({ adapter });

// ─── Target booking ───────────────────────────────────────────────────────────
// Hardcoded for Adriel Soengadi & Gabriella Stella Maries.
// The script searches by customer name to avoid hardcoding a booking UUID.
const CUSTOMER_NAME_CONTAINS = "Adriel";

// ─── Target price ─────────────────────────────────────────────────────────────
// This MUST match packages.sellingPrice in the DB.
// Set to null to auto-read from packages.sellingPrice (preferred).
const OVERRIDE_TARGET_PRICE = null; // null = use master pkg.sellingPrice

async function main() {
  console.log("=".repeat(60));
  console.log(APPLY ? "MODE: APPLY (WRITING TO PROD DB)" : "MODE: DRY RUN (read-only, no writes)");
  console.log("=".repeat(60));
  console.log("");

  // 1. Find booking
  const booking = await db.booking.findFirst({
    where: {
      snapCustomer: {
        name: { contains: CUSTOMER_NAME_CONTAINS, mode: "insensitive" },
      },
      recordStatus: "saved",
    },
    select: {
      id: true,
      packageId: true,
      discountAmount: true,
      discountName: true,
      snapCustomer: { select: { name: true } },
      snapPackagePricing: {
        select: { id: true, price: true, fullPrice: true, margin: true },
      },
      termOfPayments: {
        select: {
          id: true,
          name: true,
          amount: true,
          paymentStatus: true,
          ackStatus: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!booking) {
    console.error("ERROR: Booking tidak ditemukan untuk '" + CUSTOMER_NAME_CONTAINS + "'");
    await db.$disconnect();
    process.exit(1);
  }

  const spp = booking.snapPackagePricing;
  if (!spp) {
    console.error("ERROR: snap_package_pricing tidak ada untuk booking ini");
    await db.$disconnect();
    process.exit(1);
  }

  // 2. Fetch master package
  const pkg = await db.package.findUnique({
    where: { id: booking.packageId },
    select: { id: true, packageName: true, sellingPrice: true, margin: true },
  });

  if (!pkg) {
    console.error("ERROR: Package master tidak ditemukan (packageId=" + booking.packageId + ")");
    await db.$disconnect();
    process.exit(1);
  }

  const currentSnapPrice = Number(spp.price);
  const currentFullPrice = Number(spp.fullPrice);
  const masterPrice = OVERRIDE_TARGET_PRICE !== null ? OVERRIDE_TARGET_PRICE : Number(pkg.sellingPrice);
  const discount = Number(booking.discountAmount) || 0;

  // Compute TOP state
  const tops = booking.termOfPayments;
  var topTotalAll = 0;
  var topTotalPaid = 0;
  var topTotalUnpaid = 0;
  var unpaidTerms = [];
  for (var i = 0; i < tops.length; i++) {
    var t = tops[i];
    var amt = Number(t.amount);
    topTotalAll += amt;
    if (t.paymentStatus === "paid" || t.ackStatus === "acknowledged") {
      topTotalPaid += amt;
    } else if (t.paymentStatus === "unpaid" || t.paymentStatus === "partial") {
      if (t.ackStatus !== "acknowledged") {
        topTotalUnpaid += amt;
        unpaidTerms.push({ id: t.id, name: t.name, amount: amt, sortOrder: t.sortOrder });
      }
    }
  }

  const priceDelta = masterPrice - currentSnapPrice;
  const fullPriceDelta = masterPrice - currentFullPrice;

  // ─── REPORT ───────────────────────────────────────────────────────────────
  console.log("BOOKING:");
  console.log("  Customer      : " + booking.snapCustomer?.name);
  console.log("  BookingId     : " + booking.id);
  console.log("  PackageId     : " + booking.packageId);
  console.log("  Package       : " + pkg.packageName);
  console.log("");

  console.log("CURRENT SNAPSHOT:");
  console.log("  snap.price    : " + currentSnapPrice.toLocaleString("id-ID"));
  console.log("  snap.fullPrice: " + currentFullPrice.toLocaleString("id-ID"));
  console.log("  discount      : " + discount.toLocaleString("id-ID") + (booking.discountName ? " (" + booking.discountName + ")" : ""));
  console.log("  net saat ini  : " + (currentSnapPrice - discount).toLocaleString("id-ID"));
  console.log("");

  console.log("MASTER PACKAGE:");
  console.log("  sellingPrice  : " + masterPrice.toLocaleString("id-ID"));
  console.log("  net setelah discount: " + (masterPrice - discount).toLocaleString("id-ID"));
  console.log("");

  console.log("DELTA:");
  console.log("  price delta   : +" + priceDelta.toLocaleString("id-ID"));
  console.log("  fullPrice delta: +" + fullPriceDelta.toLocaleString("id-ID"));
  console.log("");

  console.log("TERM OF PAYMENTS:");
  for (var j = 0; j < tops.length; j++) {
    var top = tops[j];
    var locked = top.paymentStatus === "paid" || top.ackStatus === "acknowledged";
    var status = top.paymentStatus.padEnd(8);
    var ack = (top.ackStatus || "pending").padEnd(12);
    var name = (top.name + "                    ").slice(0, 25);
    var flag = locked ? "[LOCKED]" : "[EDITABLE]";
    console.log("  " + flag + " [" + status + "][ack:" + ack + "] " + name + " = " + Number(top.amount).toLocaleString("id-ID"));
  }
  console.log("  TOP total all : " + topTotalAll.toLocaleString("id-ID"));
  console.log("  TOP paid/locked: " + topTotalPaid.toLocaleString("id-ID"));
  console.log("  TOP unpaid pool: " + topTotalUnpaid.toLocaleString("id-ID"));
  console.log("");

  console.log("PLAN — what will be written to DB (snap_package_pricing ONLY):");
  console.log("  UPDATE snap_package_pricing");
  console.log("  WHERE bookingId = '" + booking.id + "'");
  console.log("  SET price     = " + masterPrice.toLocaleString("id-ID") + "  (was: " + currentSnapPrice.toLocaleString("id-ID") + ")");
  console.log("  SET fullPrice = " + masterPrice.toLocaleString("id-ID") + "  (was: " + currentFullPrice.toLocaleString("id-ID") + ")");
  console.log("");

  console.log("TOP ADJUSTMENT (NOT done by this script — manual action required):");
  if (priceDelta > 0) {
    console.log("  Price naik +" + priceDelta.toLocaleString("id-ID") + ". Unpaid pool perlu naik juga.");
    console.log("  Unpaid terms yang bisa diubah:");
    for (var k = 0; k < unpaidTerms.length; k++) {
      var ut = unpaidTerms[k];
      console.log("    - " + ut.name + " (id=" + ut.id + ") saat ini=" + ut.amount.toLocaleString("id-ID"));
    }
    var newPool = topTotalUnpaid + priceDelta;
    console.log("  Rekomendasi: naikkan total unpaid pool dari " + topTotalUnpaid.toLocaleString("id-ID") + " ke " + newPool.toLocaleString("id-ID"));
    console.log("  (Distribusi ke masing-masing term: gunakan edit booking atau Finance AR)");
  } else if (priceDelta === 0) {
    console.log("  Tidak ada perubahan harga — TOP tidak perlu diubah.");
  } else {
    console.log("  Price turun " + priceDelta.toLocaleString("id-ID") + ". Lihat adjustTermsForPriceChange di kode.");
  }
  console.log("");

  // ─── EXECUTE ──────────────────────────────────────────────────────────────
  if (!APPLY) {
    console.log("=".repeat(60));
    console.log("DRY RUN — tidak ada yang ditulis ke DB.");
    console.log("Untuk apply: node scripts/refresh-booking-price.cjs --apply");
    console.log("=".repeat(60));
    await db.$disconnect();
    return;
  }

  // Safety gate: refuse to run if priceDelta === 0
  if (priceDelta === 0 && fullPriceDelta === 0) {
    console.log("INFO: Tidak ada perubahan — snap.price sudah sama dengan master. Tidak ada yang perlu di-update.");
    await db.$disconnect();
    return;
  }

  console.log("APPLYING CHANGES TO PROD DB...");
  await db.$transaction([
    db.snapPackagePricing.update({
      where: { bookingId: booking.id },
      data: {
        price: masterPrice,
        fullPrice: masterPrice,
      },
    }),
  ]);

  console.log("SUCCESS: snap_package_pricing.price dan fullPrice diupdate ke " + masterPrice.toLocaleString("id-ID"));
  console.log("");
  console.log("REMINDER: TOP (term_of_payments) belum diubah. Sesuaikan lewat:");
  console.log("  - Edit booking di UI (drag + adjust amount), ATAU");
  console.log("  - Finance AR SET HARGA drawer untuk adjust TOP pool.");

  await db.$disconnect();
}

main().catch(function(e) {
  console.error("FATAL:", e.message);
  process.exit(1);
});
