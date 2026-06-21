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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function resolveDealStatusId(): Promise<string | null> {
  const dealStatus = await db.leadStatus.findFirst({
    where: { isSystem: true, isFinal: true },
    select: { id: true },
  });
  return dealStatus?.id ?? null;
}

// ─── Convert → Draft WEDDING booking ─────────────────────────────────────────

/**
 * Atomically mark a lead as Deal and create a draft booking in one transaction.
 *
 * All writes — customer creation (if needed), lead status flip, booking creation —
 * are batched into a single db.$transaction([...]) array. A failure in any step
 * rolls back the entire batch; no partial state (customer with no booking, Deal
 * status with no booking) can be left behind.
 *
 * If the lead already has a convertedToCustomerId (retry after earlier partial
 * failure OR existing customer), the customer.create step is skipped and the
 * existing id is reused.
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

    const lead = await db.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        name: true,
        email: true,
        contactNumbers: true,
        address: true,
        bitrixId: true,
        sourceOfInformationId: true,
        assignedToId: true,
        convertedToCustomerId: true,
        convertedToBookingId: true,
      },
    });
    if (!lead) return { success: false, error: "Lead tidak ditemukan." };

    // Idempotency: already converted — return existing draft.
    if (lead.convertedToBookingId) {
      return { success: true, draftId: lead.convertedToBookingId };
    }

    const salesId = lead.assignedToId ?? session!.user.profileId!;
    const managerId = await resolveManagerId(salesId);
    const draftId = crypto.randomUUID();

    // Build the atomic ops list. customer.create is included only when the lead
    // doesn't already have a customer (first attempt). On retry after a prior
    // partial failure the existing customerId is reused and only the status +
    // booking ops are needed.
    const customerId = lead.convertedToCustomerId ?? crypto.randomUUID();
    const contactNums = mapLeadContactNumbers(lead.contactNumbers);

    const txOps: Prisma.PrismaPromise<unknown>[] = [];

    if (!lead.convertedToCustomerId) {
      txOps.push(
        db.customer.create({
          data: {
            id: customerId,
            name: lead.name,
            mobileNumber: contactNums as Prisma.InputJsonValue,
            emailCpp: lead.email || null,
            emailCpw: null,
            ktpAddress: lead.address ?? null,
            cppAddress: lead.address ?? null,
            cpwAddress: null,
            bitrixId: lead.bitrixId ?? null,
            sourceOfInformationId: lead.sourceOfInformationId ?? null,
            type: "Other",
            memberStatus: "Non-Member",
            updatedBy: session!.user.name ?? session!.user.email,
          },
        }),
      );
    }

    txOps.push(
      db.lead.update({
        where: { id: input.leadId },
        data: {
          statusId: dealStatusId,
          // Stamp convertedToCustomerId in the same transaction as customer.create
          // so both land atomically or not at all.
          ...(!lead.convertedToCustomerId && { convertedToCustomerId: customerId }),
        },
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
    );

    await db.$transaction(txOps);

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

// ─── Convert → Draft MICE booking ────────────────────────────────────────────

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
        email: true,
        contactNumbers: true,
        address: true,
        bitrixId: true,
        sourceOfInformationId: true,
        assignedToId: true,
        convertedToCustomerId: true,
        convertedToBookingId: true,
      },
    });
    if (!lead) return { success: false, error: "Lead tidak ditemukan." };

    if (lead.convertedToBookingId) {
      return { success: true, draftId: lead.convertedToBookingId };
    }

    const salesId = lead.assignedToId ?? session!.user.profileId!;
    if (!salesId) return { success: false, error: "Sales wajib dipilih." };
    const managerId = await resolveManagerId(salesId);
    const draftId = crypto.randomUUID();

    const customerId = lead.convertedToCustomerId ?? crypto.randomUUID();
    const contactNums = mapLeadContactNumbers(lead.contactNumbers);

    const txOps: Prisma.PrismaPromise<unknown>[] = [];

    if (!lead.convertedToCustomerId) {
      txOps.push(
        db.customer.create({
          data: {
            id: customerId,
            name: lead.name,
            mobileNumber: contactNums as Prisma.InputJsonValue,
            emailCpp: lead.email || null,
            emailCpw: null,
            ktpAddress: lead.address ?? null,
            cppAddress: lead.address ?? null,
            cpwAddress: null,
            bitrixId: lead.bitrixId ?? null,
            sourceOfInformationId: lead.sourceOfInformationId ?? null,
            type: "Other",
            memberStatus: "Non-Member",
            updatedBy: session!.user.name ?? session!.user.email,
          },
        }),
      );
    }

    txOps.push(
      db.lead.update({
        where: { id: input.leadId },
        data: {
          statusId: dealStatusId,
          ...(!lead.convertedToCustomerId && { convertedToCustomerId: customerId }),
        },
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
          weddingSession: input.miceSession ?? null,
          leadId: input.leadId,
        },
      }),
    );

    await db.$transaction(txOps);

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
