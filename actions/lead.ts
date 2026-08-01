"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
} from "@/lib/validations/lead";
import type { CreateLeadInput, UpdateLeadInput, UpdateLeadStatusInput } from "@/lib/validations/lead";
import type { Prisma, WeddingSession } from "@prisma/client";

// ─── Slot conflict guard (locked leads only) ──────────────────────────────────

/**
 * Build the OR clause for a session overlap, fullday-aware.
 * Identical semantics to the booking create/edit guard in actions/booking.ts:
 *   • fullday collides with morning, evening, AND fullday
 *   • a single session collides with itself AND fullday
 * MICE leads without a session (null) skip the guard entirely (handled by caller).
 */
function sessionOverlapOr(
  session: WeddingSession,
): Array<{ weddingSession: WeddingSession }> {
  if (session === "fullday") {
    return [
      { weddingSession: "morning" },
      { weddingSession: "evening" },
      { weddingSession: "fullday" },
    ];
  }
  return [{ weddingSession: session }, { weddingSession: "fullday" }];
}

/**
 * Server-side slot guard for a date-locked lead. Mirrors the DB-backed guard that
 * protects bookings, but leads have no partial unique index (a fullday lock can't be
 * expressed as one, and locking a lead is a rare manual event), so we enforce it at
 * the app layer with a findFirst against the two sources that reserve a slot:
 *   1. Active saved bookings (recordStatus saved, non-final bookingStatus).
 *   2. Other active locked leads (isDateLocked, status not final, not converted),
 *      excluding the lead being edited itself via excludeLeadId.
 *
 * For leads: primary date uses weddingSession; alt date uses weddingSessionAlt.
 * The check covers both fields separately so session-per-date is enforced correctly.
 *
 * Returns an error string when the slot is taken, or null when free.
 * Only call this when the lead being saved is itself date-locked with a venue,
 * date, and (wedding) session — an unlocked lead reserves nothing.
 */
async function findLeadSlotConflict(params: {
  venueId: string;
  eventDate: Date;
  weddingSession: WeddingSession | null;
  excludeLeadId?: string;
}): Promise<string | null> {
  const { venueId, eventDate, weddingSession, excludeLeadId } = params;

  // MICE leads without a session: a locked lead still reserves the whole day.
  // Match any booking/lead on that venue+date regardless of their session.
  const overlapOr = weddingSession
    ? sessionOverlapOr(weddingSession)
    : undefined;

  const bookingConflict = await db.booking.findFirst({
    where: {
      venueId,
      recordStatus: "saved",
      eventDate,
      bookingStatus: { notIn: ["Canceled", "Lost", "Rejected"] },
      ...(overlapOr ? { OR: overlapOr } : {}),
    },
    select: { id: true },
  });
  if (bookingConflict) {
    return "Slot venue di tanggal & sesi tersebut sudah dibooking.";
  }

  // Check conflicts against other locked leads.
  // Primary date conflict: check against weddingSession (per-date session).
  // Alt date conflict: check against weddingSessionAlt (per-date session for alt).
  // Both must be checked separately because they use different session fields.
  const sessionIn = overlapOr ? overlapOr.map((o) => o.weddingSession) : undefined;

  const leadConflict = await db.lead.findFirst({
    where: {
      ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
      isDateLocked: true,
      status: { isFinal: false },
      convertedAt: null,
      // Match: primary date via weddingSession, OR alt date via weddingSessionAlt
      OR: [
        // Primary date (weddingSession field) at primary or secondary venue
        {
          eventDate,
          OR: [{ venueId }, { venueSecondaryId: venueId }],
          ...(sessionIn ? { weddingSession: { in: sessionIn } } : {}),
        },
        // Alt date (weddingSessionAlt field) at primary or secondary venue
        {
          eventDateAlt: eventDate,
          OR: [{ venueId }, { venueSecondaryId: venueId }],
          ...(sessionIn ? { weddingSessionAlt: { in: sessionIn } } : {}),
        },
      ],
    },
    select: { id: true },
  });
  if (leadConflict) {
    return "Slot venue di tanggal & sesi tersebut sudah dikunci lead lain.";
  }

  return null;
}

// ─── Create Lead ──────────────────────────────────────────────────────────────

