/**
 * Seed 10 wedding bookings with full finalize descendants + first payment.
 * Run: npm run db:seed:bookings-bitrix
 * Safe to re-run (removes stale incomplete bookings, customers reused by bitrixId).
 *
 * Mirrors actions/booking.ts createBooking finalize flow:
 *   customer → booking → snapCustomer/snapVenue/snapPackage/snapPackagePricing
 *   → snap internal/vendor/category items → term of payments → approval record + steps
 *   → client agreement → booking revision + link currentRevisionId
 *   → first cash-in (Booking Fee 30%) + payment allocation + payment activity.
 */
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./_client";
import { buildBookingApprovalSteps, resolveApprovalSteps } from "../../lib/approval-flows";
import { createBookingRevision } from "../../lib/booking-revision";
import { generateAccessCode } from "../../lib/access-code";
import { getNextSequence } from "../../lib/counter";
import { computeFullPrice, calcFinalFromFullPrice } from "../../lib/package-prices";

interface BookingSeed {
  customerName: string;
  bitrixId: string;
  eventDate: Date;
  session: "morning" | "evening" | "fullday";
  weddingType: string;
}

async function main(): Promise<void> {
  // ── Cleanup: remove incomplete plain bookings created by the older seeder ──
  const staleBookings = await prisma.booking.findMany({
    where: {
      customer: { bitrixId: { startsWith: "B24-2026-" } },
      snapPackagePricing: { is: null },
    },
    select: { id: true },
  });
  if (staleBookings.length > 0) {
    await prisma.booking.deleteMany({ where: { id: { in: staleBookings.map((b) => b.id) } } });
    console.error(`🧹 Removed ${staleBookings.length} stale incomplete booking(s)`);
  }

  const venues = await prisma.venue.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      description: true,
      brand: { select: { name: true, code: true } },
    },
  });
  if (!venues.length) throw new Error("No venues found — run db:seed:brands-venues first.");

  const packages = await prisma.package.findMany({
    where: { available: true, category: "WEDDINGS" },
    select: {
      id: true,
      venueId: true,
      packageName: true,
      notes: true,
      pax: true,
      margin: true,
      sellingPrice: true,
      termAndCondition: true,
      vendorItems: true,
      internalItems: true,
      categoryPrices: true,
    },
    take: 10,
  });
  if (!packages.length) throw new Error("No packages found — run db:seed:packages first.");

  const salesUser =
    (await prisma.user.findFirst({
      where: { email: { contains: "sales" } },
      select: { id: true },
    })) ?? (await prisma.user.findFirst({ select: { id: true } }));
  if (!salesUser) throw new Error("No user found — run db:seed:users first.");

  const salesProfile = await prisma.profile.findUnique({
    where: { userId: salesUser.id },
  });
  if (!salesProfile) throw new Error("No profile found — run db:seed:users first.");

  const paymentMethod = await prisma.paymentMethod.findFirst({ select: { id: true } });
  const flow = await resolveApprovalSteps("booking");

  const BOOKINGS: BookingSeed[] = [
    { customerName: "Bima & Salsabila", bitrixId: "B24-2026-0001", eventDate: new Date("2026-08-02T00:00:00.000Z"), session: "morning", weddingType: "Akad & Resepsi" },
    { customerName: "Dimas & Nabila", bitrixId: "B24-2026-0002", eventDate: new Date("2026-08-09T00:00:00.000Z"), session: "evening", weddingType: "Resepsi" },
    { customerName: "Rizky & Laras", bitrixId: "B24-2026-0003", eventDate: new Date("2026-08-16T00:00:00.000Z"), session: "morning", weddingType: "Akad & Resepsi" },
    { customerName: "Fajar & Putri", bitrixId: "B24-2026-0004", eventDate: new Date("2026-08-23T00:00:00.000Z"), session: "evening", weddingType: "Akad" },
    { customerName: "Aldi & Nadia", bitrixId: "B24-2026-0005", eventDate: new Date("2026-08-30T00:00:00.000Z"), session: "fullday", weddingType: "Akad & Resepsi" },
    { customerName: "Yoga & Melati", bitrixId: "B24-2026-0006", eventDate: new Date("2026-12-05T00:00:00.000Z"), session: "evening", weddingType: "Resepsi" },
    { customerName: "Raka & Anindya", bitrixId: "B24-2026-0007", eventDate: new Date("2026-12-12T00:00:00.000Z"), session: "morning", weddingType: "Akad & Resepsi" },
    { customerName: "Galih & Ratna", bitrixId: "B24-2026-0008", eventDate: new Date("2026-12-19T00:00:00.000Z"), session: "evening", weddingType: "Akad" },
    { customerName: "Farhan & Tiara", bitrixId: "B24-2026-0009", eventDate: new Date("2026-12-21T00:00:00.000Z"), session: "fullday", weddingType: "Akad & Resepsi" },
    { customerName: "Naufal & Zahra", bitrixId: "B24-2026-0010", eventDate: new Date("2026-12-27T00:00:00.000Z"), session: "morning", weddingType: "Resepsi" },
  ];

  for (const [idx, def] of BOOKINGS.entries()) {
    const venue = venues[idx % venues.length];
    const pkg = packages.find((p) => p.venueId === venue.id) ?? packages[idx % packages.length];

    let customer = await prisma.customer.findFirst({
      where: { bitrixId: def.bitrixId },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: def.customerName,
          bitrixId: def.bitrixId,
          emailCpp: `customer${idx + 1}@swasana-dev.com`,
          mobileNumber: [`081200000${String(idx + 1).padStart(2, "0")}`],
          type: "Reguler",
          memberStatus: "Non-Member",
        },
      });
    }

    const bookingId = randomUUID();

    // PO number: {seq}/{brandCode}/{venueCode}/{eventTypeCode}/{dd-mm-yyyy}
    const year = new Date().getFullYear();
    const poSeq = await getNextSequence(`po-${year}`);
    const dd = def.eventDate.getUTCDate().toString().padStart(2, "0");
    const mm = (def.eventDate.getUTCMonth() + 1).toString().padStart(2, "0");
    const eventTypeCode = def.weddingType;
    const poNumber = `${poSeq.toString().padStart(3, "0")}/${venue.brand?.code ?? ""}/${venue.code}/${eventTypeCode}/${dd}-${mm}-${year}`;

    // Package pricing (takeout toggles default none)
    const fullPrice = computeFullPrice(pkg.categoryPrices, pkg.margin ?? 0, pkg.sellingPrice);
    const pkgPrice = calcFinalFromFullPrice(
      pkg.categoryPrices.map((c) => ({
        isShow: c.isShow,
        isTakeout: false,
        basePrice: c.basePrice,
        takeoutNominal: 0,
      })),
      fullPrice,
    );

    // Two-term schedule: 30% Booking Fee + 70% Pelunasan
    const bookingFee = Math.round(pkgPrice * 0.3);
    const pelunasan = pkgPrice - bookingFee;

    const approvalSteps = await buildBookingApprovalSteps({
      salesId: salesProfile.id,
      creatorProfileId: salesProfile.id,
      signatureSales: null,
      decidedAt: new Date(),
      includeClientStep: true,
    });

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.booking.create({
        data: {
          id: bookingId,
          eventDate: def.eventDate,
          bookingStatus: "Pending",
          paymentStatus: "Belum Bayar",
          category: "WEDDINGS",
          weddingSession: def.session,
          weddingType: def.weddingType,
          salesId: salesProfile.id,
          managerId: salesProfile.managerId ?? null,
          customerId: customer.id,
          venueId: venue.id,
          packageId: pkg.id,
          paymentMethodId: paymentMethod?.id ?? null,
          poNumber,
          poYear: year,
          poSeq,
        },
      }),
      prisma.snapCustomer.create({
        data: {
          bookingId,
          customerId: customer.id,
          name: customer.name,
          emailCpp: customer.emailCpp ?? null,
          emailCpw: customer.emailCpw ?? null,
          mobileNumber: Array.isArray(customer.mobileNumber)
            ? (customer.mobileNumber as Array<{ name?: string; number: string }>)
                .map((e) => (e.name ? `${e.name}: ${e.number}` : e.number))
                .join(", ")
            : String(customer.mobileNumber ?? ""),
          cppNik: customer.cppNik,
          cpwNik: customer.cpwNik,
          cppIdType: customer.cppIdType,
          cpwIdType: customer.cpwIdType,
          ktpAddress: customer.ktpAddress,
          cppAddress: customer.cppAddress,
          cpwAddress: customer.cpwAddress,
        },
      }),
      prisma.snapVenue.create({
        data: {
          bookingId,
          venueId: venue.id,
          venueName: venue.name,
          address: venue.address,
          description: venue.description,
          brandName: venue.brand?.name ?? null,
          brandCode: venue.brand?.code ?? null,
        },
      }),
      prisma.snapPackage.create({
        data: {
          bookingId,
          packageId: pkg.id,
          packageName: pkg.packageName,
          notes: pkg.notes,
        },
      }),
      prisma.snapPackagePricing.create({
        data: {
          bookingId,
          packageId: pkg.id,
          packageName: pkg.packageName,
          pax: pkg.pax,
          price: pkgPrice,
          fullPrice,
          margin: pkg.margin ?? 0,
          termAndCondition: pkg.termAndCondition ?? null,
        },
      }),
      ...pkg.internalItems.map((item, i) =>
        prisma.snapPackageInternalItem.create({
          data: { bookingId, itemName: item.itemName, itemDescription: item.itemDescription, sortOrder: i },
        }),
      ),
      ...pkg.vendorItems.map((item, i) =>
        prisma.snapPackageVendorItem.create({
          data: {
            bookingId,
            categoryId: item.categoryId ?? null,
            categoryName: item.categoryName,
            itemText: item.itemText,
            sortOrder: i,
            isTakeout: false,
          },
        }),
      ),
      ...pkg.categoryPrices.map((cp) =>
        prisma.snapPackageCategoryPrice.create({
          data: {
            bookingId,
            categoryId: cp.categoryId ?? null,
            categoryName: cp.categoryName,
            basePrice: cp.basePrice,
            sortOrder: cp.sortOrder,
            isShow: cp.isShow,
            isTakeout: false,
            takeoutNominal: 0,
          },
        }),
      ),
      prisma.termOfPayment.create({
        data: { bookingId, name: "Booking Fee", amount: bookingFee, dueDate: def.eventDate, sortOrder: 0 },
      }),
      prisma.termOfPayment.create({
        data: { bookingId, name: "Pelunasan", amount: pelunasan, dueDate: def.eventDate, sortOrder: 1 },
      }),
    ];

    // Approval record + steps (sales → manager → finance → client)
    if (approvalSteps && approvalSteps.length > 0) {
      const approvalRecordId = randomUUID();
      ops.push(
        prisma.approvalRecord.create({
          data: {
            id: approvalRecordId,
            module: "booking",
            entityId: bookingId,
            status: "pending",
            createdById: salesProfile.id,
          },
        }),
        ...approvalSteps.map((step) =>
          prisma.approvalRecordStep.create({
            data: {
              recordId: approvalRecordId,
              stepOrder: step.stepOrder,
              approverType: step.approverType,
              approverRoleId: step.approverRoleId,
              approverUserId: step.approverUserId,
              status: step.status,
              decidedById: step.decidedById,
              decidedAt: step.decidedAt,
              signature: step.signature,
            },
          }),
        ),
      );
    } else if (flow && flow.length > 0) {
      const approvalRecordId = randomUUID();
      ops.push(
        prisma.approvalRecord.create({
          data: { id: approvalRecordId, module: "booking", entityId: bookingId, status: "pending", createdById: salesProfile.id },
        }),
        ...flow.map((step) =>
          prisma.approvalRecordStep.create({
            data: {
              recordId: approvalRecordId,
              stepOrder: step.sortOrder,
              approverType: "role",
              approverRoleId: step.approverRoleId,
              status: "pending",
            },
          }),
        ),
      );
    }

    ops.push(
      prisma.clientAgreement.create({
        data: {
          bookingId,
          token: randomUUID(),
          accessCode: generateAccessCode(),
        },
      }),
    );

    await prisma.$transaction(ops);

    // Initial revision + link approval steps + set currentRevisionId
    const revisionId = await createBookingRevision(bookingId, salesProfile.id, "Initial booking");
    await prisma.$transaction([
      prisma.approvalRecordStep.updateMany({
        where: { record: { module: "booking", entityId: bookingId } },
        data: { revisionId },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { currentRevisionId: revisionId },
      }),
    ]);

    // First payment: Booking Fee (30%) cash-in, pending ack, allocated to term 0.
    const bookingFeeTerm = await prisma.termOfPayment.findFirst({
      where: { bookingId, sortOrder: 0 },
      select: { id: true },
    });
    if (bookingFeeTerm && bookingFee > 0) {
      const occurredAt = new Date();
      const kwitansiYear = occurredAt.getFullYear();
      const kwitansiMonth = (occurredAt.getMonth() + 1).toString().padStart(2, "0");
      const kwitansiSeq = await getNextSequence(`kwitansi-${kwitansiYear}`);
      const kwitansiNumber = `${kwitansiSeq.toString().padStart(4, "0")}/KW/${venue.brand?.code ?? ""}/${venue.code}/${kwitansiMonth}/${kwitansiYear}`;

      const ledgerId = randomUUID();
      await prisma.$transaction([
        prisma.ledger.create({
          data: {
            id: ledgerId,
            bookingId,
            direction: "in",
            ackStatus: "pending",
            paymentStatus: "paid",
            occurredAt,
            amount: bookingFee,
            cashAmount: bookingFee,
            paymentMethodId: paymentMethod?.id ?? null,
            invoiceNumber: kwitansiNumber,
            snapTopName: "Booking Fee",
            snapPackageName: pkg.packageName,
            snapVenueName: venue.name,
            createdById: salesProfile.id,
          },
        }),
        prisma.paymentAllocation.create({
          data: { ledgerId, termId: bookingFeeTerm.id, amount: bookingFee, showInPo: false },
        }),
        prisma.paymentActivity.create({
          data: {
            ledgerId,
            action: "created",
            actorId: salesProfile.id,
            actorNameSnapshot: salesProfile.fullName ?? salesProfile.email ?? "Sales",
            note: "Seed payment Booking Fee",
          },
        }),
      ]);
    }

    console.error(
      `✅ ${def.customerName} | ${def.bitrixId} | ${poNumber} | ${def.eventDate.toISOString().slice(0, 10)} | ${def.session} | ${venue.name}`,
    );
  }

  console.error("\n🎉 10 wedding bookings with full finalize descendants + first payment seeded");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
