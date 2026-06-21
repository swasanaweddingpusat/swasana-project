"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { resolveManagerId } from "@/lib/resolve-manager";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConvertLeadResult {
  success: boolean;
  draftId?: string;
  error?: string;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * Payload for converting a lead into a Deal + draft booking atomically.
 * `eventDate`/`venueId`/`session` come from the Deal confirmation modal selection;
 * the rest are read from the lead row on the server (we only trust the lead id).
 */
const convertLeadWeddingSchema = z.object({
  leadId: z.string().min(1, "Lead wajib dipilih"),
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  category: z.enum(["WEDDINGS", "MICE"]).default("WEDDINGS"),
});

const convertLeadMiceSchema = z.object({
  leadId: z.string().min(1, "Lead wajib dipilih"),
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  miceSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
});

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

/**
 * Resolve (or create) the customer for a lead conversion. Mirrors the pre-transaction
 * customer-resolution path of createDraftBooking/createDraftMiceBooking exactly:
 *   1. If the lead already converted (convertedToCustomerId), reuse that customer.
 *   2. Otherwise create a Customer and claim the conversion lock via updateMany
 *      (count === 0 → lost the race → cleanup + reuse the winner's customer).
 *
 * Runs BEFORE the status+booking transaction (option A). A failure here leaves the
 * lead status untouched, so there is no partial Deal state.
 */