export async function createLead(data: CreateLeadInput) {
  const { session, error } = await requirePermission({ module: "leads", action: "create" });
  if (error) return { success: false as const, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`create-lead:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const parsed = createLeadSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const {
    name,
    contactNumbers,
    email,
    emailCpp,
    emailCpw,
    nikCpp,
    nikCpw,
    addressCpp,
    addressCpw,
    address,
    eventDate,
    eventDateAlt,
    time,
    estimatedPax,
    budgetRange,
    notes,
    category,
    weddingSession,
    weddingSessionAlt,
    instansi,
    venueId,
    venueSecondaryId,
    packageId,
    eventTypeId,
    sourceOfInformationId,
    assignedToId,
    statusId,
    bitrixId,
    isDateLocked,
    bookingFeeAmount,
    bookingFeeDate,
    bookingFeeEvidenceUrl,
  } = parsed.data;

  // Guard: check slot conflict only when this lead will lock a date.
  // An unlocked lead does not reserve any slot and cannot be blocked.
  if (isDateLocked && venueId && eventDate) {
    const conflict = await findLeadSlotConflict({
      venueId,
      eventDate: new Date(eventDate),
      weddingSession: weddingSession ?? null,
    });
    if (conflict) return { success: false as const, error: conflict };
  }

  try {
    const [lead] = await db.$transaction([
      db.lead.create({
        data: {
          name,
          contactNumbers,
          email: email || null,
          emailCpp: emailCpp || null,
          emailCpw: emailCpw || null,
          nikCpp: nikCpp || null,
          nikCpw: nikCpw || null,
          addressCpp: addressCpp || null,
          addressCpw: addressCpw || null,
          address: address || null,
          eventDate: eventDate ? new Date(eventDate) : null,
          eventDateAlt: eventDateAlt ? new Date(eventDateAlt) : null,
          time: time || null,
          estimatedPax: estimatedPax ?? null,
          budgetRange: budgetRange || null,
          notes: notes || null,
          category,
          weddingSession,
          weddingSessionAlt: weddingSessionAlt ?? null,
          instansi: category === "MICE" ? (instansi?.trim() || null) : null,
          venueId: venueId || null,
          venueSecondaryId: venueSecondaryId || null,
          packageId: packageId || null,
          eventTypeId: eventTypeId || null,
          sourceOfInformationId: sourceOfInformationId || null,
          assignedToId: assignedToId || null,
          statusId,
          bitrixId: bitrixId || null,
          isDateLocked: isDateLocked ?? false,
          bookingFeeAmount: bookingFeeAmount ?? null,
          bookingFeeDate: bookingFeeDate ? new Date(bookingFeeDate) : null,
          bookingFeeEvidenceUrl: bookingFeeEvidenceUrl || null,
          createdById: session!.user.profileId,
        },
        select: { id: true, name: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "lead.created",
      result: "success",
      entityType: "Lead",
      entityId: lead.id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const, data: lead };
  } catch (err) {
    console.error("[createLead]", err);
    return { success: false as const, error: "Gagal menyimpan lead." };
  }
}

// ─── Update Lead ──────────────────────────────────────────────────────────────

export async function updateLead(data: UpdateLeadInput) {
  const { session, error } = await requirePermission({ module: "leads", action: "edit" });
  if (error) return { success: false as const, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`update-lead:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const parsed = updateLeadSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const { id, ...fields } = parsed.data;

  // Guard: check slot conflict only when this update explicitly enables date-locking.
  // We check when isDateLocked is being set to true AND both venueId and eventDate
  // are present in the payload (either newly set or already on the record isn't knowable
  // from a partial update — only explicit fields are checked here).
  // Exclude this lead itself (excludeLeadId) so it doesn't conflict with its own existing lock.
  if (
    fields.isDateLocked === true &&
    fields.venueId &&
    fields.eventDate
  ) {
    const conflict = await findLeadSlotConflict({
      venueId: fields.venueId,
      eventDate: new Date(fields.eventDate),
      weddingSession: fields.weddingSession ?? null,
      excludeLeadId: id,
    });
    if (conflict) return { success: false as const, error: conflict };
  }

  try {
    const [lead] = await db.$transaction([
      db.lead.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.contactNumbers !== undefined && { contactNumbers: fields.contactNumbers }),
          ...(fields.email !== undefined && { email: fields.email || null }),
          ...(fields.emailCpp !== undefined && { emailCpp: fields.emailCpp || null }),
          ...(fields.emailCpw !== undefined && { emailCpw: fields.emailCpw || null }),
          ...(fields.nikCpp !== undefined && { nikCpp: fields.nikCpp || null }),
          ...(fields.nikCpw !== undefined && { nikCpw: fields.nikCpw || null }),
          ...(fields.addressCpp !== undefined && { addressCpp: fields.addressCpp || null }),
          ...(fields.addressCpw !== undefined && { addressCpw: fields.addressCpw || null }),
          ...(fields.address !== undefined && { address: fields.address || null }),
          ...(fields.eventDate !== undefined && {
            eventDate: fields.eventDate ? new Date(fields.eventDate) : null,
          }),
          ...(fields.eventDateAlt !== undefined && {
            eventDateAlt: fields.eventDateAlt ? new Date(fields.eventDateAlt) : null,
          }),
          ...(fields.time !== undefined && { time: fields.time || null }),
          ...(fields.estimatedPax !== undefined && { estimatedPax: fields.estimatedPax ?? null }),
          ...(fields.budgetRange !== undefined && { budgetRange: fields.budgetRange || null }),
          ...(fields.notes !== undefined && { notes: fields.notes || null }),
          ...(fields.venueId !== undefined && { venueId: fields.venueId || null }),
          ...(fields.venueSecondaryId !== undefined && { venueSecondaryId: fields.venueSecondaryId || null }),
          ...(fields.packageId !== undefined && { packageId: fields.packageId || null }),
          ...(fields.eventTypeId !== undefined && { eventTypeId: fields.eventTypeId || null }),
          ...(fields.sourceOfInformationId !== undefined && {
            sourceOfInformationId: fields.sourceOfInformationId || null,
          }),
          ...(fields.category !== undefined && { category: fields.category }),
          ...(fields.weddingSession !== undefined && { weddingSession: fields.weddingSession }),
          ...(fields.weddingSessionAlt !== undefined && { weddingSessionAlt: fields.weddingSessionAlt ?? null }),
          ...(fields.instansi !== undefined && { instansi: fields.instansi?.trim() || null }),
          ...(fields.assignedToId !== undefined && { assignedToId: fields.assignedToId || null }),
          ...(fields.statusId !== undefined && { statusId: fields.statusId }),
          ...(fields.bitrixId !== undefined && { bitrixId: fields.bitrixId || null }),
          ...(fields.isDateLocked !== undefined && { isDateLocked: fields.isDateLocked }),
          ...(fields.bookingFeeAmount !== undefined && { bookingFeeAmount: fields.bookingFeeAmount ?? null }),
          ...(fields.bookingFeeDate !== undefined && {
            bookingFeeDate: fields.bookingFeeDate ? new Date(fields.bookingFeeDate) : null,
          }),
          ...(fields.bookingFeeEvidenceUrl !== undefined && {
            bookingFeeEvidenceUrl: fields.bookingFeeEvidenceUrl || null,
          }),
        },
        select: { id: true, name: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "lead.updated",
      result: "success",
      entityType: "Lead",
      entityId: id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const, data: lead };
  } catch (err) {
    console.error("[updateLead]", err);
    return { success: false as const, error: "Gagal mengupdate lead." };
  }
}

// ─── Delete Lead ──────────────────────────────────────────────────────────────

export async function deleteLead(id: string) {
  const { session, error } = await requirePermission({ module: "leads", action: "delete" });
  if (error) return { success: false as const, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`delete-lead:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  try {
    await db.$transaction([
      db.lead.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "lead.deleted",
      result: "success",
      entityType: "Lead",
      entityId: id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const };
  } catch (err) {
    console.error("[deleteLead]", err);
    return { success: false as const, error: "Gagal menghapus lead." };
  }
}

// ─── Update Lead Status (Kanban drag) ────────────────────────────────────────

export async function updateLeadStatus(data: UpdateLeadStatusInput) {
  const { session, error } = await requirePermission({ module: "leads", action: "edit" });
  if (error) return { success: false as const, error };

  if (!mutationLimiter.check(`update-lead-status:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const parsed = updateLeadStatusSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  try {
    // Resolve the target status to decide whether this is a "mark lost" transition.
    // Lost status = isFinal && !isSystem (Deal = isFinal && isSystem). When a lead is
    // marked Lost we release its date hold (isDateLocked → false) so the slot frees up
    // and the availability endpoint no longer blocks it. Read outside the transaction,
    // write the flag inside it (array form, consistent with the rest of the codebase).
    const targetStatus = await db.leadStatus.findUnique({
      where: { id: parsed.data.statusId },
      select: { isFinal: true, isSystem: true },
    });
    if (!targetStatus) return { success: false as const, error: "Status tidak ditemukan." };

    const isLostTransition = targetStatus.isFinal && !targetStatus.isSystem;

    await db.$transaction([
      db.lead.update({
        where: { id: parsed.data.id },
        data: {
          statusId: parsed.data.statusId,
          ...(isLostTransition && { isDateLocked: false }),
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "lead.status_changed",
      result: "success",
      entityType: "Lead",
      entityId: parsed.data.id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const };
  } catch (err) {
    console.error("[updateLeadStatus]", err);
    return { success: false as const, error: "Gagal mengupdate status lead." };
  }
}

// ─── Update Lead Assignee ────────────────────────────────────────────────────

export async function updateLeadAssignee(leadId: string, assignedToId: string | null) {
  const { session, error } = await requirePermission({ module: "leads", action: "edit" });
  if (error) return { success: false as const, error };

  if (!mutationLimiter.check(`update-lead-assignee:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  try {
    await db.$transaction([
      db.lead.update({
        where: { id: leadId },
        data: { assignedToId },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "lead.assignee_changed",
      result: "success",
      entityType: "Lead",
      entityId: leadId,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const };
  } catch (err) {
    console.error("[updateLeadAssignee]", err);
    return { success: false as const, error: "Gagal mengupdate assignee lead." };
  }
}

// ─── Convert Lead to Customer ─────────────────────────────────────────────────
// Called when lead reaches Deal status and admin clicks "Convert"

export async function convertLead(leadId: string) {
  const { session, error } = await requirePermission({ module: "leads", action: "edit" });
  if (error) return { success: false as const, error };

  if (!mutationLimiter.check(`convert-lead:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      email: true,
      emailCpp: true,
      emailCpw: true,
      nikCpp: true,
      nikCpw: true,
      addressCpp: true,
      addressCpw: true,
      category: true,
      contactNumbers: true,
      convertedAt: true,
      status: { select: { isFinal: true, isSystem: true, name: true } },
    },
  });

  if (!lead) return { success: false as const, error: "Lead tidak ditemukan." };
  if (lead.convertedAt) return { success: false as const, error: "Lead sudah pernah dikonversi." };
  if (!lead.status.isSystem || !lead.status.isFinal) {
    return { success: false as const, error: "Lead harus berstatus Deal untuk dikonversi." };
  }

  try {
    const mobileNumberJson = JSON.parse(JSON.stringify(lead.contactNumbers)) as Prisma.InputJsonValue;

    // Wedding: pakai emailCpp/emailCpw dari lead (field terpisah per pasangan)
    // MICE: pakai lead.email (generic contact email) → dipetakan ke emailCpp customer
    const isWeddingLead = lead.category === "WEDDINGS";
    const customerEmailCpp = isWeddingLead ? (lead.emailCpp || null) : (lead.email || null);
    const customerEmailCpw = isWeddingLead ? (lead.emailCpw || null) : null;

    // NIK & Alamat hanya dipetakan untuk lead Wedding (MICE tidak punya field ini)
    const customerCppNik = isWeddingLead ? (lead.nikCpp || null) : null;
    const customerCpwNik = isWeddingLead ? (lead.nikCpw || null) : null;
    const customerCppAddress = isWeddingLead ? (lead.addressCpp || null) : null;
    const customerCpwAddress = isWeddingLead ? (lead.addressCpw || null) : null;

    // Pre-generate customer id so both writes can share it in the same transaction array.
    // Array-form transactions on Neon HTTP are atomic but cannot cross-reference results
    // between elements — pre-gen id is the standard pattern for this in the codebase.
    const customerId = crypto.randomUUID();

    await db.$transaction([
      db.customer.create({
        data: {
          id: customerId,
          name: lead.name,
          emailCpp: customerEmailCpp,
          emailCpw: customerEmailCpw,
          cppNik: customerCppNik,
          cpwNik: customerCpwNik,
          cppAddress: customerCppAddress,
          cpwAddress: customerCpwAddress,
          mobileNumber: mobileNumberJson,
          type: "Personal",
          memberStatus: "Non-Member",
        },
      }),
      db.lead.update({
        where: { id: leadId },
        data: {
          convertedAt: new Date(),
          convertedToCustomerId: customerId,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "lead.converted",
      result: "success",
      entityType: "Lead",
      entityId: leadId,
      changes: { customerId },
      ipAddress: ip,
    });

    revalidateTag("leads", "max");
    revalidateTag("customers", "max");

    return { success: true as const, data: { customerId } };
  } catch (err) {
    console.error("[convertLead]", err);
    return { success: false as const, error: "Gagal mengkonversi lead." };
  }
}
