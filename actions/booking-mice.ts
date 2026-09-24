"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence } from "@/lib/counter";
import { resolveManagerId } from "@/lib/resolve-manager";
import { buildBookingApprovalSteps } from "@/lib/approval-flows";
import { generateAccessCode } from "@/lib/access-code";
import { canAccessBooking } from "@/lib/access-control";
import { getUnconvertedQuotation, hasMiceSlotConflict, isQuotationApproved } from "@/lib/miceBookingIntegrity";
import {
  createMiceBookingSchema,
  updateMiceBookingSchema,
  markMiceLostSchema,
} from "@/lib/validations/booking-mice";

export async function createMiceBooking(
  data: unknown
): Promise<{ success: boolean; error?: string; data?: { id: string } }> {
  const { session, error } = await requirePermission({
    module: "booking-mice",
    action: "create",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createMiceBookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const input = parsed.data;

  // Sales auto-detect: use explicit salesId if provided (admin assigning on behalf),
  // otherwise fall back to the caller's own profile.
  const salesId = input.salesId ?? session!.user.profileId ?? null;
  if (!salesId) return { success: false, error: "Sales wajib dipilih." };

  try {
    const [venue, eventType] = await Promise.all([
      db.venue.findUniqueOrThrow({ where: { id: input.venueId }, include: { brand: true } }),
      db.eventType.findUniqueOrThrow({ where: { id: input.eventTypeId }, select: { code: true, name: true } }),
    ]);

    if (input.quotationId) {
      const quotationGate = await getUnconvertedQuotation(input.quotationId);
      if (!quotationGate.valid) return { success: false, error: quotationGate.error };
      if (!(await isQuotationApproved(input.quotationId))) {
        return { success: false, error: "Quotation harus fully approved sebelum dijadikan booking." };
      }
    }
    const eventDate = new Date(`${input.eventDate}T00:00:00.000Z`);
    const eventEndDate = input.eventEndDate
      ? new Date(`${input.eventEndDate}T00:00:00.000Z`)
      : null;
    if (await hasMiceSlotConflict({ venueId: input.venueId, eventDate, eventEndDate })) {
      return { success: false, error: "Slot venue pada tanggal tersebut sudah dibooking." };
    }

    const now = new Date();
    const year = now.getFullYear();
    const poSeq = await getNextSequence(`po-${year}`);
    const dd = now.getDate().toString().padStart(2, "0");
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const poNumber = `${poSeq.toString().padStart(3, "0")}/${venue.brand?.code ?? ""}/${venue.code}/${eventType.code}/${dd}-${mm}-${year}`;

    const bookingId = crypto.randomUUID();

    // ── Resolve customer ──────────────────────────────────────────────────────
    // Priority: explicit customerId → lead's converted customer / new from lead →
    // new from manual input. Avoids creating duplicate customers per MICE booking.
    let customerId: string;
    let isNewCustomer = false;
    let leadRecord: { id: string; convertedToCustomerId: string | null } | null = null;

    if (input.leadId) {
      leadRecord = await db.lead.findUnique({
        where: { id: input.leadId },
        select: { id: true, convertedToCustomerId: true },
      });
      if (!leadRecord) return { success: false, error: "Lead tidak ditemukan." };
      if (leadRecord.convertedToCustomerId) {
        customerId = leadRecord.convertedToCustomerId;
        const exists = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
        if (!exists) return { success: false, error: "Customer dari lead tidak ditemukan." };
      } else {
        customerId = crypto.randomUUID();
        isNewCustomer = true;
      }
    } else if (input.customerId) {
      const exists = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
      if (!exists) return { success: false, error: "Customer tidak ditemukan." };
      customerId = input.customerId;
    } else {
      customerId = crypto.randomUUID();
      isNewCustomer = true;
    }

    const managerId = await resolveManagerId(salesId);

    // Resolve "Deal" lead status (system final) — used when booking is created from a lead
    const convertedStatus = leadRecord
      ? await db.leadStatus.findFirst({
          where: { isSystem: true, isFinal: true },
          select: { id: true },
        })
      : null;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      ...(isNewCustomer
        ? [
            db.customer.create({
              data: {
                id: customerId,
                name: input.clientName,
                mobileNumber: [{ number: input.clientPhone }],
                emailCpp: input.emailCpp || null,
                emailCpw: input.emailCpw || null,
                type: "mice",
                memberStatus: "Non-Member",
                sourceOfInformationId: input.sourceOfInformationId ?? null,
                updatedBy: session!.user.name ?? session!.user.email ?? null,
              },
            }),
          ]
        : []),
      // Lead conversion tracking — mirror wedding flow
      ...(leadRecord
        ? [
            db.lead.update({
              where: { id: leadRecord.id },
              data: {
                convertedToBookingId: bookingId,
                ...(leadRecord.convertedToCustomerId
                  ? {}
                  : { convertedToCustomerId: customerId, convertedAt: new Date() }),
                // Always move lead to "Deal" status when a booking is created from it
                ...(convertedStatus ? { statusId: convertedStatus.id } : {}),
              },
            }),
          ]
        : []),
      db.booking.create({
        data: {
          id: bookingId,
          category: "MICE",
          eventDate,
          eventEndDate,
          eventTypeId: input.eventTypeId,
          eventTypeName: eventType.name,
          estimatedPax: input.estimatedPax ?? null,
          companyName: input.companyName ?? null,
          notes: input.notes ?? null,
          salesId,
          managerId,
          customerId,
          venueId: input.venueId,
          packageId: null,
          sourceOfInformationId: input.sourceOfInformationId ?? null,
          quotationId: input.quotationId ?? null,
          salesSignature: input.salesSignature ?? null,
          signingLocation: input.signingLocation ?? null,
          poNumber,
        },
      }),
      ...input.terms.map((t, i) =>
        db.termOfPayment.create({
          data: {
            bookingId,
            name: t.name,
            amount: t.amount,
            dueDate: new Date(t.dueDate),
            sortOrder: t.sortOrder ?? i,
          },
        })
      ),
    ];

    // Resolve approval steps for booking-mice flow
    const bookingApprovalSteps = await buildBookingApprovalSteps({
      module: "booking-mice",
      salesId,
      creatorProfileId: session!.user.profileId!,
      signatureSales: input.salesSignature ?? null,
      decidedAt: new Date(),
      includeClientStep: false, // MICE has no client TTD step
    });

    if (!bookingApprovalSteps || bookingApprovalSteps.length === 0) {
      return { success: false, error: "Alur approval Booking MICE belum dikonfigurasi." };
    }
    {
      const approvalRecordId = crypto.randomUUID();
      ops.push(
        db.approvalRecord.create({
          data: {
            id: approvalRecordId,
            module: "booking-mice",
            entityId: bookingId,
            status: "pending",
            createdById: session!.user.profileId!,
          },
        }),
        ...bookingApprovalSteps.map((step) =>
          db.approvalRecordStep.create({
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
          })
        )
      );
    }

    const hdrs = await headers();
    ops.push(
      db.clientAgreement.create({
        data: {
          bookingId,
          token: crypto.randomUUID(),
          accessCode: generateAccessCode(),
        },
      }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "booking_mice.created",
          entityType: "booking",
          entityId: bookingId,
          result: "success",
          description: `Created MICE booking for ${input.clientName}`,
          ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
          userAgent: hdrs.get("user-agent") ?? undefined,
        },
      }),
    );

    await db.$transaction(ops);

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    if (leadRecord) revalidateTag("daily-activity", "max");

    return { success: true, data: { id: bookingId } };
  } catch (e) {
    console.error("[createMiceBooking]", e);
    return { success: false, error: "Gagal menyimpan booking MICE." };
  }
}

