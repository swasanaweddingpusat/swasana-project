"use server";

import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { isSlotConflictError, SLOT_TAKEN_MESSAGE } from "@/lib/booking-slot-error";
import { getNextSequence } from "@/lib/counter";
import { buildBookingApprovalSteps } from "@/lib/approval-flows";
import { resolveManagerId } from "@/lib/resolve-manager";
import { notifySuperAdmins } from "@/lib/notifications";
import {
  createMiceDraftStep1Schema,
  updateMiceDraftStep2Schema,
  updateMiceDraftStep3Schema,
  finalizeMiceDraftSchema,
} from "@/lib/validations/booking-mice-draft";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MiceDraftResult {
  success: boolean;
  draftId?: string;
  error?: string;
}

export interface FinalizeMiceDraftResult {
  success: boolean;
  bookingId?: string;
  termIds?: { id: string; sortOrder: number }[];
  error?: string;
}

// ─── STEP 1: Create MICE Draft ────────────────────────────────────────────────

export async function createDraftMiceBooking(data: unknown): Promise<MiceDraftResult> {
  const { session, error } = await requirePermission({ module: "booking-mice", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-draft-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createMiceDraftStep1Schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;
  const salesId = input.salesId ?? session!.user.profileId ?? null;
  if (!salesId) return { success: false, error: "Sales wajib dipilih." };

  try {
    // ── Resolve customer ──
    let customerId: string | null = null;
    let leadRecord: {
      id: string;
      name: string;
      email: string | null;
      contactNumbers: unknown;
      address: string | null;
      bitrixId: string | null;
      sourceOfInformationId: string | null;
      convertedToCustomerId: string | null;
    } | null = null;

    if (input.leadId) {
      leadRecord = await db.lead.findUnique({
        where: { id: input.leadId },
        select: {
          id: true,
          name: true,
          email: true,
          contactNumbers: true,
          address: true,
          bitrixId: true,
          sourceOfInformationId: true,
          convertedToCustomerId: true,
        },
      });
      if (!leadRecord) return { success: false, error: "Lead tidak ditemukan." };

      if (leadRecord.convertedToCustomerId) {
        customerId = leadRecord.convertedToCustomerId;
        const existing = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
        if (!existing) return { success: false, error: "Customer dari lead tidak ditemukan." };
      } else {
        customerId = crypto.randomUUID();
        const contactNums = mapLeadContactNumbers(leadRecord.contactNumbers);
        await db.customer.create({
          data: {
            id: customerId,
            name: leadRecord.name,
            mobileNumber: contactNums as Prisma.InputJsonValue,
            emailCpp: leadRecord.email || null,
            emailCpw: null,
            ktpAddress: leadRecord.address ?? null,
            cppAddress: leadRecord.address ?? null,
            cpwAddress: null,
            bitrixId: leadRecord.bitrixId ?? null,
            sourceOfInformationId: leadRecord.sourceOfInformationId ?? null,
            type: "Other",
            memberStatus: "Non-Member",
            updatedBy: session!.user.name ?? session!.user.email,
          },
        });

        const lockResult = await db.lead.updateMany({
          where: { id: leadRecord.id, convertedToCustomerId: null },
          data: { convertedToCustomerId: customerId },
        });

        if (lockResult.count === 0) {
          await db.customer.delete({ where: { id: customerId } }).catch(() => undefined);
          const refreshed = await db.lead.findUnique({
            where: { id: leadRecord.id },
            select: { convertedToCustomerId: true },
          });
          if (refreshed?.convertedToCustomerId) {
            customerId = refreshed.convertedToCustomerId;
          } else {
            return { success: false, error: "Gagal mengkonversi lead, coba lagi." };
          }
        }
      }
    } else if (input.customerId) {
      const existing = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
      if (!existing) return { success: false, error: "Customer tidak ditemukan." };
      customerId = input.customerId;
    } else if (input.clientName) {
      customerId = crypto.randomUUID();
      const mobileNumber = input.clientPhone
        ? [{ name: input.companyName ?? "", number: input.clientPhone.replace(/\D/g, "") }]
        : [];
      await db.customer.create({
        data: {
          id: customerId,
          name: input.clientName,
          mobileNumber: mobileNumber as Prisma.InputJsonValue,
          emailCpp: null,
          emailCpw: null,
          type: "Other",
          memberStatus: "Non-Member",
          updatedBy: session!.user.name ?? session!.user.email,
        },
      });
    }

    if (!customerId) return { success: false, error: "Customer wajib diisi." };

    const managerId = await resolveManagerId(salesId);
    // Use client-provided id for idempotency; fall back to server-generated uuid.
    const draftId = input.id ?? crypto.randomUUID();

    // Idempotency: if a draft with this id already exists, return it directly.
    const existing = await db.booking.findUnique({
      where: { id: draftId },
      select: { id: true, recordStatus: true },
    });
    if (existing) {
      if (existing.recordStatus !== "draft") {
        return { success: false, error: "Booking dengan ID tersebut sudah difinalisasi." };
      }
      return { success: true, draftId };
    }

    await db.$transaction([
      db.booking.create({
        data: {
          id: draftId,
          recordStatus: "draft",
          bookingStatus: "Pending",
          category: "MICE",
          salesId,
          managerId,
          customerId,
          venueId: input.venueId,
          sourceOfInformationId: input.sourceOfInformationId ?? null,
          // MICE uses weddingSession field for session (morning/evening)
          weddingSession: input.miceSession ?? null,
          eventTime: input.eventTime ?? null,
          ...(input.leadId ? { leadId: input.leadId } : {}),
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "booking.mice_draft_created",
      entityType: "booking",
      entityId: draftId,
      changes: {
        customerId,
        venueId: input.venueId,
        category: "MICE",
        ...(input.leadId ? { leadId: input.leadId } : {}),
      },
      description: `Created MICE booking draft for ${input.clientName ?? customerId}`,
    });

    return { success: true, draftId };
  } catch (e) {
    console.error("[createDraftMiceBooking]", e);
    return { success: false, error: "Gagal membuat draft booking MICE." };
  }
}

// ─── STEP 2: Update MICE Draft — Term of Payments ────────────────────────────

export async function updateDraftMiceStep2(
  draftId: string,
  data: unknown,
): Promise<MiceDraftResult> {
  const { session, error } = await requirePermission({ module: "booking-mice", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-draft-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateMiceDraftStep2Schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const input = parsed.data;

  try {
    const draftCheck = await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft", category: "MICE" },
      select: { id: true },
    });
    if (!draftCheck) return { success: false, error: "Draft MICE tidak ditemukan." };

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.termOfPayment.deleteMany({ where: { bookingId: draftId } }),
      ...(input.termOfPayments ?? []).map((t, i) =>
        db.termOfPayment.create({
          data: {
            bookingId: draftId,
            name: t.name,
            amount: t.amount,
            dueDate: new Date(t.dueDate),
            sortOrder: t.sortOrder ?? i,
          },
        })
      ),
    ];

    await db.$transaction(ops);
    return { success: true, draftId };
  } catch (e) {
    console.error("[updateDraftMiceStep2]", e);
    return { success: false, error: "Gagal menyimpan term of payment draft MICE." };
  }
}

// ─── STEP 3: Update MICE Draft — Signature/Location ──────────────────────────

export async function updateDraftMiceStep3(
  draftId: string,
  data: unknown,
): Promise<MiceDraftResult> {
  const { session, error } = await requirePermission({ module: "booking-mice", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-draft-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateMiceDraftStep3Schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const input = parsed.data;

  try {
    const draftCheck = await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft", category: "MICE" },
      select: { id: true },
    });
    if (!draftCheck) return { success: false, error: "Draft MICE tidak ditemukan." };

    await db.$transaction([
      db.booking.update({
        where: { id: draftId },
        data: {
          signingLocation: input.signingLocation ?? null,
          salesSignature: input.signatureSales ?? null,
        },
      }),
    ]);

    return { success: true, draftId };
  } catch (e) {
    console.error("[updateDraftMiceStep3]", e);
    return { success: false, error: "Gagal menyimpan tanda tangan draft MICE." };
  }
}

// ─── FINALIZE: Promote MICE draft → saved ────────────────────────────────────

export async function finalizeDraftMiceBooking(data: unknown): Promise<FinalizeMiceDraftResult> {
  const { session, error } = await requirePermission({ module: "booking-mice", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`mice-draft-finalize:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = finalizeMiceDraftSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const input = parsed.data;
  const draftId = input.draftId;

  try {
    const draft = await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft", category: "MICE" },
      include: {
        customer: true,
        venue: { include: { brand: true } },
        termOfPayments: { orderBy: { sortOrder: "asc" } },
        sales: { select: { fullName: true } },
      },
    });

    if (!draft) return { success: false, error: "Draft MICE tidak ditemukan atau sudah difinalisasi." };
    if (!draft.venueId) return { success: false, error: "Draft belum memiliki venue." };
    if (!draft.eventDate) return { success: false, error: "Event date wajib diisi sebelum finalisasi." };

    const customer = draft.customer;
    const venue = draft.venue;

    // MICE slot conflict check: only if session is set (saved-only, same as wedding)
    if (draft.weddingSession) {
      const eventDateObj = new Date(draft.eventDate);
      const sessionOrConditions =
        draft.weddingSession === "fullday"
          ? [
              { weddingSession: "morning" as const },
              { weddingSession: "evening" as const },
              { weddingSession: "fullday" as const },
            ]
          : [
              { weddingSession: draft.weddingSession as "morning" | "evening" | "fullday" },
              { weddingSession: "fullday" as const },
            ];

      const conflictingBooking = await db.booking.findFirst({
        where: {
          id: { not: draftId },
          venueId: draft.venueId,
          eventDate: eventDateObj,
          recordStatus: "saved",
          bookingStatus: { notIn: ["Canceled", "Lost", "Rejected"] },
          OR: sessionOrConditions,
        },
        select: { id: true },
      });
      if (conflictingBooking) {
        return {
          success: false,
          error: "Slot venue di tanggal & sesi tersebut sudah dibooking.",
        };
      }
    }

    // Generate PO Number for MICE
    const now = new Date();
    const year = now.getFullYear();
    const poSeq = await getNextSequence(`po-${year}`);
    const dd = now.getDate().toString().padStart(2, "0");
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const poNumber = `${poSeq.toString().padStart(3, "0")}/${venue?.brand?.code ?? ""}/${venue?.code ?? ""}/MICE/${dd}-${mm}-${year}`;

    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

    const invoiceNumbers: string[] = [];
    if (draft.termOfPayments.length > 0) {
      const monthRoman = ROMAN[now.getMonth()];
      for (const _ of draft.termOfPayments) {
        const seq = await getNextSequence(`invoice-${year}`);
        invoiceNumbers.push(`${seq}/INV/${venue?.code ?? ""}/${monthRoman}/${year}`);
      }
    }

    // Resolve approval steps: conditional Sales + Manager → Finance.
    // Auto-approve Sales only when the finalizer IS the assigned sales (and signed).
    const bookingApprovalSteps = await buildBookingApprovalSteps({
      salesId: draft.salesId,
      creatorProfileId: session!.user.profileId!,
      signatureSales: input.signatureSales ?? draft.salesSignature,
      decidedAt: new Date(),
      includeClientStep: false, // MICE: no client TTD step, manager+finance → Confirmed
    });

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // 1. Promote to saved
    ops.push(
      db.booking.update({
        where: { id: draftId },
        data: {
          recordStatus: "saved",
          bookingStatus: "Pending",
          poNumber,
          signingLocation: input.signingLocation ?? draft.signingLocation ?? null,
          salesSignature: input.signatureSales ?? draft.salesSignature ?? null,
        },
      })
    );

    // 2. SnapCustomer
    const mobileDisplay = Array.isArray(customer.mobileNumber)
      ? (customer.mobileNumber as Array<{ name?: string; number: string }>)
          .map((e) => (e.name ? `${e.name}: ${e.number}` : e.number))
          .join(", ")
      : String(customer.mobileNumber ?? "");

    ops.push(
      db.snapCustomer.create({
        data: {
          bookingId: draftId,
          customerId: customer.id,
          name: customer.name,
          emailCpp: customer.emailCpp ?? null,
          emailCpw: customer.emailCpw ?? null,
          mobileNumber: mobileDisplay,
          cppNik: customer.cppNik,
          cpwNik: customer.cpwNik,
          ktpAddress: customer.ktpAddress,
          cppAddress: customer.cppAddress,
          cpwAddress: customer.cpwAddress,
        },
      })
    );

    // 3. SnapVenue
    if (venue) {
      ops.push(
        db.snapVenue.create({
          data: {
            bookingId: draftId,
            venueId: venue.id,
            venueName: venue.name,
            address: venue.address,
            description: venue.description,
            brandName: venue.brand?.name ?? null,
            brandCode: venue.brand?.code ?? null,
          },
        })
      );
    }

    // 4. Stamp invoice numbers on terms
    if (terms.length > 0) {
      ops.push(
        ...terms.map((t, i) =>
          db.termOfPayment.update({
            where: { id: t.id },
            data: { invoiceNumber: invoiceNumbers[i] ?? null },
          })
        )
      );
    }

    // 5. ApprovalRecord + steps (Sales → Manager → Finance)
    if (bookingApprovalSteps && bookingApprovalSteps.length > 0) {
      const approvalRecordId = crypto.randomUUID();

      ops.push(
        db.approvalRecord.create({
          data: {
            id: approvalRecordId,
            module: "booking",
            entityId: draftId,
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

    // 6. ClientAgreement
    ops.push(
      db.clientAgreement.create({
        data: {
          bookingId: draftId,
          token: crypto.randomUUID(),
          accessCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        },
      })
    );

    // 7. Lead conversion update
    if (input.leadId) {
      const convertedStatus = await db.leadStatus.findFirst({
        where: { isSystem: true, isFinal: true },
        select: { id: true },
      });
      ops.push(
        db.lead.update({
          where: { id: input.leadId },
          data: {
            convertedToBookingId: draftId,
            convertedAt: new Date(),
            ...(convertedStatus ? { statusId: convertedStatus.id } : {}),
          },
        })
      );
    }

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "booking.mice_finalized",
      entityType: "booking",
      entityId: draftId,
      changes: {
        poNumber,
        customerId: draft.customerId,
        venueId: draft.venueId,
        ...(input.leadId ? { leadId: input.leadId } : {}),
      },
      description: `Finalized MICE booking draft for ${draft.customer?.name ?? draft.customerId}`,
    });

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    if (input.leadId) revalidateTag("leads", "max");

    notifySuperAdmins(
      {
        title: "Booking MICE Baru",
        message: `${session!.user.name ?? "User"} membuat booking MICE untuk ${draft.customer?.name ?? "Unknown"}.`,
        type: "booking_created",
        entityType: "booking",
        entityId: draftId,
      },
      session!.user.profileId!
    );

    const createdTerms = await db.termOfPayment.findMany({
      where: { bookingId: draftId },
      select: { id: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

    return { success: true, bookingId: draftId, termIds: createdTerms };
  } catch (e) {
    if (isSlotConflictError(e)) {
      return { success: false, error: SLOT_TAKEN_MESSAGE };
    }
    console.error("[finalizeDraftMiceBooking]", e);
    return { success: false, error: "Gagal memfinalisasi booking MICE." };
  }
}

// ─── Query: get user's unfinished MICE draft ─────────────────────────────────

export async function getUserUnfinishedMiceDraft(
  profileId: string,
): Promise<{ id: string; customerName: string | null; venueName: string | null; createdAt: Date; updatedAt: Date } | null> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const draft = await db.booking.findFirst({
    where: {
      salesId: profileId,
      recordStatus: "draft",
      category: "MICE",
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      customer: { select: { name: true } },
      venue: { select: { name: true } },
    },
  });

  if (!draft) return null;

  return {
    id: draft.id,
    customerName: draft.customer?.name ?? null,
    venueName: draft.venue?.name ?? null,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function mapLeadContactNumbers(
  raw: unknown,
): Array<{ name: string; number: string }> {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .map((e) => ({
      name:
        typeof e.label === "string"
          ? e.label
          : typeof e.name === "string"
            ? e.name
            : "",
      number: typeof e.number === "string" ? e.number : "",
    }))
    .filter((e) => e.number);
}
