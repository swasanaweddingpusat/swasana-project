/**
 * Seed 5 wedding bookings in August and 5 in December 2026.
 * Run: npm run db:seed:bookings-2026
 * Safe to re-run (checks & logs created IDs).
 */
import { prisma } from "./_client";
import { resolveApprovalSteps } from "../../lib/approval-flows";

async function main(): Promise<void> {
  // ── Resolve dependencies ─────────────────────────────────────────────────

  const venues = await prisma.venue.findMany({
    select: { id: true, name: true, code: true },
  });
  if (!venues.length) throw new Error("No venues found — run db:seed:brands-venues first.");

  const packages = await prisma.package.findMany({
    select: { id: true, packageName: true, venueId: true, pax: true, sellingPrice: true },
    where: { available: true },
    take: 10,
  });
  if (!packages.length) throw new Error("No packages found — run db:seed:packages first.");

  // sales & admin profiles
  const salesUser = await prisma.user.findFirst({
    where: { email: { contains: "sales" } },
    select: { id: true },
  }) ?? await prisma.user.findFirst({ select: { id: true } });
  const salesProfile = salesUser
    ? await prisma.profile.findUnique({ where: { userId: salesUser.id } })
    : null;
  if (!salesProfile) throw new Error("No user/profile found — run db:seed:users first.");
  const resolvedSalesProfile = salesProfile;

  const adminUser = await prisma.user.findFirst({
    where: { email: "admin@swasana.com" },
    select: { id: true },
  });
  const _adminProfile = adminUser
    ? await prisma.profile.findUnique({ where: { userId: adminUser.id } })
    : null;

  const paymentMethod = await prisma.paymentMethod.findFirst({
    select: { id: true },
  });

  const flow = (await resolveApprovalSteps("booking")) ?? [];

  // ── Helper: get or create a dummy customer ───────────────────────────────

  async function getOrCreateCustomer(name: string, idx: number) {
    const emailCpp = `dummy.customer${idx}@swasana-dev.com`;
    let cust = await prisma.customer.findFirst({ where: { name } });
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          name,
          emailCpp,
          emailCpw: null,
          mobileNumber: [`0812000000${idx}`],
          type: "Reguler",
          memberStatus: "Non-Member",
        },
      });
    }
    return cust;
  }

  // ── Booking definitions ──────────────────────────────────────────────────

  const SESSIONS: Array<"morning" | "evening" | "fullday"> = [
    "morning",
    "evening",
    "morning",
    "evening",
    "fullday",
  ];

  const AUGUST_DATES = [2, 9, 16, 23, 30].map((d) => new Date(`2026-08-${String(d).padStart(2, "0")}T00:00:00.000Z`));
  const DECEMBER_DATES = [5, 12, 19, 21, 27].map((d) => new Date(`2026-12-${String(d).padStart(2, "0")}T00:00:00.000Z`));

  const NAMES = [
    "Budi & Sari", "Andi & Dewi", "Reza & Fitri",
    "Hendra & Maya", "Doni & Ayu", "Fajar & Rina",
    "Yusuf & Lestari", "Bagas & Indah", "Rio & Putri", "Arif & Nisa",
  ];

  // ── Seed helper ──────────────────────────────────────────────────────────

  async function seedBooking(
    customerName: string,
    custIdx: number,
    bookingDate: Date,
    session: "morning" | "evening" | "fullday",
    venueIdx: number,
  ): Promise<void> {
    const customer = await getOrCreateCustomer(customerName, custIdx);
    const venue = venues[venueIdx % venues.length];
    const pkg = packages.find((p) => p.venueId === venue.id) ?? packages[venueIdx % packages.length];

    const booking = await prisma.booking.create({
      data: {
        bookingDate,
        eventDate: bookingDate,
        bookingStatus: "Pending",
        paymentStatus: "Belum Bayar",
        category: "WEDDINGS",
        weddingSession: session,
        weddingType: "Akad & Resepsi",
        salesId: resolvedSalesProfile.id,
        customerId: customer.id,
        venueId: venue.id,
        packageId: pkg.id,
        paymentMethodId: paymentMethod?.id ?? null,
      },
    });

    // Approval record (Manager → Finance)
    if (flow.length > 0) {
      const record = await prisma.approvalRecord.create({
        data: {
          module: "booking",
          entityId: booking.id,
          status: "pending",
          createdById: resolvedSalesProfile.id,
        },
      });

      for (const step of flow) {
        await prisma.approvalRecordStep.create({
          data: {
            recordId: record.id,
            stepOrder: step.sortOrder,
            approverType: "role",
            approverRoleId: step.approverRoleId,
            status: "pending",
          },
        });
      }
    }

    console.error(
      `✅ Booking: ${customerName} | ${bookingDate.toISOString().slice(0, 10)} | ${session} | ${venue.name}`,
    );
  }

  // ── Create 5 bookings in August 2026 ─────────────────────────────────────
  console.error("\n📅 August 2026 weddings:");
  for (let i = 0; i < 5; i++) {
    await seedBooking(NAMES[i], i + 1, AUGUST_DATES[i], SESSIONS[i], i);
  }

  // ── Create 5 bookings in December 2026 ───────────────────────────────────
  console.error("\n📅 December 2026 weddings:");
  for (let i = 0; i < 5; i++) {
    await seedBooking(NAMES[i + 5], i + 6, DECEMBER_DATES[i], SESSIONS[i], i + 2);
  }

  console.error("\n🎉 10 wedding bookings seeded (5 August + 5 December 2026)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
