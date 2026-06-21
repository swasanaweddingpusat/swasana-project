"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { apiLimiter, rateLimitError } from "@/lib/rate-limit";

// ─── Schema ───────────────────────────────────────────────────────────────────

const checkSlotSchema = z.object({
  venueId: z.string().min(1, "Venue wajib diisi"),
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  // session dipakai untuk WEDDINGS (morning/evening/fullday) & MICE (morning/evening)
  session: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  category: z.enum(["WEDDINGS", "MICE"]).default("WEDDINGS"),
  // Optional: exclude bookingId from conflict check (edit mode)
  excludeBookingId: z.string().optional().nullable(),
});

export type CheckSlotInput = z.infer<typeof checkSlotSchema>;

export interface CheckSlotResult {
  success: boolean;
  available?: boolean;
  conflictReason?: string;
  /** Structured reason for unavailability — preferred over substring-matching conflictReason. */
  unavailableReason?: "missing_session" | "conflict" | "missing_venue" | "missing_date";
  error?: string;
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Check if a venue slot is available for a given date + session.
 * Rules:
 * - Only bookings with recordStatus:"saved" and bookingStatus NOT IN [Canceled, Lost, Rejected] count as conflicts.
 * - WEDDINGS: weddingSession conflict (fullday blocks morning+evening+fullday; morning/evening blocked by fullday).
 * - MICE: same weddingSession field, same session granularity (morning/evening blocks same session or fullday).
 * - No session provided → just check if venue+date has any saved booking (informational).
 */
export async function checkSlotAvailability(data: unknown): Promise<CheckSlotResult> {
  const { session: authSession, error } = await requirePermission({
    module: "leads",
    action: "edit",
  });
  if (error) return { success: false, error };
  if (!apiLimiter.check(`check-slot:${authSession!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = checkSlotSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { venueId, eventDate, session, category, excludeBookingId } = parsed.data;

  try {
    // Parse as explicit UTC midnight so the comparison matches how eventDate is stored.
    // Input is "yyyy-MM-dd" — appending T00:00:00.000Z guarantees UTC-midnight parse
    // regardless of Node.js TZ setting (avoids ambiguity of bare date-string parsing).
    const eventDateObj = new Date(`${eventDate}T00:00:00.000Z`);
    if (isNaN(eventDateObj.getTime())) {
      return { success: false, error: "Tanggal event tidak valid." };
    }

    // If no session provided, we can't do a granular conflict check.
    // Block with a message prompting user to fill session.
    if (!session) {
      return {
        success: true,
        available: false,
        unavailableReason: "missing_session" as const,
        conflictReason:
          category === "MICE"
            ? "Session acara MICE belum diisi pada lead (pagi/malam). Lengkapi data lead sebelum tandai Deal."
            : "Session nikah belum diisi pada lead (pagi/malam/fullday). Lengkapi data lead sebelum tandai Deal.",
      };
    }

    // Build OR conditions for conflict detection (same as wedding conflict check)
    const sessionOrConditions =
      session === "fullday"
        ? [
            { weddingSession: "morning" as const },
            { weddingSession: "evening" as const },
            { weddingSession: "fullday" as const },
          ]
        : [
            { weddingSession: session as "morning" | "evening" },
            { weddingSession: "fullday" as const },
          ];

    const conflict = await db.booking.findFirst({
      where: {
        venueId,
        eventDate: eventDateObj,
        recordStatus: "saved",
        bookingStatus: { notIn: ["Canceled", "Lost", "Rejected"] },
        OR: sessionOrConditions,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      return {
        success: true,
        available: false,
        unavailableReason: "conflict" as const,
        conflictReason:
          "Tanggal & session ini sudah ada yang booking di venue tersebut.",
      };
    }

    return { success: true, available: true };
  } catch (e) {
    console.error("[checkSlotAvailability]", e);
    return { success: false, error: "Gagal memeriksa ketersediaan slot." };
  }
}