export async function convertApprovedQuotationToMiceBooking(
  quotationId: string,
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "booking-mice", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-convert-quotation:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }
  if (!quotationId) return { success: false, error: "ID quotation wajib ada." };

  try {
    const quotationGate = await getUnconvertedQuotation(quotationId);
    if (!quotationGate.valid) return { success: false, error: quotationGate.error };
    if (!(await isQuotationApproved(quotationId))) {
      return { success: false, error: "Quotation harus fully approved sebelum dijadikan booking." };
    }

    const quotation = await db.quotation.findUnique({
      where: { id: quotationId },
      include: {
        terms: { orderBy: { sortOrder: "asc" } },
        items: { orderBy: { sortOrder: "asc" } },
        complimentaries: { orderBy: { sortOrder: "asc" } },
        bonuses: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!quotation) return { success: false, error: "Quotation tidak ditemukan." };
    if (!quotation.venueId || !quotation.eventTypeId || !quotation.eventDate) {
      return { success: false, error: "Venue, tipe event, dan tanggal quotation wajib lengkap." };
    }
    if (quotation.terms.length === 0 || quotation.terms.some((term) => term.amount <= 0 || !term.dueDate)) {
      return { success: false, error: "Semua TOP wajib memiliki nominal dan tanggal jatuh tempo." };
    }
    if (await hasMiceSlotConflict({
      venueId: quotation.venueId,
      eventDate: quotation.eventDate,
      eventEndDate: quotation.eventEndDate,
    })) {
      return { success: false, error: "Slot venue pada tanggal quotation sudah dibooking." };
    }

    const [managerId, livePackage, venue, eventType] = await Promise.all([
      resolveManagerId(quotation.salesId),
      quotation.packageId
        ? db.package.findUnique({ where: { id: quotation.packageId }, select: { id: true } })
        : Promise.resolve(null),
      db.venue.findUnique({
        where: { id: quotation.venueId },
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          description: true,
          brand: { select: { name: true, code: true } },
        },
      }),
      db.eventType.findUnique({
        where: { id: quotation.eventTypeId },
        select: { id: true, name: true, code: true },
      }),
    ]);
    if (!venue || !eventType) {
      return { success: false, error: "Venue atau tipe event quotation sudah tidak tersedia." };
    }

    const approvalSteps = await buildBookingApprovalSteps({
      module: "booking-mice",
      salesId: quotation.salesId,
      creatorProfileId: session!.user.profileId!,
      signatureSales: quotation.signatureSales,
      decidedAt: new Date(),
      includeClientStep: false,
    });
    if (!approvalSteps || approvalSteps.length === 0) {
      return { success: false, error: "Alur approval Booking MICE belum dikonfigurasi." };
    }

    const now = new Date();
    const year = now.getFullYear();
    const poSeq = await getNextSequence(`po-${year}`);
    const dd = now.getDate().toString().padStart(2, "0");
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const poNumber = `${poSeq.toString().padStart(3, "0")}/${venue.brand?.code ?? ""}/${venue.code}/${eventType.code}/${dd}-${mm}-${year}`;
    const bookingId = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    const approvalRecordId = crypto.randomUUID();
    const hdrs = await headers();

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.customer.create({
        data: {
          id: customerId,
          name: quotation.clientName,
          mobileNumber: [{ number: quotation.clientPhone }],
          type: "mice",
          memberStatus: "Non-Member",
          notes: quotation.instansi ? `Instansi: ${quotation.instansi}` : null,
          updatedBy: session!.user.name ?? session!.user.email ?? null,
        },
      }),
      db.booking.create({
        data: {
          id: bookingId,
          category: "MICE",
          recordStatus: "saved",
          bookingStatus: "Pending",
          eventDate: quotation.eventDate,
          eventEndDate: quotation.eventEndDate,
          eventTypeId: eventType.id,
          eventTypeName: quotation.eventTypeName ?? eventType.name,
          estimatedPax: quotation.pax || null,
          companyName: quotation.instansi,
          eventTime: quotation.time,
          notes: quotation.notes,
          dealingDate: now,
          quotationId: quotation.id,
          salesId: quotation.salesId,
          managerId,
          customerId,
          venueId: venue.id,
          packageId: livePackage?.id ?? null,
          paymentMethodId: quotation.paymentMethodId,
          salesSignature: quotation.signatureSales,
          signingLocation: quotation.signingLocation,
          discountName: quotation.discountName,
          discountAmount: quotation.discount,
          poNumber,
          poYear: year,
          poSeq,
        },
      }),
      db.snapCustomer.create({
        data: {
          bookingId,
          customerId,
          name: quotation.clientName,
          mobileNumber: quotation.clientPhone,
        },
      }),
      db.snapVenue.create({
        data: {
          bookingId,
          venueId: venue.id,
          venueName: quotation.venueName ?? venue.name,
          address: venue.address,
          description: venue.description,
          brandName: venue.brand?.name ?? null,
          brandCode: venue.brand?.code ?? null,
        },
      }),
      ...quotation.items.map((item) => db.snapPackageInternalItem.create({
        data: {
          bookingId,
          itemName: item.title,
          itemDescription: item.description ?? "",
          sortOrder: item.sortOrder,
        },
      })),
      ...quotation.complimentaries.map((item) => db.snapComplimentary.create({
        data: {
          bookingId,
          complimentaryId: item.complimentaryId,
          name: item.name,
          price: item.price,
          isShowPrice: item.isShowPrice,
          description: item.description,
          qty: item.qty,
          sortOrder: item.sortOrder,
        },
      })),
      ...quotation.bonuses.map((item) => db.snapBookingBonus.create({
        data: {
          bookingId,
          bonusId: item.bonusId,
          name: item.name,
          price: item.price,
          description: item.description,
          qty: item.qty,
          sortOrder: item.sortOrder,
        },
      })),
      ...quotation.terms.map((term) => db.termOfPayment.create({
        data: {
          bookingId,
          name: term.name,
          amount: term.amount,
          dueDate: term.dueDate!,
          sortOrder: term.sortOrder,
        },
      })),
      db.approvalRecord.create({
        data: {
          id: approvalRecordId,
          module: "booking-mice",
          entityId: bookingId,
          status: "pending",
          createdById: session!.user.profileId!,
        },
      }),
      ...approvalSteps.map((step) => db.approvalRecordStep.create({
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
      })),
      db.clientAgreement.create({
        data: { bookingId, token: crypto.randomUUID(), accessCode: generateAccessCode() },
      }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "booking_mice.created_from_quotation",
          entityType: "booking",
          entityId: bookingId,
          result: "success",
          description: `${quotation.quotationNo ?? quotation.id} dikonversi ke ${poNumber}`,
          changes: { quotationId: quotation.id },
          ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
          userAgent: hdrs.get("user-agent") ?? undefined,
        },
      }),
    ];

    if (livePackage && quotation.packageName) {
      ops.push(
        db.snapPackage.create({
          data: {
            bookingId,
            packageId: livePackage.id,
            packageName: quotation.packageName,
            notes: quotation.details,
          },
        }),
        db.snapPackagePricing.create({
          data: {
            bookingId,
            packageId: livePackage.id,
            packageName: quotation.packageName,
            pax: quotation.pax,
            price: quotation.totalPrice,
            fullPrice: quotation.subtotal,
            termAndCondition: quotation.termAndCondition,
          },
        }),
      );
    }

    await db.$transaction(ops);
    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    revalidateTag("quotations", "max");
    return { success: true, data: { id: bookingId } };
  } catch (caught) {
    const code = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "";
    if (code === "P2002" || code === "23505") {
      return { success: false, error: "Quotation ini sudah terhubung ke booking lain." };
    }
    console.error("[convertApprovedQuotationToMiceBooking]", caught);
    return { success: false, error: "Gagal mengonversi quotation menjadi Booking MICE." };
  }
}

