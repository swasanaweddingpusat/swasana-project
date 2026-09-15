import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "./_client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupabaseDeal {
  id: number;
  created_at: string;
  namaClient: string;
  namaVenue: string;
  namaMarketing: string;
  namaPax: string | null;
  totalPax: number;
  jenisAcara: "Wedding" | "Non Wedding";
  tanggalBooking: string;
  tanggalAcara: string;
  sumberData: string | null;
  tanggalPelunasan: string | null;
  description: string | null;
  priority: string | null;
  user_id: string | null;
  completion_status: string | null;
  jenisBooking: "DP" | "Lunas" | "Soft Booking" | "Booking" | "Waiting List" | null;
  weddingType: string | null;
  waktuAcara: "Malam" | "Pagi" | "Full Day" | null;
  vendorCatering: string | null;
  vendorCateringNote: string | null;
  vendorDekorasi: string | null;
  vendorDekorasiNote: string | null;
  vendorRiasBusana: string | null;
  vendorRiasBusanaNote: string | null;
  vendorMUA: string | null;
  vendorMUANote: string | null;
  vendorPhotoVideo: string | null;
  vendorPhotoVideoNote: string | null;
  vendorEntertainment: string | null;
  vendorEntertainmentNote: string | null;
  vendorMC: string | null;
  vendorMCNote: string | null;
  vendorPhotobooth: string | null;
  vendorPhotoboothNote: string | null;
  vendorProsesiAdat: string | null;
  vendorProsesiAdatNote: string | null;
  vendorLiveStreaming: string | null;
  vendorLiveStreamingNote: string | null;
  vendorFoodstallMillenial: string | null;
  vendorFoodstallMillenialNote: string | null;
  noteLainnya: string | null;
  id_bitrix24: string | null;
  venueLokasi: string | null;
}

// ─── Venue name mapping (Supabase → target DB name) ─────────────────────────

const VENUE_NAME_MAP: Record<string, string> = {
  "Swasana Dharmagati": "Dharmagati",
  "Swasana Patrajasa": "Patrajasa",
  "Swasana Brin Thamrin": "BRIN Thamrin",
  "Swasana Brin Gatsu": "BRIN Gatot Subroto",
  "Swasana Seskoad": "Seskoad",
  "Swasana Lippo Kuningan": "Lippo Kuningan",
  "Swasana Grand Slipi": "Grand Slipi",
  "Gunawarman Bripens": "Menara Bripens",
  "Gunawarman Samisara": "Samisara Sopodel",
  "Pakubuwono": "Paramita",
  "Gunawarman Patrajasa": "Patrajasa",
  "Gunawarman Graha Paramita": "Paramita",
  "group:patrajasa": "Patrajasa",
};

const VENUES_TO_CREATE: { name: string; code: string; brandCode: string }[] = [
  { name: "Granadi", code: "GRANADI", brandCode: "SWN" },
  { name: "Graha Pertamina", code: "GRAHA-PERTAMINA", brandCode: "GNW" },
  { name: "Kartika Chandra", code: "KARTIKA", brandCode: "GNW" },
];

const VENUE_CREATE_MAP: Record<string, string> = {
  "Swasana Granadi": "Granadi",
  "Gunawarman Graha Pertamina": "Graha Pertamina",
  "Gunawarman Kartika Chandra": "Kartika Chandra",
};

// ─── Field mapping helpers ──────────────────────────────────────────────────

type BookingStatus = "Pending" | "Uploaded" | "Confirmed" | "Rejected" | "Canceled" | "Lost";
type WeddingSession = "morning" | "evening" | "fullday";
type EventCategory = "WEDDINGS" | "MICE";

function mapBookingStatus(deal: SupabaseDeal): BookingStatus {
  if (deal.jenisBooking === "DP" || deal.jenisBooking === "Lunas" || deal.jenisBooking === "Booking") {
    return "Confirmed";
  }
  if (deal.completion_status === "Completed") return "Confirmed";
  return "Pending";
}

function mapCategory(jenisAcara: string): EventCategory {
  return jenisAcara === "Wedding" ? "WEDDINGS" : "MICE";
}

