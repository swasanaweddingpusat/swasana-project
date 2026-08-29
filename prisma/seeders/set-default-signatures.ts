import { prisma } from "./_client";
import * as fs from "fs";
import * as path from "path";

const TARGET_NAMES = ["fadil prawidigdya", "chairunissa syifa pradyta"];

async function main() {
  const results: Array<{
    fullName: string;
    profileId: string;
    source: string;
    sourceId: string;
    signature: string;
  }> = [];

  for (const name of TARGET_NAMES) {
    console.log(`\n--- Mencari profile "${name}" ---`);

    const profile = await prisma.profile.findFirst({
      where: { fullName: { contains: name, mode: "insensitive" } },
      select: { id: true, userId: true, fullName: true, defaultSignature: true },
    });

    if (!profile) {
      console.error(`Profile dengan nama "${name}" tidak ditemukan.`);
      continue;
    }

    console.log(`Ditemukan: ${profile.fullName} (profileId: ${profile.id})`);

    if (profile.defaultSignature) {
      console.log(`${profile.fullName} sudah punya defaultSignature.`);
      results.push({
        fullName: profile.fullName!,
        profileId: profile.id,
        source: "existing-default",
        sourceId: profile.id,
        signature: profile.defaultSignature,
      });
      continue;
    }

    // Cari ttd dari Booking (salesSignature) terbaru
    const booking = await prisma.booking.findFirst({
      where: { salesId: profile.id, salesSignature: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, salesSignature: true },
    });

    if (booking?.salesSignature) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { defaultSignature: booking.salesSignature },
      });
      console.log(`${profile.fullName} — defaultSignature diset dari Booking ${booking.id}`);
      results.push({
        fullName: profile.fullName!,
        profileId: profile.id,
        source: "booking",
        sourceId: booking.id,
        signature: booking.salesSignature,
      });
      continue;
    }

    // Fallback: cari ttd dari Quotation (signatureSales) terbaru
    const quotation = await prisma.quotation.findFirst({
      where: { salesId: profile.id, signatureSales: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, signatureSales: true },
    });

    if (quotation?.signatureSales) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { defaultSignature: quotation.signatureSales },
      });
      console.log(`${profile.fullName} — defaultSignature diset dari Quotation ${quotation.id}`);
      results.push({
        fullName: profile.fullName!,
        profileId: profile.id,
        source: "quotation",
        sourceId: quotation.id,
        signature: quotation.signatureSales,
      });
      continue;
    }

    // Fallback: cari dari Booking MICE category
    const micebooking = await prisma.booking.findFirst({
      where: {
        salesId: profile.id,
        salesSignature: { not: null },
        category: "MICE",
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, salesSignature: true },
    });

    if (micebooking?.salesSignature) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { defaultSignature: micebooking.salesSignature },
      });
      console.log(`${profile.fullName} — defaultSignature diset dari MICE Booking ${micebooking.id}`);
      results.push({
        fullName: profile.fullName!,
        profileId: profile.id,
        source: "mice-booking",
        sourceId: micebooking.id,
        signature: micebooking.salesSignature,
      });
      continue;
    }

    // Fallback: cari signature dari booking manapun dimana user ini terlibat sebagai manager
    const managedBooking = await prisma.booking.findFirst({
      where: {
        managerId: profile.id,
        salesSignature: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, salesSignature: true },
    });

    if (managedBooking?.salesSignature) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { defaultSignature: managedBooking.salesSignature },
      });
      console.log(`${profile.fullName} — defaultSignature diset dari managed Booking ${managedBooking.id}`);
      results.push({
        fullName: profile.fullName!,
        profileId: profile.id,
        source: "managed-booking",
        sourceId: managedBooking.id,
        signature: managedBooking.salesSignature,
      });
      continue;
    }

    console.warn(`${profile.fullName} — tidak ada ttd ditemukan di Booking maupun Quotation.`);
  }

  // Export SQL format
  if (results.length > 0) {
    const sqlLines = results.map((r) => {
      const escaped = r.signature.replace(/'/g, "''");
      return `-- ${r.fullName} (source: ${r.source}, sourceId: ${r.sourceId})\nUPDATE "Profile" SET "defaultSignature" = '${escaped}' WHERE "id" = '${r.profileId}';`;
    });

    const sqlContent = `-- Generated: ${new Date().toISOString()}
-- Set default signatures for: ${results.map((r) => r.fullName).join(", ")}
-- Jalankan SQL ini di DB target untuk replace signature

BEGIN;

${sqlLines.join("\n\n")}

COMMIT;
`;

    const outPath = path.join(__dirname, "output-signatures.sql");
    fs.writeFileSync(outPath, sqlContent, "utf-8");
    console.log(`\nSQL exported ke: ${outPath}`);

    // Also export JSON with raw signature data
    const jsonData = results.map((r) => ({
      fullName: r.fullName,
      profileId: r.profileId,
      source: r.source,
      sourceId: r.sourceId,
      signatureDataUrl: r.signature,
    }));

    const jsonPath = path.join(__dirname, "output-signatures.json");
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), "utf-8");
    console.log(`JSON exported ke: ${jsonPath}`);
  }

  console.log("\nSelesai.");
}

if (process.argv[1]?.includes("set-default-signatures")) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
