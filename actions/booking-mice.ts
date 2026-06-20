"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence } from "@/lib/counter";
import { resolveManagerId } from "@/lib/resolve-manager";
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
      db.eventType.findUniqueOrThrow({ where: { id: input.eventTypeId }, select: { code: true } }),
    ]);

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
        where: { id: input.leadId, deletedAt: null },
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
          eventDate: new Date(`${input.eventDate}T00:00:00.000Z`),
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
            paymentStatus: t.paymentStatus ?? "unpaid",
          },
        })
      ),
    ];

    await db.$transaction(ops);

    const hdrs = await headers();
    await logAudit({
      userId: session!.user.id,
      action: "booking_mice.created",
      entityType: "booking",
      entityId: bookingId,
      result: "success",
      description: `Created MICE booking for ${input.clientName}`,
      ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
      userAgent: hdrs.get("user-agent") ?? undefined,
    });

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");

    return { success: true, data: { id: bookingId } };
  } catch (e) {
    console.error("[createMiceBooking]", e);
    return { success: false, error: "Gagal menyimpan booking MICE." };
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
    select: { id: true, customerId: true },
  });
  if (!existing) return { success: false, error: "Booking MICE tidak ditemukan." };

  try {
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
    if (input.venueId !== undefined) bookingUpdate.venueId = input.venueId;
    if (input.sourceOfInformationId !== undefined)
      bookingUpdate.sourceOfInformationId = input.sourceOfInformationId ?? null;
    if (input.salesId !== undefined) bookingUpdate.salesId = input.salesId ?? session!.user.profileId;
    if (input.salesSignature !== undefined)
      bookingUpdate.salesSignature = input.salesSignature ?? null;
    if (input.signingLocation !== undefined)
      bookingUpdate.signingLocation = input.signingLocation ?? null;
    if (input.quotationId !== undefined) bookingUpdate.quotationId = input.quotationId ?? null;
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
              paymentStatus: t.paymentStatus ?? "unpaid",
            },
          })
        )
      );
    }

    if (ops.length > 0) {
      await db.$transaction(ops);
    }

    const hdrs = await headers();
    await logAudit({
      userId: session!.user.id,
      action: "booking_mice.updated",
      entityType: "booking",
      entityId: id,
      result: "success",
      description: "Updated MICE booking",
      ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
      userAgent: hdrs.get("user-agent") ?? undefined,
    });

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

  try {
    await db.$transaction([
      // Remove non-cascade relations first (module+entityId pattern, no FK)
      db.approvalRecord.deleteMany({
        where: { module: "booking", entityId: id },
        // ApprovalRecordStep cascades from ApprovalRecord (onDelete: Cascade in schema)
      }),
      db.notification.deleteMany({
        where: { entityType: "booking", entityId: id },
      }),
      // ActivityLog is the audit trail — intentionally preserved after entity deletion
      // Cascade handles TermOfPayment, BookingDocument, ClientAgreement, etc.
      db.booking.delete({ where: { id } }),
    ]);

    const hdrs = await headers();
    await logAudit({
      userId: session!.user.id,
      action: "booking_mice.deleted",
      entityType: "booking",
      entityId: id,
      result: "success",
      description: "Deleted MICE booking",
      ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
      userAgent: hdrs.get("user-agent") ?? undefined,
    });

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

  try {
    await db.$transaction([
      db.booking.update({
        where: { id: input.id },
        data: {
          bookingStatus: "Lost",
          lostReason: input.lostReason ?? null,
        },
      }),
    ]);

    const hdrs = await headers();
    await logAudit({
      userId: session!.user.id,
      action: "booking_mice.lost",
      entityType: "booking",
      entityId: input.id,
      result: "success",
      description: `MICE booking marked as lost. Reason: ${input.lostReason ?? "—"}`,
      ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
      userAgent: hdrs.get("user-agent") ?? undefined,
    });

    revalidateTag("bookings", "max");

    return { success: true };
  } catch (e) {
    console.error("[markMiceLost]", e);
    return { success: false, error: "Gagal mengubah status booking MICE menjadi Lost." };
  }
}