function mapWeddingSession(waktuAcara: string | null): WeddingSession | null {
  if (!waktuAcara) return null;
  const map: Record<string, WeddingSession> = {
    Pagi: "morning",
    Malam: "evening",
    "Full Day": "fullday",
  };
  return map[waktuAcara] ?? null;
}

function buildVendorNotes(deal: SupabaseDeal): string {
  const lines: string[] = [];
  const vendors: [string, string | null, string | null][] = [
    ["Catering", deal.vendorCatering, deal.vendorCateringNote],
    ["Dekorasi", deal.vendorDekorasi, deal.vendorDekorasiNote],
    ["Rias & Busana", deal.vendorRiasBusana, deal.vendorRiasBusanaNote],
    ["MUA", deal.vendorMUA, deal.vendorMUANote],
    ["Photo & Video", deal.vendorPhotoVideo, deal.vendorPhotoVideoNote],
    ["Entertainment", deal.vendorEntertainment, deal.vendorEntertainmentNote],
    ["MC", deal.vendorMC, deal.vendorMCNote],
    ["Photobooth", deal.vendorPhotobooth, deal.vendorPhotoboothNote],
    ["Prosesi Adat", deal.vendorProsesiAdat, deal.vendorProsesiAdatNote],
    ["Live Streaming", deal.vendorLiveStreaming, deal.vendorLiveStreamingNote],
    ["Foodstall Millenial", deal.vendorFoodstallMillenial, deal.vendorFoodstallMillenialNote],
  ];

  for (const [label, name, note] of vendors) {
    const n = name?.trim();
    const nt = note?.trim();
    if (!n && !nt) continue;
    const parts = [n, nt ? `(${nt})` : ""].filter(Boolean).join(" ");
    lines.push(`${label}: ${parts}`);
  }

  return lines.join("\n");
}

function buildNotes(deal: SupabaseDeal): string {
  const parts: string[] = ["[Legacy Supabase] Migrated from Supabase calendar"];

  parts.push(`Supabase ID: ${deal.id}`);
  parts.push(`Marketing: ${deal.namaMarketing}`);
  parts.push(`Venue (original): ${deal.namaVenue}`);

  if (deal.jenisBooking) parts.push(`Jenis Booking: ${deal.jenisBooking}`);
  if (deal.tanggalPelunasan && deal.tanggalPelunasan !== "N/A") {
    parts.push(`Tgl Pelunasan: ${deal.tanggalPelunasan}`);
  }
  if (deal.namaPax && deal.namaPax !== "-") parts.push(`Nama Pax: ${deal.namaPax}`);
  if (deal.description) parts.push(`Deskripsi: ${deal.description}`);
  if (deal.priority) parts.push(`Prioritas: ${deal.priority}`);
  if (deal.completion_status) parts.push(`Status: ${deal.completion_status}`);
  if (deal.id_bitrix24) parts.push(`Bitrix ID: ${deal.id_bitrix24}`);
  if (deal.venueLokasi) parts.push(`Lokasi Venue: ${deal.venueLokasi}`);
  if (deal.noteLainnya?.trim()) parts.push(`Note: ${deal.noteLainnya.trim()}`);

  const vendorNotes = buildVendorNotes(deal);
  if (vendorNotes) {
    parts.push("--- Vendor ---");
    parts.push(vendorNotes);
  }

  return parts.join("\n");
}

// ─── Main migration ─────────────────────────────────────────────────────────

