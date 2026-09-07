import { z } from "zod";
import { BookingStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { resolveDealingRange } from "@/lib/queries/dashboard";

const querySchema = z.object({
  filter: z.enum(["total", "pending", "lost"]),
  dealFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dealTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`dashboard-bookings:${session.user.id}`)) {
    return rateLimitResponse();
  }

  const qParsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!qParsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { filter, dealFrom, dealTo } = qParsed.data;
  const { range } = resolveDealingRange(dealFrom, dealTo);

  const where: Record<string, unknown> = { recordStatus: "saved" };
  if (range) {
    where.createdAt = { gte: range.from, lt: range.to };
  }

  if (filter === "pending") {
    where.bookingStatus = BookingStatus.Pending;
  } else if (filter === "lost") {
    where.bookingStatus = { in: [BookingStatus.Lost, BookingStatus.Canceled] };
  }

  const bookings = await db.booking.findMany({
    where,
    select: {
      id: true,
      bookingStatus: true,
      category: true,
      eventDate: true,
      poNumber: true,
      customer: { select: { name: true } },
      venue: { select: { name: true } },
      sales: { select: { fullName: true } },
    },
    orderBy: { eventDate: "desc" },
    take: 200,
  });

  const result = bookings.map((b) => ({
    id: b.id,
    bookingStatus: b.bookingStatus,
    category: b.category,
    eventDate: b.eventDate ? b.eventDate.toISOString() : null,
    poNumber: b.poNumber ?? null,
    customerName: b.customer.name,
    venueName: b.venue.name,
    salesName: b.sales?.fullName ?? "—",
  }));

  return Response.json(result);
}