export async function updateMiceBooking(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({
    module: "booking-mice",
    action: "edit",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateMiceBookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { id, ...input } = parsed.data;

  const existing = await db.booking.findFirst({
    where: { id, category: "MICE", recordStatus: "saved" },
    select: {
      id: true,
      customerId: true,
      quotationId: true,
      venueId: true,
      eventDate: true,
      eventEndDate: true,
      eventTypeId: true,
      estimatedPax: true,
      salesId: true,
    },
  });
  if (!existing) return { success: false, error: "Booking MICE tidak ditemukan." };
  if (!session!.user.profileId || !(await canAccessBooking(
    session!.user.profileId,
    session!.user.dataScope ?? "own",
    id,
  ))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const nextVenueId = input.venueId ?? existing.venueId;
    const nextEventDate = input.eventDate
      ? new Date(`${input.eventDate}T00:00:00.000Z`)
      : existing.eventDate;
    const nextEventEndDate = input.eventEndDate !== undefined
      ? (input.eventEndDate ? new Date(`${input.eventEndDate}T00:00:00.000Z`) : null)
      : existing.eventEndDate;
    if (nextEventDate && await hasMiceSlotConflict({
      venueId: nextVenueId,
      eventDate: nextEventDate,
      eventEndDate: nextEventEndDate,
      excludeBookingId: id,
    })) {
      return { success: false, error: "Slot venue pada tanggal tersebut sudah dibooking." };
    }

    const eventType = input.eventTypeId
      ? await db.eventType.findUnique({ where: { id: input.eventTypeId }, select: { id: true, name: true } })
      : null;
    if (input.eventTypeId && !eventType) return { success: false, error: "Tipe event tidak ditemukan." };

    const materialChanged =
      input.clientName !== undefined ||
      input.clientPhone !== undefined ||
      input.companyName !== undefined ||
      input.venueId !== undefined ||
      input.eventDate !== undefined ||
      input.eventEndDate !== undefined ||
      input.eventTypeId !== undefined ||
      input.estimatedPax !== undefined ||
      input.salesId !== undefined ||
      input.terms !== undefined;
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // Update customer fields
    const customerUpdate: Record<string, unknown> = {};
    if (input.clientName !== undefined) customerUpdate.name = input.clientName;
    if (input.clientPhone !== undefined)
      customerUpdate.mobileNumber = [{ number: input.clientPhone }];
    if (input.emailCpp !== undefined) customerUpdate.emailCpp = input.emailCpp || null;
    if (input.emailCpw !== undefined) customerUpdate.emailCpw = input.emailCpw || null;
    if (input.sourceOfInformationId !== undefined)
      customerUpdate.sourceOfInformationId = input.sourceOfInformationId ?? null;
    if (Object.keys(customerUpdate).length > 0) {
      customerUpdate.updatedBy = session!.user.name ?? session!.user.email ?? null;
      ops.push(db.customer.update({ where: { id: existing.customerId }, data: customerUpdate }));
    }

    // Update booking fields
    const bookingUpdate: Record<string, unknown> = {};
    if (input.eventDate !== undefined) bookingUpdate.eventDate = new Date(`${input.eventDate}T00:00:00.000Z`);
    if (input.eventEndDate !== undefined) bookingUpdate.eventEndDate = input.eventEndDate ? new Date(`${input.eventEndDate}T00:00:00.000Z`) : null;
    if (input.eventTypeId !== undefined) {
      bookingUpdate.eventTypeId = input.eventTypeId;
      bookingUpdate.eventTypeName = eventType?.name ?? null;
    }
    if (input.estimatedPax !== undefined) bookingUpdate.estimatedPax = input.estimatedPax ?? null;
    if (input.companyName !== undefined) bookingUpdate.companyName = input.companyName ?? null;
    if (input.notes !== undefined) bookingUpdate.notes = input.notes || null;
    if (input.venueId !== undefined) bookingUpdate.venueId = input.venueId;
    if (input.sourceOfInformationId !== undefined)
      bookingUpdate.sourceOfInformationId = input.sourceOfInformationId ?? null;
    if (input.salesId !== undefined) bookingUpdate.salesId = input.salesId ?? session!.user.profileId;
    if (input.salesSignature !== undefined)
      bookingUpdate.salesSignature = input.salesSignature ?? null;
    if (input.signingLocation !== undefined)
      bookingUpdate.signingLocation = input.signingLocation ?? null;
    if (materialChanged) bookingUpdate.bookingStatus = "Pending";
    if (Object.keys(bookingUpdate).length > 0) {
      ops.push(db.booking.update({ where: { id }, data: bookingUpdate }));
    }

    // Replace term of payments atomically when terms array is provided
    if (input.terms && input.terms.length > 0) {
      ops.push(
        db.termOfPayment.deleteMany({ where: { bookingId: id } }),
        ...input.terms.map((t, i) =>
          db.termOfPayment.create({
            data: {
              bookingId: id,
              name: t.name,
              amount: t.amount,
              dueDate: new Date(t.dueDate),
              sortOrder: t.sortOrder ?? i,
            },
          })
        )
      );
    }

    if (materialChanged) {
      ops.push(
        db.approvalRecord.updateMany({
          where: { module: "booking-mice", entityId: id },
          data: { status: "pending", updatedById: session!.user.profileId! },
        }),
        db.approvalRecordStep.updateMany({
          where: { record: { module: "booking-mice", entityId: id } },
          data: {
            status: "pending",
            decidedById: null,
            decidedAt: null,
            notes: null,
            signature: null,
          },
        }),
      );
    }

    if (ops.length > 0) {
      const hdrs = await headers();
      ops.push(
        db.activityLog.create({
          data: {
            userId: session!.user.profileId!,
            action: "booking_mice.updated",
            entityType: "booking",
            entityId: id,
            result: "success",
            description: "Updated MICE booking",
            ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
            userAgent: hdrs.get("user-agent") ?? undefined,
          },
        }),
      );
      await db.$transaction(ops);
    }

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");

    return { success: true };
  } catch (e) {
    console.error("[updateMiceBooking]", e);
    return { success: false, error: "Gagal memperbarui booking MICE." };
  }
}

export async function deleteMiceBooking(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({
    module: "booking-mice",
    action: "delete",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const existing = await db.booking.findFirst({
    where: { id, category: "MICE", recordStatus: "saved" },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "Booking MICE tidak ditemukan." };
  if (!session!.user.profileId || !(await canAccessBooking(session!.user.profileId, session!.user.dataScope ?? "own", id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const hdrs = await headers();
    await db.$transaction([
      // Remove non-cascade relations first (module+entityId pattern, no FK)
      db.approvalRecord.deleteMany({
        where: { module: { in: ["booking", "booking-mice"] }, entityId: id },
        // ApprovalRecordStep cascades from ApprovalRecord (onDelete: Cascade in schema)
      }),
      db.notification.deleteMany({
        where: { entityType: { in: ["booking", "booking-mice"] }, entityId: id },
      }),
      // ActivityLog is the audit trail — intentionally preserved after entity deletion
      // Cascade handles TermOfPayment, BookingDocument, ClientAgreement, etc.
      db.booking.delete({ where: { id } }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "booking_mice.deleted",
          entityType: "booking",
          entityId: id,
          result: "success",
          description: "Deleted MICE booking",
          ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
          userAgent: hdrs.get("user-agent") ?? undefined,
        },
      }),
    ]);

    revalidateTag("bookings", "max");

    return { success: true };
  } catch (e) {
    console.error("[deleteMiceBooking]", e);
    return { success: false, error: "Gagal menghapus booking MICE." };
  }
}

export async function markMiceLost(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({
    module: "booking-mice",
    action: "mark-lost",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-lost:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = markMiceLostSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const existing = await db.booking.findFirst({
    where: { id: input.id, category: "MICE", recordStatus: "saved" },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "Booking MICE tidak ditemukan." };
  if (!session!.user.profileId || !(await canAccessBooking(session!.user.profileId, session!.user.dataScope ?? "own", input.id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const hdrs = await headers();
    await db.$transaction([
      db.booking.update({
        where: { id: input.id },
        data: {
          bookingStatus: "Lost",
          lostReason: input.lostReason ?? null,
        },
      }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "booking_mice.lost",
          entityType: "booking",
          entityId: input.id,
          result: "success",
          description: `MICE booking marked as lost. Reason: ${input.lostReason ?? "—"}`,
          ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
          userAgent: hdrs.get("user-agent") ?? undefined,
        },
      }),
    ]);

    revalidateTag("bookings", "max");

    return { success: true };
  } catch (e) {
    console.error("[markMiceLost]", e);
    return { success: false, error: "Gagal mengubah status booking MICE menjadi Lost." };
  }
}

export async function restoreMiceBooking(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({
    module: "booking-mice",
    action: "restore",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-restore:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const existing = await db.booking.findFirst({
    where: { id, category: "MICE", recordStatus: "saved" },
    select: { id: true, bookingStatus: true },
  });
  if (!existing) return { success: false, error: "Booking MICE tidak ditemukan." };
  if (!["Canceled", "Lost", "Rejected"].includes(existing.bookingStatus)) {
    return {
      success: false,
      error: "Hanya booking Canceled, Lost, atau Rejected yang bisa di-restore.",
    };
  }
  if (!session!.user.profileId || !(await canAccessBooking(session!.user.profileId, session!.user.dataScope ?? "own", id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const hdrs = await headers();
    await db.$transaction([
      db.booking.update({
        where: { id },
        data: {
          bookingStatus: "Pending",
          cancelReason: null,
          lostReason: null,
          rejectionNotes: null,
        },
      }),
      db.approvalRecord.updateMany({
        where: { module: "booking-mice", entityId: id },
        data: { status: "pending" },
      }),
      db.approvalRecordStep.updateMany({
        where: { record: { module: "booking-mice", entityId: id } },
        data: {
          status: "pending",
          decidedById: null,
          decidedAt: null,
          signature: null,
          notes: null,
        },
      }),
      db.clientAgreement.updateMany({
        where: { bookingId: id },
        data: { status: "Pending", signedAt: null, viewedAt: null },
      }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "booking_mice.restored",
          entityType: "booking",
          entityId: id,
          result: "success",
          description: `MICE booking restored from ${existing.bookingStatus}`,
          ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
          userAgent: hdrs.get("user-agent") ?? undefined,
        },
      }),
    ]);

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[restoreMiceBooking]", e);
    return { success: false, error: "Gagal me-restore booking MICE." };
  }
}

export async function cancelMiceBooking(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = markMiceLostSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const input = parsed.data;

  const { session, error } = await requirePermission({
    module: "booking-mice",
    action: "edit",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-cancel:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const existing = await db.booking.findFirst({
    where: { id: input.id, category: "MICE", recordStatus: "saved" },
    select: { id: true, bookingStatus: true },
  });
  if (!existing) return { success: false, error: "Booking MICE tidak ditemukan." };
  if (existing.bookingStatus === "Canceled") {
    return { success: false, error: "Booking sudah di-cancel." };
  }
  if (!session!.user.profileId || !(await canAccessBooking(session!.user.profileId, session!.user.dataScope ?? "own", input.id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const hdrs = await headers();
    await db.$transaction([
      db.booking.update({
        where: { id: input.id },
        data: {
          bookingStatus: "Canceled",
          cancelReason: input.lostReason ?? null,
        },
      }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "booking_mice.canceled",
          entityType: "booking",
          entityId: input.id,
          result: "success",
          description: `MICE booking canceled. Reason: ${input.lostReason ?? "—"}`,
          ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
          userAgent: hdrs.get("user-agent") ?? undefined,
        },
      }),
    ]);

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[cancelMiceBooking]", e);
    return { success: false, error: "Gagal meng-cancel booking MICE." };
  }
}