async function migrateDeals(): Promise<void> {
  const dataPath = resolve(__dirname, "data/supabase-deals.json");
  const raw = readFileSync(dataPath, "utf-8");
  const deals: SupabaseDeal[] = JSON.parse(raw);
  console.log(`📦 Loaded ${deals.length} deals from JSON`);

  // ── Step 1: Resolve venue mapping ──────────────────────────────────────

  const allVenues = await prisma.venue.findMany({ select: { id: true, name: true, code: true } });
  const venueByName = new Map(allVenues.map((v) => [v.name, v.id]));

  // Create missing venues
  for (const vc of VENUES_TO_CREATE) {
    if (!venueByName.has(vc.name)) {
      const brand = await prisma.brand.findFirst({ where: { code: vc.brandCode } });
      if (!brand) {
        console.error(`❌ Brand ${vc.brandCode} not found — cannot create venue ${vc.name}`);
        continue;
      }
      const venue = await prisma.venue.create({
        data: { name: vc.name, code: vc.code, brandId: brand.id, capacity: 800, isActive: true },
      });
      venueByName.set(venue.name, venue.id);
      console.log(`🏢 Created venue: ${vc.name} (${vc.code})`);
    }
  }

  // Build full Supabase→ID map
  const fullVenueMap: Record<string, string> = {};
  for (const [supabaseName, targetName] of Object.entries(VENUE_NAME_MAP)) {
    const id = venueByName.get(targetName);
    if (id) fullVenueMap[supabaseName] = id;
  }
  for (const [supabaseName, targetName] of Object.entries(VENUE_CREATE_MAP)) {
    const id = venueByName.get(targetName);
    if (id) fullVenueMap[supabaseName] = id;
  }

  // ── Step 2: Load profiles for sales matching ──────────────────────────

  const profiles = await prisma.profile.findMany({
    select: { id: true, fullName: true, nickName: true },
  });

  const profileByName = new Map<string, string>();
  for (const p of profiles) {
    if (p.fullName) profileByName.set(p.fullName.toLowerCase().trim(), p.id);
    if (p.nickName) profileByName.set(p.nickName.toLowerCase().trim(), p.id);
  }

  // ── Step 3: Create customers (batch by unique namaClient) ─────────────

  const customerGroups = new Map<string, SupabaseDeal>();
  for (const deal of deals) {
    const key = deal.namaClient.trim();
    if (!customerGroups.has(key)) customerGroups.set(key, deal);
  }

  console.log(`👥 ${customerGroups.size} unique customers to process`);

  const existingCustomers = await prisma.customer.findMany({
    where: { notes: { contains: "[Legacy Supabase]" } },
    select: { id: true, name: true },
  });
  const customerByName = new Map(existingCustomers.map((c) => [c.name, c.id]));

  let customersCreated = 0;
  const CUSTOMER_BATCH = 50;
  const customerEntries = Array.from(customerGroups.entries());

  for (let i = 0; i < customerEntries.length; i += CUSTOMER_BATCH) {
    const batch = customerEntries.slice(i, i + CUSTOMER_BATCH);
    const creates = batch
      .filter(([name]) => !customerByName.has(name))
      .map(([name, deal]) =>
        prisma.customer.create({
          data: {
            name,
            type: deal.jenisAcara === "Wedding" ? "Wedding" : "MICE",
            mobileNumber: [],
            memberStatus: "Non-Member",
            notes: "[Legacy Supabase] Migrated from Supabase calendar",
          },
        }),
      );

    if (creates.length > 0) {
      const created = await prisma.$transaction(creates);
      for (const c of created) customerByName.set(c.name, c.id);
      customersCreated += created.length;
    }
  }
  console.log(`✅ ${customersCreated} customers created (${existingCustomers.length} already existed)`);

  // ── Step 4: Create bookings ───────────────────────────────────────────

  let bookingsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const BOOKING_BATCH = 50;

  for (let i = 0; i < deals.length; i += BOOKING_BATCH) {
    const batch = deals.slice(i, i + BOOKING_BATCH);
    const creates = [];

    for (const deal of batch) {
      const venueId = fullVenueMap[deal.namaVenue];
      if (!venueId) {
        errors.push(`Deal #${deal.id}: venue "${deal.namaVenue}" not mapped`);
        skipped++;
        continue;
      }

      const customerId = customerByName.get(deal.namaClient.trim());
      if (!customerId) {
        errors.push(`Deal #${deal.id}: customer "${deal.namaClient}" not found`);
        skipped++;
        continue;
      }

      // Best-effort sales matching
      const marketingName = deal.namaMarketing?.trim().toLowerCase() ?? "";
      const salesId = profileByName.get(marketingName) ?? null;

      const category = mapCategory(deal.jenisAcara);
      const session = category === "WEDDINGS" ? mapWeddingSession(deal.waktuAcara) : null;

      creates.push(
        prisma.booking.create({
          data: {
            bookingStatus: mapBookingStatus(deal),
            recordStatus: "saved",
            paymentStatus: deal.jenisBooking === "Lunas" ? "Lunas" : "",
            category,
            weddingSession: session,
            weddingType: deal.weddingType ?? null,
            eventTime: deal.waktuAcara ?? null,
            notes: buildNotes(deal),
            eventDate: new Date(deal.tanggalAcara),
            customerId,
            venueId,
            salesId,
            createdAt: new Date(deal.created_at),
          },
        }),
      );
    }

    if (creates.length > 0) {
      try {
        await prisma.$transaction(creates);
        bookingsCreated += creates.length;
      } catch {
        // Fallback: insert one-by-one to find the bad row
        for (const create of creates) {
          try {
            await create;
            bookingsCreated++;
          } catch (singleErr) {
            const msg = singleErr instanceof Error ? singleErr.message : String(singleErr);
            errors.push(`Batch ${i}: ${msg}`);
            skipped++;
          }
        }
      }
    }

    if ((i + BOOKING_BATCH) % 200 === 0 || i + BOOKING_BATCH >= deals.length) {
      console.log(`  📊 Progress: ${Math.min(i + BOOKING_BATCH, deals.length)}/${deals.length}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════");
  console.log(`✅ Bookings created:  ${bookingsCreated}`);
  console.log(`⏭️  Skipped:           ${skipped}`);
  console.log(`👥 Customers created: ${customersCreated}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.log(`   ${e}`);
    if (errors.length > 20) console.log(`   ... and ${errors.length - 20} more`);
  }
  console.log("═══════════════════════════════════════");
}

// ─── Patch: create snapshots for migrated bookings ──────────────────────────

async function patchSnapshots(): Promise<void> {
  const migrated = await prisma.booking.findMany({
    where: {
      notes: { contains: "[Legacy Supabase]" },
      snapCustomer: null,
    },
    select: {
      id: true,
      customerId: true,
      venueId: true,
      customer: { select: { id: true, name: true, emailCpp: true, emailCpw: true, mobileNumber: true, cppNik: true, cpwNik: true, cppIdType: true, cpwIdType: true, ktpAddress: true, cppAddress: true, cpwAddress: true } },
      venue: { select: { id: true, name: true, address: true, description: true, brand: { select: { name: true, code: true } } } },
    },
  });

  if (migrated.length === 0) {
    console.log("✅ All migrated bookings already have snapshots");
    return;
  }

  console.log(`🔧 Patching ${migrated.length} bookings with snapshots...`);

  const BATCH = 50;
  let patched = 0;

  for (let i = 0; i < migrated.length; i += BATCH) {
    const batch = migrated.slice(i, i + BATCH);
    const ops = batch.flatMap((b) => [
      prisma.snapCustomer.create({
        data: {
          bookingId: b.id,
          customerId: b.customer.id,
          name: b.customer.name,
          emailCpp: b.customer.emailCpp,
          emailCpw: b.customer.emailCpw,
          mobileNumber: JSON.stringify(b.customer.mobileNumber),
          cppNik: b.customer.cppNik,
          cpwNik: b.customer.cpwNik,
          cppIdType: b.customer.cppIdType,
          cpwIdType: b.customer.cpwIdType,
          ktpAddress: b.customer.ktpAddress,
          cppAddress: b.customer.cppAddress,
          cpwAddress: b.customer.cpwAddress,
        },
      }),
      prisma.snapVenue.create({
        data: {
          bookingId: b.id,
          venueId: b.venue.id,
          venueName: b.venue.name,
          address: b.venue.address,
          description: b.venue.description,
          brandName: b.venue.brand?.name ?? null,
          brandCode: b.venue.brand?.code ?? null,
        },
      }),
    ]);

    await prisma.$transaction(ops);
    patched += batch.length;

    if (patched % 200 === 0 || patched >= migrated.length) {
      console.log(`  📊 Snapshots: ${patched}/${migrated.length}`);
    }
  }

  console.log(`✅ ${patched} bookings patched with snapCustomer + snapVenue`);
}

// ─── Run standalone ─────────────────────────────────────────────────────────

if (process.argv[1]?.includes("migrate-supabase-deals")) {
  const mode = process.argv[2];

  const run = mode === "--patch-snapshots"
    ? patchSnapshots
    : async () => { await migrateDeals(); await patchSnapshots(); };

  run()
    .catch((e) => {
      console.error("❌ Migration failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export { migrateDeals, patchSnapshots };