async function resolveLeadCustomerId(
  leadId: string,
  updatedBy: string | null | undefined,
): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
  const leadRecord = await db.lead.findUnique({
    where: { id: leadId },
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
  if (!leadRecord) return { ok: false, error: "Lead tidak ditemukan." };

  if (leadRecord.convertedToCustomerId) {
    const existing = await db.customer.findUnique({
      where: { id: leadRecord.convertedToCustomerId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Customer dari lead tidak ditemukan." };
    return { ok: true, customerId: leadRecord.convertedToCustomerId };
  }

  // Create customer and claim conversion lock (same pattern as createDraftBooking)
  let customerId = crypto.randomUUID();
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
      updatedBy,
    },
  });

  const lockResult = await db.lead.updateMany({
    where: { id: leadRecord.id, convertedToCustomerId: null },
    data: { convertedToCustomerId: customerId },
  });

  if (lockResult.count === 0) {
    // Lost race — cleanup and reuse winner's customer
    await db.customer.delete({ where: { id: customerId } }).catch(() => undefined);
    const refreshed = await db.lead.findUnique({
      where: { id: leadRecord.id },
      select: { convertedToCustomerId: true },
    });
    if (refreshed?.convertedToCustomerId) {
      customerId = refreshed.convertedToCustomerId;
    } else {
      return { ok: false, error: "Gagal mengkonversi lead, coba lagi." };
    }
  }

  return { ok: true, customerId };
}

/** Resolve the system Deal status (isSystem && isFinal), seeded at migration time. */
async function resolveDealStatusId(): Promise<string | null> {
  const dealStatus = await db.leadStatus.findFirst({
    where: { isSystem: true, isFinal: true },
    select: { id: true },
  });
  return dealStatus?.id ?? null;
}

// ─── Convert → Draft WEDDING booking (atomic) ────────────────────────────────

/**
 * Marks a lead as Deal AND creates its draft booking in a single transaction.
 * The lead.update(statusId = Deal) and booking.create(recordStatus = "draft") share
 * one db.$transaction([...]) array, so a booking failure rolls back the status change —
 * no "floating Deal with no booking" can occur.
 *
 * Customer resolution runs pre-transaction (option A) and is safe: if it fails the
 * lead status is still untouched. convertedAt/convertedToBookingId stay null until
 * finalize; isDateLocked is left as-is (Deal is not Lost).
 */
export async function convertLeadToDraftBooking(data: unknown): Promise<ConvertLeadResult> {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`lead-convert-deal:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = convertLeadWeddingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const input = parsed.data;

  try {
    const dealStatusId = await resolveDealStatusId();
    if (!dealStatusId) return { success: false, error: "Status Deal tidak ditemukan." };

    // Idempotency: if the lead already has a draft booking, return it directly.
    const lead = await db.lead.findUnique({
      where: { id: input.leadId },
      select: { id: true, name: true, assignedToId: true, convertedToBookingId: true },
    });
    if (!lead) return { success: false, error: "Lead tidak ditemukan." };
    if (lead.convertedToBookingId) {
      return { success: true, draftId: lead.convertedToBookingId };
    }

    // Pre-transaction: resolve/create customer (option A — safe before status flips).
    const customerRes = await resolveLeadCustomerId(
      input.leadId,
      session!.user.name ?? session!.user.email,
    );
    if (!customerRes.ok) return { success: false, error: customerRes.error };
    const customerId = customerRes.customerId;

    const salesId = lead.assignedToId ?? session!.user.profileId!;
    const managerId = await resolveManagerId(salesId);
    const draftId = crypto.randomUUID();

    // Atomic: flip status to Deal + create the draft booking together.
    await db.$transaction([
      db.lead.update({
        where: { id: input.leadId },
        data: { statusId: dealStatusId },
      }),
      db.booking.create({
        data: {
          id: draftId,
          eventDate: new Date(input.eventDate),
          recordStatus: "draft",
          bookingStatus: "Pending",
          category: input.category,
          salesId,
          managerId,
          customerId,
          venueId: input.venueId,
          weddingSession: input.weddingSession ?? null,
          leadId: input.leadId,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "lead.converted_to_deal",
      entityType: "booking",
      entityId: draftId,
      changes: { leadId: input.leadId, customerId, venueId: input.venueId, category: input.category },
      description: `Converted lead ${lead.name} to Deal + draft booking`,
    });

    revalidateTag("leads", "max");
    revalidateTag("bookings", "max");

    return { success: true, draftId };
  } catch (e) {
    console.error("[convertLeadToDraftBooking]", e);
    return { success: false, error: "Gagal mengkonversi lead menjadi Deal." };
  }
}

// ─── Convert → Draft MICE booking (atomic) ───────────────────────────────────

export async function convertLeadToDraftMiceBooking(data: unknown): Promise<ConvertLeadResult> {
  const { session, error } = await requirePermission({ module: "booking-mice", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`lead-convert-deal-mice:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = convertLeadMiceSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const input = parsed.data;

  try {
    const dealStatusId = await resolveDealStatusId();
    if (!dealStatusId) return { success: false, error: "Status Deal tidak ditemukan." };

    const lead = await db.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        name: true,
        assignedToId: true,
        sourceOfInformationId: true,
        convertedToBookingId: true,
      },
    });
    if (!lead) return { success: false, error: "Lead tidak ditemukan." };
    if (lead.convertedToBookingId) {
      return { success: true, draftId: lead.convertedToBookingId };
    }

    const customerRes = await resolveLeadCustomerId(
      input.leadId,
      session!.user.name ?? session!.user.email,
    );
    if (!customerRes.ok) return { success: false, error: customerRes.error };
    const customerId = customerRes.customerId;

    const salesId = lead.assignedToId ?? session!.user.profileId!;
    if (!salesId) return { success: false, error: "Sales wajib dipilih." };
    const managerId = await resolveManagerId(salesId);
    const draftId = crypto.randomUUID();

    await db.$transaction([
      db.lead.update({
        where: { id: input.leadId },
        data: { statusId: dealStatusId },
      }),
      db.booking.create({
        data: {
          id: draftId,
          eventDate: new Date(input.eventDate),
          recordStatus: "draft",
          bookingStatus: "Pending",
          category: "MICE",
          salesId,
          managerId,
          customerId,
          venueId: input.venueId,
          sourceOfInformationId: lead.sourceOfInformationId ?? null,
          // MICE uses weddingSession field for the session (morning/evening/fullday)
          weddingSession: input.miceSession ?? null,
          leadId: input.leadId,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "lead.converted_to_deal_mice",
      entityType: "booking",
      entityId: draftId,
      changes: { leadId: input.leadId, customerId, venueId: input.venueId, category: "MICE" },
      description: `Converted MICE lead ${lead.name} to Deal + draft booking`,
    });

    revalidateTag("leads", "max");
    revalidateTag("bookings", "max");

    return { success: true, draftId };
  } catch (e) {
    console.error("[convertLeadToDraftMiceBooking]", e);
    return { success: false, error: "Gagal mengkonversi lead MICE menjadi Deal." };
  }
}
